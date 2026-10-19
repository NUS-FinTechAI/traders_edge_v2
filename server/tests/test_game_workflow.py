from datetime import timedelta
from unittest.mock import patch
import unittest

from fastapi.testclient import TestClient

from app.db import LearningRun, ReviewItem, now
from app.export_openapi import export_schema
from app.main import create_app
import test_interactive as interactive_fixtures
import test_learning as learning_fixtures


class GameWorkflowTests(unittest.TestCase):
    setUp = interactive_fixtures.InteractiveTests.setUp
    tearDown = interactive_fixtures.InteractiveTests.tearDown
    key = interactive_fixtures.InteractiveTests.key
    start = interactive_fixtures.InteractiveTests.start
    answer = interactive_fixtures.InteractiveTests.answer
    submit = interactive_fixtures.InteractiveTests.submit
    finish = interactive_fixtures.InteractiveTests.finish
    baseline = interactive_fixtures.InteractiveTests.baseline
    lessons = interactive_fixtures.InteractiveTests.lessons

    def workflow(self):
        response = self.client.get('/api/me/workflow')
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def complete_chapter_learning(self):
        self.baseline()
        self.lessons()
        tasks = [{'type': 'choice', **question} for question in self.module['assessment']]
        self.finish(self.start(f'modules/{self.mid}/assessment-runs'), tasks)

    def boss(self, module_id=None, mode='chapter_exit', seed=1):
        with patch('app.gameplay.secrets.randbits', return_value=seed):
            response = self.client.post('/api/challenges', json={
                'idempotency_key': self.key(), 'mode': mode, 'module_id': module_id or self.mid})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def finish_boss(self, attempt):
        for _ in range(6):
            response = self.client.post(f"/api/challenges/{attempt['id']}/advance", json={
                'idempotency_key': self.key(), 'steps': 5})
            self.assertEqual(response.status_code, 200, response.text)
        response = self.client.post(f"/api/challenges/{attempt['id']}/complete", json={
            'idempotency_key': self.key(),
            'reflection': 'I observed the common market without an executable thesis and compared the final outcomes.'})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_game_journey_resumes_required_learning_and_keeps_wrong_practice_retry(self):
        self.assertEqual(self.workflow()['game_next_action'], {'kind': 'diagnostic', 'module_id': self.mid})
        run = self.start(f'modules/{self.mid}/diagnostic-runs')
        self.assertEqual(self.workflow()['game_next_action'], {'kind': 'resume_learning',
            'run_id': run['id'], 'module_id': self.mid, 'level_id': None, 'purpose': 'diagnostic'})
        self.finish(run, self.module['entry_tasks'], wrong=(0,))
        lesson = self.module['lessons'][0]
        self.assertEqual(self.workflow()['game_next_action'], {'kind': 'level',
            'module_id': self.mid, 'level_id': lesson['id']})
        run = self.start(f"levels/{lesson['id']}/runs")
        run = self.submit(run, lesson['tasks'][0])
        run = self.submit(run, lesson['tasks'][1], wrong=True)

        workflow = self.workflow()

        self.assertEqual(workflow['game_next_action'], {'kind': 'resume_learning',
            'run_id': run['id'], 'module_id': self.mid, 'level_id': lesson['id'], 'purpose': 'practice'})
        self.assertEqual(workflow['resume']['current_step']['id'], lesson['tasks'][1]['id'])
        for task in lesson['tasks'][1:]:
            run = self.submit(run, task)
        self.assertEqual(self.workflow()['game_next_action']['level_id'], self.module['lessons'][1]['id'])

    def test_required_runs_with_the_same_creation_time_use_a_stable_id_tiebreaker(self):
        self.baseline()
        self.lessons()
        with patch('app.learning_runs.uid', side_effect=['same-time-z-required', 'same-time-a-required']):
            assessment = self.start(f'modules/{self.mid}/assessment-runs')
            practice = self.start(f"levels/{self.module['lessons'][0]['id']}/runs")

        async def align_creation_times():
            async with self.app.state.db.sessions.begin() as db:
                first = await db.get(LearningRun, assessment['id'])
                second = await db.get(LearningRun, practice['id'])
                second.created_at = first.created_at
        self.client.portal.call(align_creation_times)

        workflow = self.workflow()

        self.assertEqual(workflow['game_next_action']['run_id'], assessment['id'])
        self.assertEqual(workflow['game_next_action']['purpose'], 'assessment')
        self.assertEqual(workflow['next_action']['run_id'], practice['id'])

    def test_game_journey_recommends_check_then_boss_without_changing_legacy_next_action(self):
        self.baseline()
        self.lessons()
        self.assertEqual(self.workflow()['game_next_action'], {'kind': 'assessment', 'module_id': self.mid})
        run = self.start(f'modules/{self.mid}/assessment-runs')
        self.assertEqual(self.workflow()['game_next_action']['run_id'], run['id'])
        self.finish(run, [{'type': 'choice', **question} for question in self.module['assessment']])

        workflow = self.workflow()

        self.assertEqual(workflow['next_action'], {'kind': 'diagnostic', 'module_id': self.content['modules'][1]['id']})
        self.assertEqual(workflow['game_next_action'], {'kind': 'chapter_exit_boss', 'module_id': self.mid,
            'action': 'start', 'available': True, 'reason': None, 'attempt_id': None,
            'previous_attempt_id': None, 'blocking_attempt_ids': []})
        self.assertEqual(workflow['profile']['mastered_module_ids'], [self.mid])

    def test_failed_boss_recommends_retry_and_active_retry_survives_restart(self):
        self.complete_chapter_learning()
        failed = self.finish_boss(self.boss(seed=2))
        self.assertFalse(failed['result']['win'])

        retry = self.workflow()['game_next_action']

        self.assertEqual(retry['action'], 'retry')
        self.assertEqual(retry['previous_attempt_id'], failed['id'])
        attempt = self.boss()
        resumed = self.workflow()['game_next_action']
        self.assertEqual(resumed['action'], 'resume')
        self.assertEqual(resumed['attempt_id'], attempt['id'])
        with TestClient(create_app(self.settings, self.content)) as restarted:
            restarted.cookies.set(self.settings.cookie_name, self.client.cookies.get(self.settings.cookie_name))
            response = restarted.get('/api/me/workflow')
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['game_next_action'], resumed)

    def test_boss_win_advances_game_journey_and_leaves_bonus_optional(self):
        self.complete_chapter_learning()
        finished = self.finish_boss(self.boss())
        self.assertTrue(finished['result']['win'])

        workflow = self.workflow()

        self.assertEqual(workflow['game_next_action'], {'kind': 'diagnostic',
            'module_id': self.content['modules'][1]['id']})
        self.assertTrue(all(not level['bonus_star'] for level in workflow['modules'][0]['levels']))
        self.assertEqual(workflow['profile']['mastered_module_ids'], [self.mid])

    def test_active_bonus_does_not_divert_game_journey(self):
        self.complete_chapter_learning()
        lesson = self.module['lessons'][0]
        bonus = self.start(f"levels/{lesson['id']}/runs", purpose='bonus')

        workflow = self.workflow()

        self.assertEqual(workflow['next_action']['run_id'], bonus['id'])
        self.assertEqual(workflow['resume']['purpose'], 'bonus')
        self.assertEqual(workflow['game_next_action']['kind'], 'chapter_exit_boss')

    def test_due_review_remains_resumable_without_replacing_required_game_journey(self):
        self.complete_chapter_learning()
        review_id = self.client.get('/api/reviews').json()['reviews'][0]['id']
        async def make_due():
            async with self.app.state.db.sessions.begin() as db:
                review = await db.get(ReviewItem, review_id)
                review.due_at = now() - timedelta(minutes=1)
        self.client.portal.call(make_due)
        response = self.client.post(f'/api/reviews/{review_id}/runs', json={'idempotency_key': self.key()})
        self.assertEqual(response.status_code, 200, response.text)

        workflow = self.workflow()

        self.assertEqual(workflow['resume']['purpose'], 'review')
        self.assertEqual(workflow['next_action']['run_id'], response.json()['id'])
        self.assertEqual(workflow['profile']['due_review_count'], 1)
        self.assertEqual(workflow['game_next_action']['kind'], 'chapter_exit_boss')

    def test_full_active_limit_blocks_new_boss_but_not_owned_boss_resume(self):
        self.complete_chapter_learning()
        attempts = [self.boss(module['id'], mode='chapter_entry') for module in self.content['modules'][1:4]]

        blocked = self.workflow()['game_next_action']

        self.assertFalse(blocked['available'])
        self.assertEqual(blocked['reason'], 'active_challenge_limit')
        self.assertEqual(blocked['blocking_attempt_ids'], [attempt['id'] for attempt in attempts])
        rejected = self.client.post('/api/challenges', json={
            'idempotency_key': self.key(), 'mode': 'chapter_exit', 'module_id': self.mid})
        self.assertEqual(rejected.status_code, 409)
        response = self.client.post(f"/api/challenges/{attempts[0]['id']}/abandon", json={'idempotency_key': self.key()})
        self.assertEqual(response.status_code, 200, response.text)
        own = self.boss()
        resumable = self.workflow()['game_next_action']
        self.assertTrue(resumable['available'])
        self.assertEqual(resumable['action'], 'resume')
        self.assertEqual(resumable['attempt_id'], own['id'])
        self.assertEqual(resumable['blocking_attempt_ids'], [])

    def test_game_journey_does_not_expose_another_players_attempts(self):
        self.complete_chapter_learning()
        attempt = self.boss()
        self.client.cookies.clear()
        self.client.post('/api/session')

        workflow = self.workflow()

        self.assertEqual(workflow['game_next_action'], {'kind': 'diagnostic', 'module_id': self.mid})
        self.assertNotIn(attempt['id'], str(workflow))

    def test_workflow_publishes_typed_game_actions_and_multiplayer_eligibility(self):
        schema = export_schema()

        response = schema['paths']['/api/me/workflow']['get']['responses']['200']['content']['application/json']['schema']

        self.assertEqual(response, {'$ref': '#/components/schemas/LearningWorkflowResponse'})
        definitions = schema['components']['schemas']
        game_action = definitions['GameNextAction']
        self.assertEqual(game_action['discriminator']['mapping']['chapter_exit_boss'], '#/components/schemas/GameBossAction')
        self.assertEqual(definitions['PracticeEligibility']['properties']['private_multiplayer'],
            {'type': 'boolean', 'title': 'Private Multiplayer'})


