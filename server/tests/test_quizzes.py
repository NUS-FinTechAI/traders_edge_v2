from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
import os
import tempfile
import unittest
from unittest.mock import patch
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import func, inspect, select, text
from sqlalchemy.engine import make_url

from app.config import Settings
from app.db import LearningActivity, Profile, XPLedger
from app.main import create_app
from app.migration_v8 import upgrade
from app.quizzes.api import instructor
from app.quizzes.models import QuizAttempt, QuizCommand, QuizRoom
from test_learning import fixture_catalog


class QuizTests(unittest.TestCase):
    postgres = False

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.schema = None
        url = f'sqlite+aiosqlite:///{self.temp.name}/quizzes.db'
        if self.postgres:
            import psycopg
            from psycopg import sql
            self.base_url = make_url(os.environ['TRADERS_EDGE_TEST_POSTGRES_URL'])
            if (self.base_url.drivername != 'postgresql+psycopg'
                    or self.base_url.host not in {'127.0.0.1', 'localhost', '::1'}
                    or not (self.base_url.database or '').startswith('traders_edge_qa')
                    or self.base_url.query):
                raise ValueError('PostgreSQL tests require a loopback disposable traders_edge_qa database without connection options')
            self.schema = 'traders_edge_qa_quizzes_' + uuid.uuid4().hex
            with psycopg.connect(self.base_url.set(drivername='postgresql').render_as_string(hide_password=False), autocommit=True) as connection:
                connection.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(self.schema)))
            url = self.base_url.update_query_dict({'options': f'-csearch_path={self.schema}'}).render_as_string(hide_password=False)
        self.settings = Settings(database_url=url)
        self.content = fixture_catalog()
        self.content['content_version'] = 'quiz-fixture-1'
        self.content['modules'][0]['lessons'][0]['questions'][0]['options'][0]['author_only'] = 'hidden-hint'
        self.app = create_app(self.settings, self.content)
        self.client = TestClient(self.app, headers={'Origin': 'http://localhost:5173'})
        self.client.__enter__()

        self.student_id = self.client.post('/api/session').json()['profile_id']
        self.teacher_app = create_app(self.settings, self.content)
        self.teacher = TestClient(self.teacher_app, headers={'Origin': 'http://localhost:5173'})
        self.teacher.__enter__()
        self.teacher_id = self.teacher.post('/api/session').json()['profile_id']
        self.app.state.settings = replace(self.settings, instructor_profile_ids=(self.teacher_id,))
        self.teacher_app.state.settings = self.app.state.settings

    def tearDown(self):
        self.teacher.__exit__(None, None, None)
        self.client.__exit__(None, None, None)
        if self.schema:
            import psycopg
            from psycopg import sql
            with psycopg.connect(self.base_url.set(drivername='postgresql').render_as_string(hide_password=False), autocommit=True) as connection:
                connection.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(self.schema)))
        self.temp.cleanup()

    def post(self, path, key='quiz-command-001', client=None, **payload):
        return (client or self.client).post('/api/quizzes/' + path, json={'idempotency_key': key, **payload})

    def room(self, key='create-room-key', **changes):
        body = {'title': 'Risk recognition', 'question_ids': ['m1-l1-q1', 'm1-l1-q2'], **changes}
        response = self.post('rooms', key, client=self.teacher, **body)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def joined_room(self, **changes):
        room = self.room(**changes)
        joined = self.post('rooms/join', 'join-room-key', join_code=room['join_code'])
        self.assertEqual(joined.status_code, 200, joined.text)
        started = self.post('rooms/' + room['id'] + '/start', 'start-room-key', client=self.teacher)
        self.assertEqual(started.status_code, 200, started.text)
        return room

    def finish(self, response, key_prefix='answer', wrong_first=False, client=None):
        result = response.json() if hasattr(response, 'json') else response
        index = 0
        while result['current_question']:
            question = result['current_question']
            answer = {'question_id': question['id'], 'option_id': 'risk' if wrong_first and index == 0 else 'protect', 'confidence': 60}
            response = self.post('attempts/' + result['id'] + '/answers', f'{key_prefix}-{index:03}', client=client, answer=answer)
            self.assertEqual(response.status_code, 200, response.text)
            result = response.json()
            if result['current_question']:
                self.assertIsNone(result['result'])
                self.assertNotIn('correct_option_id', str(result))
                self.assertNotIn('hidden-hint', str(result))
            index += 1
        return result

    def counts(self):
        async def read():
            async with self.app.state.db.sessions() as db:
                return tuple([await db.scalar(select(func.count()).select_from(model))
                              for model in (QuizAttempt, QuizCommand, XPLedger, LearningActivity)])
        return self.client.portal.call(read)

    def test_standalone_sequential_feedback_first_answer_and_once_xp(self):
        forms = self.client.get('/api/quizzes/forms')
        self.assertEqual(forms.status_code, 200, forms.text)
        self.assertEqual(len(forms.json()['forms']), 10)
        started = self.post('attempts', module_id='m1')
        self.assertEqual(started.status_code, 201, started.text)
        self.assertEqual(started.json(), self.post('attempts', module_id='m1').json())
        self.assertNotIn('correct_option_id', str(started.json()))
        self.assertNotIn('hidden-hint', str(started.json()))
        self.assertEqual(self.post('attempts', key='parallel-start-key', module_id='m1').status_code, 409)
        identifier = started.json()['id']
        invalid = self.post('attempts/' + identifier + '/answers', 'out-of-order-key',
                            answer={'question_id': 'm1-a1', 'option_id': 'protect'})
        self.assertEqual(invalid.status_code, 422)
        finished = self.finish(started)
        self.assertTrue(finished['result']['passed'])
        self.assertEqual(finished['result']['xp_earned'], 20)
        self.assertEqual(len(finished['result']['first_answers']), 9)
        self.assertEqual(finished['result']['first_answers'][0]['confidence'], 60)
        second = self.finish(self.post('attempts', 'second-attempt-key', module_id='m1'), key_prefix='second-answer')
        self.assertEqual(second['attempt_number'], 2)
        self.assertEqual(second['result']['xp_earned'], 0)
        self.assertEqual(self.counts()[2:], (1, 0))

    def test_wrong_critical_preserved_across_retry_and_limit(self):
        for index in range(3):
            started = self.post('attempts', f'attempt-limit-{index}', module_id='m1')
            self.assertEqual(started.status_code, 201, started.text)
            finished = self.finish(started, f'wrong-answer-{index}', wrong_first=True)
            self.assertFalse(finished['result']['passed'])
            self.assertEqual(finished['result']['score'], 89)
            self.assertFalse(finished['result']['critical_passed'])
            self.assertEqual(finished['result']['first_answers'][0]['option_id'], 'risk')
            self.assertEqual(finished['attempt_number'], index + 1)
        self.assertEqual(self.post('attempts', 'fourth-attempt-key', module_id='m1').status_code, 403)
        self.assertEqual(self.counts()[2:], (0, 0))

    def test_instructor_not_client_claimed_and_production_uses_verified_uid(self):
        for payload in ({'instructor': True}, {'role': 'teacher'}, {'instructor_profile_ids': [self.student_id]}):
            denied = self.post('rooms', title='Self promotion', question_ids=['m1-l1-q1'], **payload)
            self.assertEqual(denied.status_code, 422)
        self.assertEqual(self.post('rooms', title='Not authorized', question_ids=['m1-l1-q1']).status_code, 403)
        self.assertEqual(self.client.get('/api/quizzes/question-bank').status_code, 403)
        question_bank = self.teacher.get('/api/quizzes/question-bank')
        self.assertEqual(question_bank.status_code, 200)
        self.assertNotIn('correct_option_id', str(question_bank.json()))
        self.assertNotIn('hidden-hint', str(question_bank.json()))
        profile = Profile(id=self.teacher_id, firebase_uid='trusted-instructor')
        settings = replace(self.settings, environment='production', auth_mode='firebase',
                           instructor_profile_ids=(self.teacher_id,), instructor_firebase_uids=())
        self.assertFalse(instructor(settings, profile))
        self.assertTrue(instructor(replace(settings, instructor_firebase_uids=('trusted-instructor',)), profile))
        self.assertFalse(instructor(replace(settings, auth_mode='guest'), profile))

    def test_environment_instructor_allowlists_ignore_guest_ids_in_production(self):
        with patch.dict(os.environ, {'APP_ENV': 'development', 'INSTRUCTOR_FIREBASE_UIDS': ' teacher-one, teacher-two, ',
                                     'INSTRUCTOR_PROFILE_IDS': ' local-one, local-two, '}):
            development = Settings.from_env()
            self.assertEqual(development.instructor_firebase_uids, ('teacher-one', 'teacher-two'))
            self.assertEqual(development.instructor_profile_ids, ('local-one', 'local-two'))
        with patch.dict(os.environ, {'APP_ENV': 'production', 'INSTRUCTOR_FIREBASE_UIDS': ' teacher-one ',
                                     'INSTRUCTOR_PROFILE_IDS': 'local-one'}):
            production = Settings.from_env()
            self.assertEqual(production.instructor_firebase_uids, ('teacher-one',))
            self.assertEqual(production.instructor_profile_ids, ())

    def test_classroom_start_limits_results_ownership_and_no_xp(self):
        room = self.room()
        room_id = room['id']
        self.assertEqual(self.post('rooms/' + room_id + '/start', client=self.teacher).status_code, 409)
        self.assertEqual(self.post('attempts', room_id=room_id).status_code, 404)
        self.assertEqual(self.client.get('/api/quizzes/rooms/' + room_id).status_code, 404)
        self.assertEqual(self.post('rooms/join', 'join-once-room', join_code=room['join_code']).status_code, 200)
        self.assertEqual(self.post('attempts', room_id=room_id).status_code, 409)
        self.assertEqual(self.post('rooms/' + room_id + '/start', client=self.teacher).status_code, 200)
        started = self.post('attempts', room_id=room_id)
        self.assertEqual(started.status_code, 201, started.text)
        partial = self.post('attempts/' + started.json()['id'] + '/answers', 'room-first-answer',
                            answer={'question_id': 'm1-l1-q1', 'option_id': 'protect'})
        before = self.teacher.get('/api/quizzes/rooms/' + room_id + '/results')
        self.assertIsNone(before.json()['students'][0]['attempts'][0]['result'])
        self.assertNotIn('correct_option_id', str(before.json()))
        finished = self.finish(partial, 'room-next-answer')
        self.assertEqual(finished['result']['xp_earned'], 0)
        after = self.teacher.get('/api/quizzes/rooms/' + room_id + '/results')
        self.assertEqual(after.json()['students'][0]['attempts'][0]['result'], finished['result'])
        self.assertEqual(self.client.get('/api/quizzes/rooms/' + room_id + '/results').status_code, 403)
        self.assertEqual(self.teacher.get('/api/quizzes/attempts/' + started.json()['id']).status_code, 404)
        self.assertEqual(self.post('attempts', 'room-second-attempt', room_id=room_id).status_code, 403)
        self.assertEqual(self.counts()[2:], (0, 0))

    def test_instructor_cannot_view_another_room_or_standalone_answers(self):
        room = self.joined_room()
        another_app = create_app(self.app.state.settings, self.content)
        another_teacher = TestClient(another_app, headers={'Origin': 'http://localhost:5173'})
        with another_teacher:
            identifier = another_teacher.post('/api/session').json()['profile_id']
            self.app.state.settings = replace(self.settings, instructor_profile_ids=(self.teacher_id, identifier))
            another_app.state.settings = self.app.state.settings
            self.assertEqual(another_teacher.get('/api/quizzes/rooms/' + room['id'] + '/results').status_code, 404)
            self.assertEqual(self.post('rooms/' + room['id'] + '/close', client=another_teacher).status_code, 404)
        standalone = self.finish(self.post('attempts', module_id='m1'))
        self.assertEqual(self.teacher.get('/api/quizzes/attempts/' + standalone['id']).status_code, 404)
        self.assertEqual(self.teacher.get('/api/quizzes/attempts').json()['attempts'], [])

    def test_close_stops_answers_but_saved_answer_replays_and_evidence_remains(self):
        room = self.joined_room()
        start = self.post('attempts', room_id=room['id']).json()
        body = {'question_id': 'm1-l1-q1', 'option_id': 'risk', 'confidence': 25}
        answer = self.post('attempts/' + start['id'] + '/answers', 'closed-room-answer', answer=body)
        self.assertEqual(answer.status_code, 200, answer.text)
        self.assertEqual(self.post('rooms/' + room['id'] + '/close', client=self.teacher).status_code, 200)
        self.assertEqual(self.post('attempts/' + start['id'] + '/answers', 'closed-room-answer', answer=body).json(), answer.json())
        self.assertEqual(self.post('attempts/' + start['id'] + '/answers', 'new-closed-answer',
                                   answer={'question_id': 'm1-l1-q2', 'option_id': 'protect'}).status_code, 409)

        async def first():
            async with self.app.state.db.sessions() as db:
                return (await db.get(QuizAttempt, start['id'])).state_json['first_answers']
        self.assertEqual(self.client.portal.call(first)[0]['option_id'], 'risk')

    def test_snapshot_retirement_and_restart_committed_replay(self):
        first = self.post('attempts', module_id='m1').json()
        self.content['modules'][0]['lessons'][0]['questions'][0]['correct_option_id'] = 'risk'
        body = {'question_id': first['current_question']['id'], 'option_id': 'protect'}
        saved = self.post('attempts/' + first['id'] + '/answers', 'before-retirement', answer=body)
        result = self.finish(saved)
        self.assertTrue(result['result']['passed'])

        async def retire():
            async with self.app.state.db.sessions.begin() as db:
                attempt = await db.get(QuizAttempt, first['id'])
                attempt.snapshot_json = {**attempt.snapshot_json, 'version': 'retired'}
        self.client.portal.call(retire)
        self.assertEqual(self.post('attempts/' + first['id'] + '/answers', 'before-retirement', answer=body).json(), saved.json())
        self.assertEqual(self.client.get('/api/quizzes/attempts/' + first['id']).status_code, 409)
        self.assertEqual(self.post('attempts/' + first['id'] + '/answers', 'before-retirement',
                                   answer={**body, 'option_id': 'risk'}).status_code, 409)
        app = create_app(self.settings, self.content)
        with TestClient(app, headers={'Origin': 'http://localhost:5173'}) as restarted:
            restarted.cookies.update(self.client.cookies)
            self.assertEqual(self.post('attempts/' + first['id'] + '/answers', 'before-retirement',
                                       client=restarted, answer=body).json(), saved.json())

    def test_duplicate_unknown_room_questions_and_client_results_rejected(self):
        for questions in (['missing'], ['m1-l1-q1', 'm1-l1-q1']):
            self.assertEqual(self.post('rooms', client=self.teacher, title='Invalid', question_ids=questions).status_code, 422)
        self.assertEqual(self.post('rooms', client=self.teacher, title='Invalid', question_ids=['m1-l1-q1'], attempt_limit=True).status_code, 422)
        self.assertEqual(self.post('attempts', module_id='m1', room_id='unknown').status_code, 422)
        self.assertEqual(self.post('attempts', module_id='m1', passed=True).status_code, 422)
        self.assertEqual(self.post('attempts').status_code, 422)
        self.assertEqual(self.counts(), (0, 0, 0, 0))

    def test_cross_worker_answer_replay_and_single_record(self):
        first = self.post('attempts', module_id='m1').json()
        app = create_app(self.settings, self.content)
        with TestClient(app, headers={'Origin': 'http://localhost:5173'}) as second:
            second.cookies.update(self.client.cookies)
            body = {'question_id': first['current_question']['id'], 'option_id': 'protect', 'confidence': 90}
            with ThreadPoolExecutor(max_workers=2) as pool:
                responses = list(pool.map(lambda client: self.post('attempts/' + first['id'] + '/answers',
                        'cross-worker-answer', client=client, answer=body), (self.client, second)))
            self.assertEqual([response.status_code for response in responses], [200, 200])
            self.assertEqual(responses[0].json(), responses[1].json())
            self.assertEqual(responses[0].json()['progress']['answered'], 1)

    def test_final_answer_xp_and_result_roll_back_if_receipt_cannot_be_saved(self):
        started = self.post('attempts', module_id='m1').json()
        current = started
        for index in range(8):
            question = current['current_question']
            current = self.post('attempts/' + started['id'] + '/answers', f'rollback-answer-{index}',
                                answer={'question_id': question['id'], 'option_id': 'protect'}).json()
        body = {'question_id': current['current_question']['id'], 'option_id': 'protect'}

        async def fail(*_):
            raise RuntimeError('receipt write failed')
        with patch('app.quizzes.api.remember', fail):
            with self.assertRaisesRegex(RuntimeError, 'receipt write failed'):
                self.post('attempts/' + started['id'] + '/answers', 'rollback-final-answer', answer=body)
        resumed = self.client.get('/api/quizzes/attempts/' + started['id']).json()
        self.assertEqual(resumed['progress']['answered'], 8)
        self.assertIsNone(resumed['result'])
        self.assertEqual(self.counts()[2:], (0, 0))
        finished = self.post('attempts/' + started['id'] + '/answers', 'rollback-final-answer', answer=body)
        self.assertEqual(finished.json()['result']['xp_earned'], 20)
        self.assertEqual(self.counts()[2:], (1, 0))

    def test_migration_repeat_keeps_populated_quiz_and_prior_tables(self):
        self.joined_room()
        self.finish(self.post('attempts', module_id='m1'))

        async def verify():
            async with self.app.state.db.engine.begin() as connection:
                tables = await connection.run_sync(lambda sync: inspect(sync).get_table_names())
                before = {table: (await connection.execute(text('SELECT * FROM "' + table + '"'))).all() for table in tables}
                await upgrade(connection)
                await upgrade(connection)
                after = {table: (await connection.execute(text('SELECT * FROM "' + table + '"'))).all() for table in tables}
                self.assertEqual(before, after)
        self.client.portal.call(verify)

    def test_retired_room_exact_start_replay_but_fresh_attempt_rejected(self):
        room = self.joined_room()
        first = self.post('attempts', room_id=room['id'])
        self.assertEqual(first.status_code, 201, first.text)

        async def retire():
            async with self.app.state.db.sessions.begin() as db:
                saved = await db.get(QuizRoom, room['id'])
                saved.snapshot_json = {**saved.snapshot_json, 'version': 'retired'}
        self.client.portal.call(retire)
        self.assertEqual(first.json(), self.post('attempts', room_id=room['id']).json())
        self.assertEqual(self.post('attempts', 'fresh-retired-attempt', room_id=room['id']).status_code, 409)

    def test_unapproved_saved_content_blocks_fresh_access_but_preserves_receipts(self):
        room = self.joined_room()
        started = self.post('attempts', room_id=room['id'])
        identifier = started.json()['id']
        body = {'question_id': 'm1-l1-q1', 'option_id': 'protect', 'confidence': 75}
        saved = self.post('attempts/' + identifier + '/answers', 'publication-answer', answer=body)
        self.assertEqual(saved.status_code, 200, saved.text)
        self.app.state.settings = replace(self.app.state.settings, environment='production')
        self.teacher_app.state.settings = self.app.state.settings
        self.assertEqual(self.post('attempts', room_id=room['id']).json(), started.json())
        self.assertEqual(self.post('attempts/' + identifier + '/answers', 'publication-answer', answer=body).json(), saved.json())
        self.assertEqual(self.client.get('/api/quizzes/attempts/' + identifier).status_code, 503)
        self.assertEqual(self.client.get('/api/quizzes/rooms/' + room['id']).status_code, 503)
        self.assertEqual(self.teacher.get('/api/quizzes/rooms/' + room['id']).status_code, 503)
        self.assertEqual(self.post('rooms/join', 'fresh-publication-join', join_code=room['join_code']).status_code, 503)
        self.assertEqual(self.post('attempts', 'fresh-publication-room', room_id=room['id']).status_code, 503)
        self.assertEqual(self.post('attempts', 'fresh-publication-form', module_id='m1').status_code, 503)
        self.content['review_status'] = 'approved'
        for module in self.content['modules']:
            module['review_status'] = 'approved'
            for lesson in module['lessons']:
                lesson['review_status'] = 'approved'
        self.assertEqual(self.post('attempts', 'approved-current-form', module_id='m2').status_code, 201)
        self.assertEqual(self.client.get('/api/quizzes/attempts/' + identifier).status_code, 503)
        self.assertEqual(self.post('attempts/' + identifier + '/answers', 'fresh-publication-answer',
                                   answer={'question_id': 'm1-l1-q2', 'option_id': 'protect'}).status_code, 503)
        self.assertEqual(self.counts()[2:], (0, 0))

    def test_approved_snapshot_retains_its_publication_status_after_catalog_changes(self):
        self.content['review_status'] = 'approved'
        for module in self.content['modules']:
            module['review_status'] = 'approved'
            for lesson in module['lessons']:
                lesson['review_status'] = 'approved'
        started = self.post('attempts', module_id='m1').json()
        self.content['review_status'] = 'draft'
        self.app.state.settings = replace(self.app.state.settings, environment='production')
        self.assertEqual(self.client.get('/api/quizzes/attempts/' + started['id']).status_code, 200)
        self.assertTrue(self.finish(started)['result']['passed'])
        self.assertEqual(self.post('attempts', 'fresh-draft-form', module_id='m1').status_code, 503)

    def test_new_catalog_edition_has_its_own_attempt_limit_and_reward(self):
        for index in range(3):
            result = self.finish(self.post('attempts', f'old-edition-start-{index}', module_id='m1'),
                                 f'old-edition-answer-{index}')
            self.assertEqual(result['attempt_number'], index + 1)
        self.assertEqual(self.post('attempts', 'old-edition-fourth', module_id='m1').status_code, 403)
        self.content['content_version'] = 'quiz-fixture-2'
        started = self.post('attempts', 'new-edition-start', module_id='m1')
        self.assertEqual(started.status_code, 201, started.text)
        self.assertEqual(started.json()['attempt_number'], 1)
        self.assertEqual(started.json()['content_version'], 'quiz-fixture-2')
        self.assertEqual(self.finish(started, 'new-edition-answer')['result']['xp_earned'], 20)
        self.assertEqual(self.counts()[2:], (2, 0))

    def test_retired_room_join_and_detail_reject_fresh_requests(self):
        room = self.room()
        body = {'join_code': room['join_code']}
        saved = self.post('rooms/join', 'retired-join-receipt', **body)
        self.assertEqual(saved.status_code, 200, saved.text)

        async def retire():
            async with self.app.state.db.sessions.begin() as db:
                stored = await db.get(QuizRoom, room['id'])
                stored.snapshot_json = {**stored.snapshot_json, 'version': 'retired'}
        self.client.portal.call(retire)
        self.assertEqual(self.post('rooms/join', 'retired-join-receipt', **body).json(), saved.json())
        self.assertEqual(self.post('rooms/join', 'retired-join-fresh', **body).status_code, 409)
        self.assertEqual(self.client.get('/api/quizzes/rooms/' + room['id']).status_code, 409)
        self.assertEqual(self.teacher.get('/api/quizzes/rooms/' + room['id']).status_code, 409)
        self.assertEqual(self.teacher.get('/api/quizzes/rooms/' + room['id'] + '/results').status_code, 409)

    def test_cross_worker_start_cannot_exceed_three_attempts(self):
        for index in range(2):
            self.finish(self.post('attempts', f'completed-start-{index}', module_id='m1'),
                        f'completed-answer-{index}')
        app = create_app(self.settings, self.content)
        with TestClient(app, headers={'Origin': 'http://localhost:5173'}) as second:
            second.cookies.update(self.client.cookies)
            clients = (self.client, second)
            with ThreadPoolExecutor(max_workers=2) as pool:
                responses = list(pool.map(lambda index: self.post('attempts', f'final-start-race-{index}',
                            client=clients[index], module_id='m1'), range(2)))
            self.assertEqual(sorted(response.status_code for response in responses), [201, 403])
            winner = next(index for index, response in enumerate(responses) if response.status_code == 201)
            self.assertEqual(self.post('attempts', f'final-start-race-{winner}',
                                      client=clients[winner], module_id='m1').json(), responses[winner].json())
        self.assertEqual(self.counts()[0], 3)


@unittest.skipUnless(os.getenv('TRADERS_EDGE_TEST_POSTGRES_URL'), 'Disposable PostgreSQL test URL not configured')
class QuizPostgreSQLTests(QuizTests):
    postgres = True


if __name__ == '__main__':
    unittest.main()
