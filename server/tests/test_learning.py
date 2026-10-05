from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from dataclasses import replace
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import select, func

from app.config import Settings
from app.db import AggregateEvent, Attempt, ReviewItem, SessionToken, XPLedger, now
from app.main import create_app


def fixture_catalog():
    def question(identifier, critical=False):
        return {'id': identifier, 'prompt': 'Which decision protects essential spending?', 'options': [{'id': 'protect', 'text': 'Keep essential spending available'}, {'id': 'risk', 'text': 'Risk the essential money'}], 'correct_option_id': 'protect', 'explanation': 'A market loss could prevent an essential payment.', 'critical': critical}
    return {'schema_version': 1, 'review_status': 'authored_requires_independent_review', 'sources': [], 'glossary': [], 'modules': [{'id': f'm{i}', 'order': i, 'title': f'Module {i}', 'description': 'Learning fixture', 'lessons': [{'id': f'm{i}-l{j}', 'title': f'Lesson {j}', 'objective': 'Recognize money needed for essential spending', 'source_basis': [], 'explanation': 'Keep essential money available.', 'worked_example': 'Rent is due next month.', 'learning_cycle': {'question': 'What must stay available?'}, 'questions': [question(f'm{i}-l{j}-q1', True), question(f'm{i}-l{j}-q2')]} for j in (1, 2)], 'assessment': [question(f'm{i}-a{k}', k <= 2) for k in range(1, 6)]} for i in range(1, 11)]}


class LearningTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.settings = Settings(database_url=f'sqlite+aiosqlite:///{self.temp.name}/test.db')
        self.content = fixture_catalog()
        self.app = create_app(self.settings, self.content)
        self.client = TestClient(self.app, headers={'Origin': 'http://localhost:5173'})
        self.client.__enter__()
        self.assertEqual(self.client.post('/api/session').status_code, 200)
        self.counter = 0

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.temp.cleanup()

    def body(self, questions, wrong=()):
        self.counter += 1
        return {'idempotency_key': f'answer-key-{self.counter}', 'answers': [{'question_id': q['id'], 'option_id': 'risk' if i in wrong else 'protect', 'confidence': 60} for i, q in enumerate(questions)], 'reflection': 'Essential bills should not depend on uncertain gains.'}

    def complete_module(self, index=0):
        module = self.content['modules'][index]
        for lesson in module['lessons']:
            response = self.client.post(f"/api/lessons/{lesson['id']}/complete", json=self.body(lesson['questions']))
            self.assertEqual(response.status_code, 200, response.text)
            self.assertTrue(response.json()['passed'])
        response = self.client.post(f"/api/modules/{module['id']}/assessment", json=self.body(module['assessment']))
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_guest_cookie_hashed_and_origin_boundary(self):
        with TestClient(create_app(self.settings, self.content), headers={'Origin': 'http://localhost:5173'}) as another:
            response = another.post('/api/session')
            self.assertIn('HttpOnly', response.headers['set-cookie'])
            self.assertIn('SameSite=strict', response.headers['set-cookie'])
        raw = self.client.cookies.get(self.settings.cookie_name)
        async def hashes():
            async with self.app.state.db.sessions() as db:
                return (await db.scalars(select(SessionToken.token_hash))).all()
        self.assertNotIn(raw, self.client.portal.call(hashes))
        self.assertEqual(self.client.patch('/api/me/profile', headers={'Origin': 'https://untrusted.invalid'}, json={'display_name': 'Other'}).status_code, 403)
        self.assertEqual(self.client.post('/api/session', headers={'Origin': ''}).status_code, 403)

    def test_no_keys_or_assessment_leak_in_public_content(self):
        curriculum = self.client.get('/api/curriculum')
        lesson = self.client.get('/api/lessons/m1-l1')
        for response in (curriculum, lesson, self.client.get('/api/archive')):
            self.assertEqual(response.status_code, 200)
            self.assertNotIn('correct_option_id', response.text)
            self.assertNotIn('critical', response.text)
        self.assertEqual(self.client.get('/api/lessons/m2-l1').status_code, 403)
        self.assertEqual(self.client.get('/api/modules/m1/assessment').status_code, 403)

    def test_empty_duplicate_partial_and_extra_answers_rejected(self):
        questions = self.content['modules'][0]['lessons'][0]['questions']
        body = self.body(questions)
        for answers in ([], body['answers'][:1], body['answers'] + body['answers'][:1], body['answers'] + [{'question_id': 'foreign', 'option_id': 'protect'}]):
            payload = {**body, 'answers': answers}
            self.assertEqual(self.client.post('/api/lessons/m1-l1/complete', json=payload).status_code, 422)
        self.assertEqual(self.client.post('/api/lessons/m1-l1/complete', json={**body, 'passed': True}).status_code, 422)
        self.assertEqual(self.client.get('/api/me/profile').json()['xp'], 0)

    def test_reflection_and_unknown_options_are_validated(self):
        payload = self.body(self.content['modules'][0]['lessons'][0]['questions'])
        self.assertEqual(self.client.post('/api/lessons/m1-l1/complete', json={**payload, 'reflection': '   '}).status_code, 422)
        payload['answers'][0]['option_id'] = 'invented'
        self.assertEqual(self.client.post('/api/lessons/m1-l1/complete', json=payload).status_code, 422)

    def test_idempotency_and_repeat_completion_cannot_farm_xp(self):
        lesson = self.content['modules'][0]['lessons'][0]
        body = self.body(lesson['questions'])
        first = self.client.post('/api/lessons/m1-l1/complete', json=body)
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(first.json()['calibration']['mean_brier_score'], 0.16)
        self.assertEqual(first.json()['calibration']['sample_size'], 2)
        second = self.client.post('/api/lessons/m1-l1/complete', json=body)
        self.assertEqual(first.json(), second.json())
        self.assertEqual(self.client.post('/api/lessons/m1-l1/complete', json={**body, 'reflection': 'Different content using the same request key.'}).status_code, 409)
        repeated = self.client.post('/api/lessons/m1-l1/complete', json=self.body(lesson['questions']))
        self.assertEqual(repeated.json()['xp_awarded'], 0)
        self.assertEqual(self.client.get('/api/me/profile').json()['xp'], 20)
        self.assertEqual(len(self.client.get('/api/reviews').json()['reviews']), 1)

    def test_lessons_are_sequential_and_cycle_is_whitelisted(self):
        curriculum = self.client.get('/api/curriculum').json()
        self.assertFalse(curriculum['modules'][0]['lessons'][1]['unlocked'])
        self.assertEqual(self.client.get('/api/lessons/m1-l2').status_code, 403)
        lesson = self.content['modules'][0]['lessons'][1]
        self.assertEqual(self.client.post('/api/lessons/m1-l2/complete', json=self.body(lesson['questions'])).status_code, 403)
        self.content['modules'][0]['lessons'][0]['learning_cycle']['correct_option_id'] = 'private'
        self.content['modules'][0]['lessons'][0]['learning_cycle']['prediction'] = {'future': 'private'}
        response = self.client.get('/api/lessons/m1-l1')
        self.assertNotIn('private', response.text)

    def test_concurrent_retry_has_one_attempt_and_reward(self):
        body = self.body(self.content['modules'][0]['lessons'][0]['questions'])
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda _: self.client.post('/api/lessons/m1-l1/complete', json=body), range(2)))
        self.assertEqual([r.status_code for r in responses], [200, 200])
        self.assertEqual(responses[0].json(), responses[1].json())
        async def counts():
            async with self.app.state.db.sessions() as db:
                return (await db.scalar(select(func.count()).select_from(Attempt)), await db.scalar(select(func.count()).select_from(XPLedger)))
        self.assertEqual(self.client.portal.call(counts), (1, 1))

    def test_critical_items_and_required_lessons_gate_mastery(self):
        module = self.content['modules'][0]
        self.assertEqual(self.client.post('/api/modules/m1/assessment', json=self.body(module['assessment'])).status_code, 403)
        for lesson in module['lessons']:
            self.client.post(f"/api/lessons/{lesson['id']}/complete", json=self.body(lesson['questions']))
        wrong_critical = self.client.post('/api/modules/m1/assessment', json=self.body(module['assessment'], wrong=(0,))).json()
        self.assertEqual(wrong_critical['score_percent'], 80)
        self.assertFalse(wrong_critical['passed'])
        correct_critical = self.client.post('/api/modules/m1/assessment', json=self.body(module['assessment'], wrong=(4,))).json()
        self.assertTrue(correct_critical['passed'])
        self.assertTrue(self.client.get('/api/curriculum').json()['modules'][1]['unlocked'])
        self.assertFalse(self.client.get('/api/curriculum').json()['modules'][2]['unlocked'])

    def test_incomplete_catalog_cannot_unlock_advanced_practice(self):
        self.content['modules'] = self.content['modules'][:1]
        self.complete_module()
        eligibility = self.client.get('/api/curriculum').json()['practice_eligibility']
        self.assertFalse(eligibility['simulation'])
        self.assertFalse(eligibility['multiplayer'])
        self.assertFalse(eligibility['endless'])

    def test_all_ten_modules_sequential_and_advanced_modes_require_nine(self):
        for index in range(9):
            before = self.client.get('/api/curriculum').json()
            self.assertFalse(before['practice_eligibility']['multiplayer'])
            self.assertFalse(before['modules'][9]['unlocked'])
            self.complete_module(index)
        after = self.client.get('/api/curriculum').json()
        self.assertTrue(after['practice_eligibility']['multiplayer'])
        self.assertTrue(after['practice_eligibility']['endless'])
        self.assertTrue(after['modules'][9]['unlocked'])
        self.assertTrue(after['modules'][9]['optional'])
        self.complete_module(9)
        self.assertEqual(len(self.client.get('/api/me/profile').json()['mastered_module_ids']), 10)

    def test_review_due_and_ownership_are_enforced(self):
        lesson = self.content['modules'][0]['lessons'][0]
        completed = self.client.post('/api/lessons/m1-l1/complete', json=self.body(lesson['questions'])).json()
        review = self.client.get('/api/reviews').json()['reviews'][0]
        self.assertFalse(review['due'])
        self.assertEqual(review['questions'], [])
        payload = self.body(lesson['questions'])
        self.assertEqual(self.client.post(f"/api/reviews/{review['id']}/submit", json=payload).status_code, 403)
        async def due_now():
            async with self.app.state.db.sessions.begin() as db:
                item = await db.get(ReviewItem, review['id'])
                item.due_at = now() - timedelta(seconds=1)
        self.client.portal.call(due_now)
        self.assertTrue(self.client.get('/api/reviews').json()['reviews'][0]['due'])
        self.assertEqual(self.client.post(f"/api/reviews/{review['id']}/submit", json=payload).json()['xp_awarded'], 10)
        token = self.client.cookies.get(self.settings.cookie_name)
        self.client.cookies.clear()
        self.client.post('/api/session')
        self.assertEqual(self.client.get(f"/api/attempts/{completed['attempt_id']}").status_code, 403)
        self.assertEqual(self.client.post(f"/api/reviews/{review['id']}/submit", json=payload).status_code, 403)
        self.assertEqual(self.client.get('/api/reviews').json()['reviews'], [])
        self.client.cookies.set(self.settings.cookie_name, token)

    def test_profile_journal_and_leaderboard_privacy(self):
        self.assertEqual(self.client.get('/api/leaderboard').json()['entries'], [])
        self.assertEqual(self.client.post('/api/journal', json={'text': 'short'}).status_code, 422)
        entry = self.client.post('/api/journal', json={'text': 'My essential spending should remain available.', 'lesson_id': 'm1-l1'}).json()
        self.client.patch('/api/me/profile', json={'display_name': 'QuietLearner', 'leaderboard_opt_in': True})
        self.complete_module()
        ranking = self.client.get('/api/leaderboard').json()
        self.assertEqual(ranking['entries'][0]['display_name'], 'QuietLearner')
        self.assertNotIn('user_id', str(ranking))
        self.client.cookies.clear()
        self.client.post('/api/session')
        self.assertEqual(self.client.get('/api/journal').json()['entries'], [])
        self.assertEqual(self.client.delete('/api/journal/' + entry['id']).status_code, 403)

    def test_expired_and_revoked_sessions_fail_closed(self):
        async def expire():
            async with self.app.state.db.sessions.begin() as db:
                for session in (await db.scalars(select(SessionToken))).all():
                    session.expires_at = now() - timedelta(seconds=1)
        self.client.portal.call(expire)
        self.assertEqual(self.client.get('/api/me/profile').status_code, 401)
        self.assertEqual(self.client.post('/api/session').status_code, 200)
        self.assertEqual(self.client.delete('/api/session').status_code, 204)
        self.assertEqual(self.client.get('/api/me/profile').status_code, 401)

    def test_persistence_across_app_restart(self):
        self.complete_module()
        before = self.client.get('/api/me/profile').json()
        token = self.client.cookies.get(self.settings.cookie_name)
        with TestClient(create_app(self.settings, self.content)) as restarted:
            restarted.cookies.set(self.settings.cookie_name, token)
            after = restarted.get('/api/me/profile').json()
            self.assertEqual(before, after)
            self.assertEqual(len(restarted.get('/api/reviews').json()['reviews']), 2)

    def test_analytics_is_opt_in_aggregate_only(self):
        self.complete_module()
        async def count():
            async with self.app.state.db.sessions() as db:
                return await db.scalar(select(func.count()).select_from(AggregateEvent))
        self.assertEqual(self.client.portal.call(count), 0)
        self.client.patch('/api/me/profile', json={'analytics_opt_in': True})
        self.complete_module(1)
        self.assertEqual(self.client.portal.call(count), 1)

    def test_migrations_are_repeatable_and_unreviewed_content_is_not_publication_ready(self):
        self.complete_module()
        before = self.client.get('/api/me/profile').json()
        self.client.portal.call(self.app.state.db.migrate)
        self.client.portal.call(self.app.state.db.check_schema)
        self.assertEqual(self.client.get('/api/me/profile').json(), before)
        self.app.state.settings = replace(self.settings, environment='production')
        self.assertEqual(self.client.get('/api/curriculum').status_code, 503)
        self.assertEqual(self.client.get('/api/lessons/m1-l1').status_code, 503)
        self.assertEqual(self.client.get('/api/archive').status_code, 503)
        self.app.state.settings = self.settings

    def test_auth_configuration_fails_closed(self):
        with self.assertRaises(ValueError):
            create_app(Settings(environment='production'))
        with self.assertRaises(ValueError):
            create_app(Settings(auth_mode='firebase'))
        firebase = Settings(database_url=f'sqlite+aiosqlite:///{self.temp.name}/firebase.db', auth_mode='firebase', firebase_project_id='test-project')
        with TestClient(create_app(firebase, self.content), headers={'Origin': 'http://localhost:5173'}) as client:
            self.assertEqual(client.post('/api/session').status_code, 403)
            self.assertEqual(client.get('/api/me/profile').status_code, 401)
            with patch('firebase_admin.auth.verify_id_token', return_value={'uid': 'verified-test-user'}):
                first = client.get('/api/me/profile', headers={'Authorization': 'Bearer verified'}).json()
                second = client.get('/api/me/profile', headers={'Authorization': 'Bearer refreshed'}).json()
                self.assertEqual(first['id'], second['id'])
                self.assertNotIn('firebase_uid', first)
            with patch('firebase_admin.auth.verify_id_token', side_effect=ValueError('invalid token')):
                self.assertEqual(client.get('/api/me/profile', headers={'Authorization': 'Bearer invalid'}).status_code, 401)