class MultiplayerEligibilityTests(unittest.TestCase):
    setUp = learning_fixtures.LearningTests.setUp
    tearDown = learning_fixtures.LearningTests.tearDown
    body = learning_fixtures.LearningTests.body
    complete_module = learning_fixtures.LearningTests.complete_module

    def test_private_and_public_eligibility_match_their_actual_structured_gates(self):
        for index in range(4):
            self.complete_module(index)

        foundations = self.client.get('/api/me/workflow').json()['practice_eligibility']

        self.assertTrue(foundations['private_multiplayer'])
        self.assertFalse(foundations['public_ranked'])
        self.assertEqual(foundations['private_multiplayer_missing_module_ids'], [])
        self.assertEqual(foundations['public_ranked_missing_module_ids'], ['m5', 'm6', 'm7', 'm8', 'm9'])
        private = self.client.post('/api/multiplayer/lobbies', json={'idempotency_key': 'eligible-private-lobby'})
        self.assertEqual(private.status_code, 201, private.text)
        public = self.client.post('/api/multiplayer/matchmaking', json={'idempotency_key': 'ineligible-public-queue'})
        self.assertEqual(public.status_code, 403, public.text)
        for index in range(4, 9):
            self.complete_module(index)
        core = self.client.get('/api/me/workflow').json()['practice_eligibility']
        self.assertTrue(core['public_ranked'])
        self.assertTrue(core['multiplayer'])
        self.assertEqual(core['public_ranked_missing_module_ids'], [])
        public = self.client.post('/api/multiplayer/matchmaking', json={'idempotency_key': 'eligible-public-queue'})
        self.assertEqual(public.status_code, 200, public.text)

    def test_early_boss_access_never_satisfies_structured_multiplayer_prerequisites(self):
        with patch('app.gameplay.secrets.randbits', return_value=1):
            response = self.client.post('/api/challenges', json={
                'mode': 'chapter_entry', 'module_id': 'm2', 'idempotency_key': 'early-eligibility-boss'})
        self.assertEqual(response.status_code, 201, response.text)
        attempt_id = response.json()['id']
        for index in range(6):
            response = self.client.post(f'/api/challenges/{attempt_id}/advance', json={
                'steps': 5, 'idempotency_key': f'early-eligibility-advance-{index}'})
            self.assertEqual(response.status_code, 200, response.text)
        response = self.client.post(f'/api/challenges/{attempt_id}/complete', json={
            'idempotency_key': 'early-eligibility-complete',
            'reflection': 'I compared the shared final portfolios while observing without an executable thesis.'})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(response.json()['result']['win'])

        workflow = self.client.get('/api/me/workflow').json()

        self.assertTrue(workflow['modules'][1]['unlocked'])
        self.assertEqual(workflow['profile']['mastered_module_ids'], [])
        self.assertFalse(workflow['practice_eligibility']['private_multiplayer'])
        self.assertFalse(workflow['practice_eligibility']['public_ranked'])
        self.assertEqual(workflow['practice_eligibility']['private_multiplayer_missing_module_ids'], ['m1', 'm2', 'm3', 'm4'])
        self.assertEqual(self.client.post('/api/multiplayer/lobbies', json={
            'idempotency_key': 'early-still-no-private'}).status_code, 403)

    def test_incomplete_catalog_cannot_claim_private_or_ranked_eligibility(self):
        self.content['modules'] = self.content['modules'][:1]
        self.complete_module()

        eligibility = self.client.get('/api/me/workflow').json()['practice_eligibility']

        self.assertFalse(eligibility['private_multiplayer'])
        self.assertFalse(eligibility['public_ranked'])
