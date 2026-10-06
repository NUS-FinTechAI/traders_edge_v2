from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import unittest

from app.economy_models import EconomyAccount
from app.gameplay import ChallengeDefinition
import test_learning as fixtures


class AdventureTests(unittest.TestCase):
    setUp = fixtures.LearningTests.setUp
    tearDown = fixtures.LearningTests.tearDown
    body = fixtures.LearningTests.body
    complete_module = fixtures.LearningTests.complete_module

    def start(self, mode, key, module=None):
        body = {'mode': mode, 'idempotency_key': key}
        if module:
            body['module_id'] = module
        with patch('app.gameplay.secrets.randbits', return_value=1):
            response = self.client.post('/api/challenges', json=body)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def finish(self, attempt):
        identifier = attempt['id']
        for step in range(6):
            response = self.client.post(f'/api/challenges/{identifier}/advance', json={
                'steps': 5, 'idempotency_key': f'advance-{identifier}-{step}'})
            self.assertEqual(response.status_code, 200, response.text)
        response = self.client.post(f'/api/challenges/{identifier}/complete', json={
            'idempotency_key': 'complete-' + identifier,
            'reflection': 'I observed without an executable thesis and compared my result against the opponents.'})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_early_boss_unlocks_only_its_chapter_without_fabricating_mastery(self):
        self.assertEqual(self.client.get('/api/lessons/m2-l1').status_code, 403)
        attempt = self.start('chapter_entry', 'early-entry-start', 'm2')
        finished = self.finish(attempt)
        self.assertTrue(finished['result']['win'])
        self.assertEqual(self.client.get('/api/lessons/m2-l1').status_code, 200)
        self.assertEqual(self.client.get('/api/lessons/m3-l1').status_code, 403)
        profile = self.client.get('/api/me/profile').json()
        self.assertEqual(profile['mastered_module_ids'], [])
        self.assertEqual((profile['learning_xp'], profile['game_xp']), (0, 20))
        mapping = self.client.get('/api/modules/m2/map').json()
        self.assertTrue(mapping['unlocked'])
        self.assertFalse(mapping['mastered'])
        curriculum = self.client.get('/api/curriculum').json()['modules']
        self.assertTrue(next(module for module in curriculum if module['id'] == 'm2')['unlocked'])
        workflow = self.client.get('/api/me/workflow').json()['modules']
        self.assertTrue(next(module for module in workflow if module['module_id'] == 'm2')['unlocked'])
        self.assertEqual(self.client.post('/api/simulations', json={'idempotency_key': 'still-need-foundations'}).status_code, 403)

    def test_failed_boss_does_not_unlock_or_award_mastery(self):
        with patch('app.gameplay.secrets.randbits', return_value=2):
            response = self.client.post('/api/challenges', json={'mode': 'chapter_entry', 'module_id': 'm2', 'idempotency_key': 'failed-entry-start'})
        self.assertEqual(response.status_code, 201)
        result = self.finish(response.json())
        self.assertFalse(result['result']['win'])
        self.assertEqual(self.client.get('/api/lessons/m2-l1').status_code, 403)
        self.assertEqual(self.client.get('/api/me/profile').json()['mastered_module_ids'], [])

    def test_exit_requires_required_levels_and_win_unlocks_next_chapter(self):
        self.assertEqual(self.client.post('/api/challenges', json={'mode': 'chapter_exit', 'module_id': 'm2', 'idempotency_key': 'locked-exit-start'}).status_code, 403)
        self.finish(self.start('chapter_entry', 'unlock-exit-chapter', 'm2'))
        self.assertEqual(self.client.post('/api/challenges', json={'mode': 'chapter_exit', 'module_id': 'm2', 'idempotency_key': 'missing-level-exit'}).status_code, 403)
        module = self.content['modules'][1]
        for lesson in module['lessons']:
            completed = self.client.post('/api/lessons/' + lesson['id'] + '/complete', json=self.body(lesson['questions']))
            self.assertEqual(completed.status_code, 200, completed.text)
        result = self.finish(self.start('chapter_exit', 'exit-chapter-start', 'm2'))
        self.assertTrue(result['result']['win'])
        self.assertEqual(self.client.get('/api/lessons/m3-l1').status_code, 200)
        self.assertEqual(self.client.get('/api/me/profile').json()['mastered_module_ids'], [])

    def test_chapter_one_has_no_entry_boss_and_unknown_inputs_reject(self):
        for module, status in [('m1', 422), ('unknown', 404)]:
            response = self.client.post('/api/challenges', json={'mode': 'chapter_entry', 'module_id': module, 'idempotency_key': 'invalid-entry-' + module})
            self.assertEqual(response.status_code, status)
        self.assertEqual(self.client.post('/api/challenges', json={'mode': 'daily', 'module_id': 'm1', 'idempotency_key': 'daily-forged-chapter'}).status_code, 422)
        self.assertEqual(self.client.post('/api/challenges', json={'mode': 'daily', 'opponent_count': 3, 'idempotency_key': 'daily-forged-opponents'}).status_code, 422)

    def test_daily_is_common_private_pinned_form_and_single_active_attempt(self):
        first = self.start('daily', 'daily-first-start')
        repeat = self.client.post('/api/challenges', json={'mode': 'daily', 'idempotency_key': 'daily-first-start'})
        self.assertEqual(repeat.json(), first)
        self.assertEqual(self.client.post('/api/challenges', json={'mode': 'daily', 'idempotency_key': 'daily-another-start'}).status_code, 409)
        token = self.client.cookies.get(self.settings.cookie_name)
        self.client.cookies.clear()
        self.client.post('/api/session')
        second = self.start('daily', 'other-daily-start')
        self.assertEqual(second['challenge_id'], first['challenge_id'])
        async def parameters():
            async with self.app.state.db.sessions() as db:
                definition = await db.get(ChallengeDefinition, first['challenge_id'])
                return definition.config
        config = self.client.portal.call(parameters)
        self.assertNotIn('seed', first)
        self.assertEqual(first['player']['quotes'], second['player']['quotes'])
        self.assertIsInstance(config['seed'], int)
        self.client.cookies.set(self.settings.cookie_name, token)
        self.assertEqual(self.client.get('/api/challenges/' + second['id']).status_code, 404)

    def test_daily_abandonment_cooldown_refresh_is_linked_once(self):
        first = self.start('daily', 'daily-loss-start')
        abandoned = self.client.post('/api/challenges/' + first['id'] + '/abandon', json={'idempotency_key': 'daily-loss-abandon'})
        self.assertEqual(abandoned.status_code, 200, abandoned.text)
        self.assertEqual(self.client.get('/api/me/profile').json()['xp'], 0)
        self.assertEqual(self.client.post('/api/challenges', json={'mode': 'daily', 'idempotency_key': 'daily-cooldown-start'}).status_code, 409)
        user_id = self.client.get('/api/me/profile').json()['id']
        async def funded():
            async with self.app.state.db.sessions.begin() as db:
                (await db.get(EconomyAccount, user_id)).premium_balance = 10
        self.client.portal.call(funded)
        refresh = self.client.post('/api/me/economy/daily-refresh', json={'idempotency_key': 'paid-daily-refresh'})
        self.assertEqual(refresh.status_code, 200, refresh.text)
        second = self.start('daily', 'paid-daily-start')
        from app.challenges.models import ChallengeAttempt
        async def receipt():
            async with self.app.state.db.sessions() as db:
                return (await db.get(ChallengeAttempt, second['id'])).snapshot_json['research']
        research = self.client.portal.call(receipt)
        self.assertTrue(research['premium_retry'])
        self.assertEqual(research['refresh_event_key'], 'refresh:paid-daily-refresh')
        self.assertEqual(self.client.post('/api/challenges', json={'mode': 'daily', 'idempotency_key': 'paid-daily-start'}).json(), second)
        self.assertEqual(self.client.get('/api/me/economy').json()['premium_balance'], 0)

    def test_yesterday_daily_completion_cannot_claim_today_currency(self):
        monday = datetime(2026, 10, 5, 12, tzinfo=timezone.utc)
        with patch('app.gameplay.now', return_value=monday), patch('app.economy.now', return_value=monday), patch('app.gameplay.secrets.choice', return_value='falling'):
            first = self.start('daily', 'old-daily-form')
        with patch('app.gameplay.now', return_value=monday + timedelta(days=1)), patch('app.economy.now', return_value=monday + timedelta(days=1)):
            finished = self.finish(first)
            self.assertTrue(finished['result']['win'])
            self.assertEqual(finished['result']['awards']['awarded']['stocks'], 0)

    def test_failed_settlement_rolls_back_boss_unlock_and_completion(self):
        from fastapi import HTTPException
        attempt = self.start('chapter_entry', 'atomic-entry-start', 'm2')
        for step in range(6):
            self.assertEqual(self.client.post(f"/api/challenges/{attempt['id']}/advance", json={
                'steps': 5, 'idempotency_key': f'atomic-advance-{step}'}).status_code, 200)
        payload = {'idempotency_key': 'atomic-boss-complete', 'reflection': 'I compared the observed outcome without an executable trading thesis.'}
        with patch('app.gameplay.settle_challenge', side_effect=HTTPException(503, 'Temporary settlement failure')):
            self.assertEqual(self.client.post(f"/api/challenges/{attempt['id']}/complete", json=payload).status_code, 503)
        self.assertEqual(self.client.get('/api/lessons/m2-l1').status_code, 403)
        self.assertEqual(self.client.get('/api/challenges/' + attempt['id']).json()['status'], 'active')
        self.assertEqual(self.client.get('/api/me/profile').json()['xp'], 0)
        recovered = self.client.post(f"/api/challenges/{attempt['id']}/complete", json=payload)
        self.assertEqual(recovered.status_code, 200, recovered.text)
        self.assertEqual(self.client.get('/api/lessons/m2-l1').status_code, 200)
        self.assertEqual(self.client.post(f"/api/challenges/{attempt['id']}/complete", json=payload).json(), recovered.json())

    def test_early_access_keeps_canonical_diagnostic_and_level_sequence(self):
        from app.content.catalog import load_catalog
        self.app.state.catalog = load_catalog()
        module = self.app.state.catalog['modules'][1]
        identifier = module['id']
        self.finish(self.start('chapter_entry', 'canonical-entry-start', identifier))
        self.assertEqual(self.client.post('/api/levels/' + module['lessons'][0]['id'] + '/runs', json={'idempotency_key': 'canonical-before-diagnostic'}).status_code, 403)
        diagnostic = self.client.post('/api/modules/' + identifier + '/diagnostic-runs', json={'idempotency_key': 'canonical-early-diagnostic'})
        self.assertEqual(diagnostic.status_code, 200, diagnostic.text)
        self.assertEqual(self.client.post('/api/levels/' + module['lessons'][1]['id'] + '/runs', json={'idempotency_key': 'canonical-level-skip'}).status_code, 403)

    def test_early_chapter_five_can_finish_bound_lesson_without_generic_practice_access(self):
        from app.content.catalog import load_catalog
        from test_interactive import InteractiveTests
        self.app.state.catalog = load_catalog()
        module = self.app.state.catalog['modules'][4]
        boss = self.finish(self.start('chapter_entry', 'early-bound-entry', module['id']))
        self.assertTrue(boss['result']['win'])

        def answer_tasks(run, tasks, prefix):
            for index, task in enumerate(tasks):
                response = self.client.post(f"/api/learning-runs/{run['id']}/steps/{task['id']}/submit", json={
                    'idempotency_key': f'{prefix}-{index}', 'answer': InteractiveTests.answer(self, task)})
                self.assertEqual(response.status_code, 200, response.text)
                run = response.json()
            return run

        diagnostic = self.client.post('/api/modules/' + module['id'] + '/diagnostic-runs', json={
            'idempotency_key': 'early-bound-diagnostic'})
        self.assertEqual(diagnostic.status_code, 200, diagnostic.text)
        self.assertEqual(answer_tasks(diagnostic.json(), module['entry_tasks'], 'early-bound-entry-answer')['status'], 'completed')
        lesson = module['lessons'][0]
        response = self.client.post('/api/levels/' + lesson['id'] + '/runs', json={
            'idempotency_key': 'early-bound-level'})
        self.assertEqual(response.status_code, 200, response.text)
        run = answer_tasks(response.json(), lesson['tasks'][:-1], 'early-bound-practice-answer')
        self.assertEqual(run['current_step']['type'], 'simulation')
        path = '/api/learning-runs/' + run['id'] + '/simulation'
        bind_body = {'idempotency_key': 'early-bound-bind'}
        bound = self.client.post(path, json=bind_body)
        self.assertEqual(bound.status_code, 200, bound.text)
        view = bound.json()
        for index in range(5):
            response = self.client.post('/api/simulations/' + view['id'] + '/advance', json={
                'steps': 2, 'idempotency_key': f'early-bound-observation-{index}'})
            self.assertEqual(response.status_code, 200, response.text)
        view = self.client.get(path).json()
        reviewed = self.client.post(path + '/review', json={'idempotency_key': 'early-bound-review', 'audit': {
            'tick': view['tick'], 'engine_version': view['version'], 'observation_token': view['observation_token'],
            'orders': [], 'session_fees': view['fees'], 'price_limit_guarantees_fill': False,
            'no_order_reason': 'no_thesis_supplied'}})
        self.assertEqual(reviewed.status_code, 200, reviewed.text)
        self.assertEqual(reviewed.json()['status'], 'completed')
        self.assertTrue(reviewed.json()['result']['standard_star'])
        self.assertEqual(self.client.post(path, json=bind_body).json(), bound.json())
        profile = self.client.get('/api/me/profile').json()
        self.assertEqual(profile['mastered_module_ids'], [])
        self.assertEqual(profile['completed_lesson_ids'], [lesson['id']])
        self.assertEqual((profile['learning_xp'], profile['game_xp']), (20, 20))
        self.assertEqual(self.client.post('/api/simulations', json={
            'idempotency_key': 'early-bound-generic-practice'}).status_code, 403)
