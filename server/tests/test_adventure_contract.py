import unittest
from dataclasses import replace

from fastapi.testclient import TestClient

from app.main import create_app
import test_interactive as fixtures


class AdventureContractTests(unittest.TestCase):
    setUp = fixtures.InteractiveTests.setUp
    tearDown = fixtures.InteractiveTests.tearDown
    key = fixtures.InteractiveTests.key
    start = fixtures.InteractiveTests.start
    answer = fixtures.InteractiveTests.answer
    submit = fixtures.InteractiveTests.submit
    finish = fixtures.InteractiveTests.finish
    baseline = fixtures.InteractiveTests.baseline
    lessons = fixtures.InteractiveTests.lessons

    def chapter(self, index=0, client=None):
        response = (client or self.client).get('/api/adventure')
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['chapters'][index]

    def test_new_learner_sees_empty_stars_and_boss_gate_reasons(self):
        first = self.chapter()
        second = self.chapter(1)

        self.assertEqual(first['normal_stars'], {'earned': 0, 'total': 3})
        self.assertEqual(first['special_stars'], {'earned': 0, 'total': 3})
        self.assertEqual(first['entry_boss'], {'available': False,
            'reason': 'introductory_diagnostic', 'active_attempt_ids': []})
        self.assertEqual(first['exit_boss']['reason'], 'required_levels_incomplete')
        self.assertFalse(second['unlocked'])
        self.assertTrue(second['entry_boss']['available'])
        self.assertEqual(second['exit_boss']['reason'], 'chapter_locked')
        rejected = self.client.post('/api/challenges', json={'mode': 'chapter_exit',
            'module_id': second['module_id'], 'idempotency_key': self.key()})
        self.assertEqual(rejected.status_code, 403)

    def test_repeated_bonus_completion_counts_one_special_star_and_survives_restart(self):
        self.baseline()
        lesson = self.module['lessons'][0]
        self.finish(self.start(f"levels/{lesson['id']}/runs"), lesson['tasks'])
        for _ in range(2):
            self.finish(self.start(f"levels/{lesson['id']}/runs", purpose='bonus'), lesson['bonus_tasks'])

        chapter = self.chapter()
        mapping = self.client.get(f'/api/modules/{self.mid}/map').json()
        with TestClient(create_app(self.settings, self.content)) as restarted:
            restarted.cookies.set(self.settings.cookie_name, self.client.cookies.get(self.settings.cookie_name))
            restored = self.chapter(client=restarted)

        self.assertEqual(chapter['normal_stars']['earned'], 1)
        self.assertEqual(chapter['special_stars']['earned'], 1)
        self.assertEqual(chapter['normal_stars']['earned'], sum(node['standard_star'] for node in mapping['levels']))
        self.assertEqual(chapter['special_stars']['earned'], sum(node['bonus_star'] for node in mapping['levels']))
        self.assertEqual(restored, chapter)

    def test_incorrect_bonus_answer_does_not_award_a_special_star(self):
        self.baseline()
        lesson = self.module['lessons'][0]
        self.finish(self.start(f"levels/{lesson['id']}/runs"), lesson['tasks'])
        run = self.start(f"levels/{lesson['id']}/runs", purpose='bonus')

        self.submit(run, lesson['bonus_tasks'][0], wrong=True)
        chapter = self.chapter()

        self.assertEqual(chapter['special_stars']['earned'], 0)
        self.assertEqual(chapter['active_learning_runs'], [
            {'run_id': run['id'], 'purpose': 'bonus', 'level_id': lesson['id']}])

    def test_completed_required_levels_enable_exit_boss_without_bonus_or_mastery(self):
        self.baseline()
        self.lessons()

        chapter = self.chapter()
        response = self.client.post('/api/challenges', json={'mode': 'chapter_exit',
            'module_id': self.mid, 'idempotency_key': self.key()})

        self.assertEqual(chapter['exit_boss'], {'available': True, 'reason': None, 'active_attempt_ids': []})
        self.assertEqual(chapter['special_stars']['earned'], 0)
        self.assertFalse(self.client.get(f'/api/modules/{self.mid}/map').json()['mastered'])
        self.assertEqual(response.status_code, 201, response.text)

    def test_active_diagnostic_practice_and_assessment_are_resumable_by_id(self):
        diagnostic = self.start(f'modules/{self.mid}/diagnostic-runs')
        self.assertEqual(self.chapter()['active_learning_runs'], [
            {'run_id': diagnostic['id'], 'purpose': 'diagnostic', 'level_id': None}])
        self.finish(diagnostic, self.module['entry_tasks'])
        lesson = self.module['lessons'][0]
        practice = self.start(f"levels/{lesson['id']}/runs")
        self.assertEqual(self.chapter()['active_learning_runs'], [
            {'run_id': practice['id'], 'purpose': 'practice', 'level_id': lesson['id']}])
        briefing = self.client.get(f"/api/levels/{lesson['id']}").json()
        self.assertEqual(briefing['level']['active_run_id'], practice['id'])
        self.lessons()

        assessment = self.start(f'modules/{self.mid}/assessment-runs')
        chapter = self.chapter()

        self.assertEqual(chapter['active_learning_runs'], [
            {'run_id': assessment['id'], 'purpose': 'assessment', 'level_id': None}])
        self.assertEqual(self.client.get('/api/learning-runs/' + assessment['id']).status_code, 200)

    def test_active_challenge_limit_blocks_new_boss_but_keeps_resume_ids(self):
        module_id = self.content['modules'][1]['id']
        attempts = []
        for _ in range(3):
            response = self.client.post('/api/challenges', json={'mode': 'chapter_entry',
                'module_id': module_id, 'idempotency_key': self.key()})
            self.assertEqual(response.status_code, 201, response.text)
            attempts.append(response.json()['id'])

        chapter = self.chapter(1)
        rejected = self.client.post('/api/challenges', json={'mode': 'chapter_entry',
            'module_id': module_id, 'idempotency_key': self.key()})

        self.assertFalse(chapter['entry_boss']['available'])
        self.assertEqual(chapter['entry_boss']['reason'], 'active_challenge_limit')
        self.assertCountEqual(chapter['entry_boss']['active_attempt_ids'], attempts)
        self.assertEqual(rejected.status_code, 409)
        abandoned = self.client.post('/api/challenges/' + attempts[0] + '/abandon', json={'idempotency_key': self.key()})
        self.assertEqual(abandoned.status_code, 200, abandoned.text)
        recovered = self.chapter(1)['entry_boss']
        self.assertTrue(recovered['available'])
        self.assertNotIn(attempts[0], recovered['active_attempt_ids'])

    def test_other_learner_cannot_see_progress_or_resume_identifiers(self):
        self.baseline()
        lesson = self.module['lessons'][0]
        self.finish(self.start(f"levels/{lesson['id']}/runs"), lesson['tasks'])
        self.start(f"levels/{lesson['id']}/runs", purpose='bonus')
        created = self.client.post('/api/challenges', json={'mode': 'chapter_entry',
            'module_id': self.content['modules'][1]['id'], 'idempotency_key': self.key()})
        self.assertEqual(created.status_code, 201, created.text)
        self.client.cookies.clear()
        self.assertEqual(self.client.post('/api/session').status_code, 200)

        chapter = self.chapter()
        boss = self.chapter(1)['entry_boss']

        self.assertEqual(chapter['normal_stars']['earned'], 0)
        self.assertEqual(chapter['active_learning_runs'], [])
        self.assertEqual(boss['active_attempt_ids'], [])
        self.assertTrue(boss['available'])

    def test_public_overview_excludes_answer_keys_and_challenge_snapshots(self):
        self.start(f'modules/{self.mid}/diagnostic-runs')
        created = self.client.post('/api/challenges', json={'mode': 'chapter_entry',
            'module_id': self.content['modules'][1]['id'], 'idempotency_key': self.key()})
        self.assertEqual(created.status_code, 201, created.text)

        response = self.client.get('/api/adventure')

        self.assertEqual(response.status_code, 200, response.text)
        for private_key in ('correct_option_id', 'correct_assignments', 'snapshot', 'seed', 'agents', 'human'):
            self.assertNotIn('"' + private_key + '"', response.text)

    def test_adventure_reads_reject_missing_authentication(self):
        self.client.cookies.clear()

        for path in ('/api/adventure', f'/api/modules/{self.mid}/map',
                     '/api/levels/' + self.module['lessons'][0]['id']):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 401)

    def test_adventure_reads_reject_unapproved_content_in_production(self):
        self.app.state.settings = replace(self.settings, environment='production')

        for path in ('/api/adventure', f'/api/modules/{self.mid}/map',
                     '/api/levels/' + self.module['lessons'][0]['id']):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 503)
                self.assertIn('independent publication review', response.text)

    def test_unknown_map_and_level_identifiers_return_not_found(self):
        for path in ('/api/modules/unknown/map', '/api/levels/unknown'):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 404)
