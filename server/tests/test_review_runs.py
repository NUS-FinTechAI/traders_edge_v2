from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from dataclasses import replace
from datetime import datetime, timedelta, timezone
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import event, select

from app.config import Settings
from app.content.catalog import load_catalog
from app.db import Attempt, LearningRun, LearningRunCommand, LessonCompletion, MasteredModule, Profile, ReviewItem, XPLedger, aware, now, uid
from app.main import create_app


class ReviewRunTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.settings = Settings(database_url=f'sqlite+aiosqlite:///{self.temp.name}/reviews.db')
        self.content = load_catalog()
        self.module = self.content['modules'][0]
        self.lesson = self.module['lessons'][0]
        self.app = create_app(self.settings, self.content)
        self.client = TestClient(self.app, headers={'Origin': 'http://localhost:5173'})
        self.client.__enter__()
        self.client.post('/api/session')
        self.user_id = self.client.get('/api/me/profile').json()['id']
        self.counter = 0
        self.review_id = self.seed_review(self.lesson['id'])

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.temp.cleanup()

    def key(self):
        self.counter += 1
        return f'review-command-{self.counter}'

    def seed_review(self, lesson_id, completion=True):
        async def seed():
            async with self.app.state.db.sessions.begin() as db:
                attempt_id, review_id = uid(), uid()
                db.add(Attempt(id=attempt_id, user_id=self.user_id, kind='lesson', target_id=lesson_id, idempotency_key=uid(), request_hash='a' * 64, answers=[], reflection='Historical lesson reflection', score=100, passed=True, result={'historical': True}))
                await db.flush()
                if completion:
                    db.add(LessonCompletion(user_id=self.user_id, lesson_id=lesson_id, attempt_id=attempt_id, completed_at=now() - timedelta(days=30)))
                db.add(ReviewItem(id=review_id, user_id=self.user_id, lesson_id=lesson_id, due_at=now() - timedelta(hours=1)))
                return review_id
        return self.client.portal.call(seed)

    def due_at(self, value):
        async def update():
            async with self.app.state.db.sessions.begin() as db:
                item = await db.get(ReviewItem, self.review_id)
                item.due_at = value
        self.client.portal.call(update)

    def start(self, body=None, client=None):
        response = (client or self.client).post(f'/api/reviews/{self.review_id}/runs', json=body or {'idempotency_key': self.key()})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def answer(self, question, wrong=False):
        selected = question['correct_option_id']
        if wrong:
            selected = next(o['id'] for o in question['options'] if o['id'] != selected)
        return {'option_id': selected, 'confidence': 60}

    def submit(self, run, index, wrong=False, body=None, client=None):
        question = self.lesson['questions'][index]
        response = (client or self.client).post(f"/api/learning-runs/{run['id']}/steps/{question['id']}/submit", json=body or {'idempotency_key': self.key(), 'answer': self.answer(question, wrong)})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def finish(self, run, wrong=False):
        for index in range(len(self.lesson['questions'])):
            run = self.submit(run, index, wrong and index == 0)
        return run

    def records(self, run_id, command_key=None):
        async def read():
            async with self.app.state.db.sessions() as db:
                run = await db.get(LearningRun, run_id)
                item = await db.get(ReviewItem, self.review_id)
                attempts = (await db.scalars(select(Attempt).where(Attempt.kind == 'review', Attempt.user_id == self.user_id))).all()
                rewards = (await db.scalars(select(XPLedger).where(XPLedger.user_id == self.user_id, XPLedger.event_key == 'review:' + self.lesson['id']))).all()
                command = await db.get(LearningRunCommand, (self.user_id, command_key)) if command_key else None
                return deepcopy(run.state_json), run.status, aware(item.due_at), item.completed_at, len(attempts), len(rewards), command.response if command else None
        return self.client.portal.call(read)

    def test_review_option_metadata_stays_private_across_resume_and_replay(self):
        from app.content.validate import validate_catalog
        self.lesson['questions'][0]['options'][0]['author_only'] = {'answer_hint': 'private-review-hint'}
        validate_catalog(self.content)
        body = {'idempotency_key': self.key()}
        path = f'/api/reviews/{self.review_id}/runs'
        response = self.client.post(path, json=body)
        self.assertEqual(response.status_code, 200, response.text)
        run = response.json()
        for response in (response, self.client.get('/api/learning-runs/' + run['id']), self.client.get('/api/me/workflow'), self.client.post(path, json=body)):
            self.assertEqual(response.status_code, 200, response.text)
            self.assertNotIn('author_only', response.text)
            self.assertNotIn('private-review-hint', response.text)
        self.assertEqual(self.client.post(path, json=body).json(), run)

    def test_due_boundary_utc_and_early_403(self):
        boundary = datetime.now(timezone.utc).replace(microsecond=0)
        self.due_at(boundary)
        with patch('app.learning_runs.now', return_value=boundary - timedelta(microseconds=1)), patch('app.learning.now', return_value=boundary - timedelta(microseconds=1)):
            response = self.client.post(f'/api/reviews/{self.review_id}/runs', json={'idempotency_key': self.key()})
            self.assertEqual(response.status_code, 403)
            self.assertFalse(self.client.get('/api/reviews').json()['reviews'][0]['due'])
        offset = boundary.astimezone(timezone(timedelta(hours=5, minutes=30)))
        with patch('app.learning_runs.now', return_value=offset), patch('app.learning.now', return_value=offset):
            run = self.start()
            self.assertEqual(run['purpose'], 'review')
            self.assertTrue(self.client.get('/api/reviews').json()['reviews'][0]['due'])

    def test_feedback_withheld_first_answers_frozen_and_restart(self):
        run = self.start()
        last = self.lesson['questions'][-1]
        skipped = self.client.post(f"/api/learning-runs/{run['id']}/steps/{last['id']}/submit", json={'idempotency_key': self.key(), 'answer': self.answer(last)})
        self.assertEqual(skipped.status_code, 409)
        partial = self.submit(run, 0, wrong=True)
        self.assertEqual(partial['progress']['completed_steps'], 1)
        self.assertEqual(partial['feedback'], [])
        self.assertIsNone(partial['result'])
        first = self.lesson['questions'][0]
        frozen = self.client.post(f"/api/learning-runs/{run['id']}/steps/{first['id']}/submit", json={'idempotency_key': self.key(), 'answer': self.answer(first)})
        self.assertEqual(frozen.status_code, 409)
        with TestClient(create_app(self.settings, self.content), headers={'Origin': 'http://localhost:5173'}) as restarted:
            restarted.cookies.set(self.settings.cookie_name, self.client.cookies.get(self.settings.cookie_name))
            self.assertEqual(restarted.get('/api/learning-runs/' + run['id']).json(), partial)
            self.assertEqual(self.start(client=restarted), partial)
            self.assertEqual(restarted.get('/api/me/workflow').json()['resume'], partial)
            result = self.submit(run, 1, client=restarted)
        self.assertFalse(result['result']['passed'])
        self.assertEqual(len(result['feedback']), 2)
        state = self.records(run['id'])[0]
        self.assertFalse(state['first_responses'][first['id']]['correct'])
        self.assertEqual(len(state['responses']), 2)

    def test_wrong_review_pinned_reschedule_retains_progress_and_practice(self):
        self.lesson['review_after_days'] = 3
        async def master():
            async with self.app.state.db.sessions.begin() as db:
                completion = await db.get(LessonCompletion, (self.user_id, self.lesson['id']))
                db.add(MasteredModule(user_id=self.user_id, module_id=self.module['id'], attempt_id=completion.attempt_id))
        self.client.portal.call(master)
        baseline = self.client.post(f"/api/modules/{self.module['id']}/diagnostic-runs", json={'idempotency_key': self.key()}).json()
        for task in self.module['entry_tasks']:
            self.assertEqual(self.client.post(f"/api/learning-runs/{baseline['id']}/steps/{task['id']}/submit", json={'idempotency_key': self.key(), 'answer': self.answer(task)}).status_code, 200)
        run = self.start()
        self.lesson['review_after_days'] = 9
        instant = now()
        with patch('app.learning_runs.now', return_value=instant):
            failed = self.finish(run, wrong=True)
        self.assertFalse(failed['result']['passed'])
        self.assertEqual(failed['result']['xp_awarded'], 0)
        self.assertFalse(failed['result']['standard_star'])
        self.assertFalse(failed['result']['bonus_star'])
        self.assertIn(self.lesson['id'], failed['result']['profile']['completed_lesson_ids'])
        self.assertIn(self.module['id'], failed['result']['profile']['mastered_module_ids'])
        self.assertEqual(self.records(run['id'])[2], instant + timedelta(days=3))
        self.assertEqual(self.client.post(f'/api/reviews/{self.review_id}/runs', json={'idempotency_key': self.key()}).status_code, 403)
        self.assertEqual(self.client.post(f"/api/levels/{self.lesson['id']}/runs", json={'idempotency_key': self.key()}).status_code, 200)
        with patch('app.learning_runs.now', return_value=instant + timedelta(days=3)):
            retry = self.start()
        self.assertNotEqual(retry['id'], run['id'])

    def test_success_once_no_stars_owned_completed_feedback(self):
        done = self.finish(self.start())
        self.assertTrue(done['result']['passed'])
        self.assertEqual(done['result']['xp_awarded'], 10)
        self.assertFalse(done['result']['standard_star'])
        self.assertFalse(done['result']['bonus_star'])
        self.assertIsNotNone(self.records(done['id'])[3])
        self.assertEqual(self.records(done['id'])[4:6], (1, 1))
        self.assertEqual(self.client.get('/api/learning-runs/' + done['id']).json(), done)
        attempt = self.client.get('/api/attempts/' + done['result']['attempt_id']).json()
        self.assertEqual(attempt['feedback'], done['feedback'])
        self.assertEqual(self.client.post(f'/api/reviews/{self.review_id}/runs', json={'idempotency_key': self.key()}).status_code, 409)
        self.client.cookies.clear()
        self.client.post('/api/session')
        for path in (f'/api/reviews/{self.review_id}', '/api/learning-runs/' + done['id'], '/api/attempts/' + done['result']['attempt_id']):
            self.assertEqual(self.client.get(path).status_code, 403)
        self.assertEqual(self.client.post(f'/api/reviews/{self.review_id}/runs', json={'idempotency_key': self.key()}).status_code, 403)
        task = self.lesson['questions'][0]
        self.assertEqual(self.client.post(f"/api/learning-runs/{done['id']}/steps/{task['id']}/submit", json={'idempotency_key': self.key(), 'answer': self.answer(task)}).status_code, 403)

    def test_replay_before_reschedule_completion_retirement_and_key_conflicts(self):
        start_body = {'idempotency_key': self.key()}
        initial = self.start(start_body)
        first_body = {'idempotency_key': self.key(), 'answer': self.answer(self.lesson['questions'][0], True)}
        partial = self.submit(initial, 0, body=first_body)
        self.submit(initial, 1)
        self.assertEqual(self.start(start_body), initial)
        self.due_at(now() - timedelta(seconds=1))
        second_body = {'idempotency_key': self.key()}
        second = self.start(second_body)
        complete = self.finish(second)
        self.content['modules'] = []
        async def retire():
            async with self.app.state.db.sessions.begin() as db:
                run = await db.get(LearningRun, initial['id'])
                run.snapshot_json = {**run.snapshot_json, 'rubric_version': 'retired'}
                db.add(Profile(id='retired-owner'))
                await db.flush()
                item = await db.get(ReviewItem, self.review_id)
                item.user_id = 'retired-owner'
        self.client.portal.call(retire)
        self.assertEqual(self.start(start_body), initial)
        self.assertEqual(self.start(second_body), second)
        self.assertEqual(self.submit(initial, 0, body=first_body), partial)
        self.assertEqual(self.client.get('/api/learning-runs/' + complete['id']).json(), complete)
        path = f"/api/learning-runs/{initial['id']}/steps/{self.lesson['questions'][0]['id']}/submit"
        self.assertEqual(self.client.post(path, json={**first_body, 'answer': self.answer(self.lesson['questions'][0])}).status_code, 409)
        self.assertEqual(self.client.post('/api/reviews/other-review/runs', json=start_body).status_code, 409)
        self.assertEqual(self.client.post(path, json={'idempotency_key': start_body['idempotency_key'], 'answer': self.answer(self.lesson['questions'][0])}).status_code, 409)

    def test_two_workers_final_submission_different_keys_and_same_key_replay(self):
        run = self.submit(self.start(), 0)
        task = self.lesson['questions'][1]
        path = f"/api/learning-runs/{run['id']}/steps/{task['id']}/submit"
        bodies = [{'idempotency_key': self.key(), 'answer': self.answer(task)} for _ in range(2)]
        with TestClient(create_app(self.settings, self.content), headers={'Origin': 'http://localhost:5173'}) as worker:
            worker.cookies.set(self.settings.cookie_name, self.client.cookies.get(self.settings.cookie_name))
            with ThreadPoolExecutor(max_workers=2) as pool:
                responses = list(pool.map(lambda pair: pair[0].post(path, json=pair[1]), zip((self.client, worker), bodies)))
        self.assertEqual(sorted(r.status_code for r in responses), [200, 409])
        winner = next(i for i, r in enumerate(responses) if r.status_code == 200)
        result = responses[winner].json()
        self.assertEqual(result['result']['xp_awarded'], 10)
        self.assertEqual(self.client.post(path, json=bodies[winner]).json(), result)
        self.assertEqual(self.records(run['id'], bodies[winner]['idempotency_key'])[4:], (1, 1, result))

    def test_final_command_failure_rolls_back_queue_attempt_run_and_xp(self):
        run = self.submit(self.start(), 0)
        before = self.records(run['id'])
        from app.learning_runs import remember
        async def fail_after_flush(*args):
            await remember(*args)
            raise RuntimeError('Injected final response failure')
        body = {'idempotency_key': self.key(), 'answer': self.answer(self.lesson['questions'][1])}
        path = f"/api/learning-runs/{run['id']}/steps/{self.lesson['questions'][1]['id']}/submit"
        with patch('app.learning_runs.remember', side_effect=fail_after_flush):
            with self.assertRaisesRegex(RuntimeError, 'Injected final response failure'):
                self.client.post(path, json=body)
        self.assertEqual(self.records(run['id'], body['idempotency_key']), before)
        done = self.client.post(path, json=body)
        self.assertEqual(done.status_code, 200, done.text)
        self.assertEqual(done.json()['result']['xp_awarded'], 10)

    def legacy_body(self):
        return {'idempotency_key': self.key(), 'answers': [{'question_id': q['id'], 'option_id': q['correct_option_id']} for q in self.lesson['questions']], 'reflection': 'Original legacy review reflection.'}

    def test_canonical_legacy_bypass_blocked_and_old_response_preserved(self):
        path = f'/api/reviews/{self.review_id}/submit'
        self.assertEqual(self.client.post(path, json=self.legacy_body()).status_code, 403)
        entry_tasks = self.module.pop('entry_tasks')
        body = self.legacy_body()
        stored = self.client.post(path, json=body)
        self.assertEqual(stored.status_code, 200, stored.text)
        self.module['entry_tasks'] = entry_tasks
        self.content['modules'] = []
        self.assertEqual(self.client.post(path, json=body).json(), stored.json())
        self.assertEqual(self.client.post(path, json={**body, 'reflection': 'A changed reflection conflicts.'}).status_code, 409)

    def test_unversioned_fixture_legacy_compatibility(self):
        self.content.pop('content_version')
        response = self.client.post(f'/api/reviews/{self.review_id}/submit', json=self.legacy_body())
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(response.json()['passed'])
        self.assertFalse(self.client.get('/api/reviews').json()['reviews'][0]['interactive_required'])

    def test_completion_and_earlier_module_policy_without_new_baseline(self):
        run = self.start()
        self.assertEqual(run['purpose'], 'review')
        module2_lesson = self.content['modules'][1]['lessons'][0]
        review2 = self.seed_review(module2_lesson['id'])
        self.assertEqual(self.client.post(f'/api/reviews/{review2}/runs', json={'idempotency_key': self.key()}).status_code, 403)
        orphan = self.seed_review(self.module['lessons'][1]['id'], completion=False)
        self.assertEqual(self.client.post(f'/api/reviews/{orphan}/runs', json={'idempotency_key': self.key()}).status_code, 403)

    def test_forced_choice_publication_and_invalid_pinned_content(self):
        self.lesson['questions'][0]['type'] = 'instruction'
        run = self.start()
        self.assertEqual(run['current_step']['type'], 'choice')
        task = self.lesson['questions'][0]
        path = f"/api/learning-runs/{run['id']}/steps/{task['id']}/submit"
        self.assertEqual(self.client.post(path, json={'idempotency_key': self.key(), 'answer': {'acknowledged': True}}).status_code, 422)
        async def corrupt():
            async with self.app.state.db.sessions.begin() as db:
                stored = await db.get(LearningRun, run['id'])
                stored.snapshot_json = {**stored.snapshot_json, 'review_after_days': 0}
        self.client.portal.call(corrupt)
        self.assertEqual(self.client.get('/api/learning-runs/' + run['id']).status_code, 409)
        self.assertEqual(self.client.post(path, json={'idempotency_key': self.key(), 'answer': self.answer(task)}).status_code, 409)
        self.assertEqual(self.records(run['id'])[4:6], (0, 0))

    def test_pinned_publication_content_retirement_and_active_resume(self):
        self.app.state.settings = replace(self.settings, environment='production')
        path = f'/api/reviews/{self.review_id}/runs'
        self.assertEqual(self.client.post(path, json={'idempotency_key': self.key()}).status_code, 503)
        self.content['review_status'] = 'approved'
        for module in self.content['modules']:
            module['review_status'] = 'approved'
            for lesson in module['lessons']:
                lesson['review_status'] = 'approved'
        initial = self.start()
        async def snapshot():
            async with self.app.state.db.sessions() as db:
                return deepcopy((await db.get(LearningRun, initial['id'])).snapshot_json)
        pinned = self.client.portal.call(snapshot)
        self.assertTrue(pinned['approved'])
        self.assertEqual(pinned['lesson_id'], self.lesson['id'])
        self.assertEqual(pinned['review_id'], self.review_id)
        self.assertEqual(pinned['rubric_version'], 'interactive-1')
        self.assertEqual(pinned['tasks'], [{**q, 'type': 'choice'} for q in self.lesson['questions']])
        partial = self.submit(initial, 0)
        self.content['modules'] = []
        self.content['content_version'] = 'retired'
        self.assertEqual(self.start(), partial)
        done = self.submit(initial, 1)
        self.assertEqual(self.client.get('/api/learning-runs/' + initial['id']).json(), done)
        self.assertEqual(self.client.get('/api/reviews/' + self.review_id).json()['run_id'], initial['id'])
        self.assertEqual(self.client.portal.call(snapshot), pinned)
        self.assertEqual(done['content_version'], initial['content_version'])

    def test_noncritical_error_fails_and_failure_reschedule_rolls_back(self):
        self.lesson['questions'][1]['critical'] = False
        run = self.submit(self.start(), 0)
        before = self.records(run['id'])
        task = self.lesson['questions'][1]
        body = {'idempotency_key': self.key(), 'answer': self.answer(task, True)}
        path = f"/api/learning-runs/{run['id']}/steps/{task['id']}/submit"
        from app.learning_runs import remember
        async def fail_after_flush(*args):
            await remember(*args)
            raise RuntimeError('Injected reschedule failure')
        with patch('app.learning_runs.remember', side_effect=fail_after_flush):
            with self.assertRaisesRegex(RuntimeError, 'Injected reschedule failure'):
                self.client.post(path, json=body)
        self.assertEqual(self.records(run['id'], body['idempotency_key']), before)
        result = self.client.post(path, json=body).json()
        self.assertTrue(result['result']['critical_items_passed'])
        self.assertFalse(result['result']['passed'])
        self.assertEqual(result['result']['score_percent'], 50)
        self.assertEqual(self.client.post(path, json=body).json(), result)
        self.assertEqual(self.records(run['id'])[4:6], (1, 0))

    def test_preexisting_review_reward_is_not_duplicated_and_attempt_has_no_essay(self):
        async def rewarded():
            async with self.app.state.db.sessions.begin() as db:
                db.add(XPLedger(user_id=self.user_id, event_key='review:' + self.lesson['id'], amount=10, reason='Historical review reward'))
        self.client.portal.call(rewarded)
        result = self.finish(self.start())
        self.assertEqual(result['result']['xp_awarded'], 0)
        self.assertEqual(self.records(result['id'])[4:6], (1, 1))
        async def attempt():
            async with self.app.state.db.sessions() as db:
                stored = await db.get(Attempt, result['result']['attempt_id'])
                return stored.target_id, stored.kind, stored.reflection, stored.answers
        target, kind, reflection, answers = self.client.portal.call(attempt)
        self.assertEqual((target, kind, reflection), (self.review_id, 'review', ''))
        self.assertEqual(len(answers), 2)
        self.assertEqual(answers[0]['answer']['confidence'], 60)

    def test_review_list_get_and_workflow_bounded_queries_no_keys(self):
        run = self.submit(self.start(), 0)
        counts = []
        def count(connection, cursor, statement, parameters, context, executemany):
            if statement.lstrip().upper().startswith('SELECT'):
                counts.append(statement)
        event.listen(self.app.state.db.engine.sync_engine, 'before_cursor_execute', count)
        try:
            listed = self.client.get('/api/reviews')
            first_count = len(counts)
            detail = self.client.get('/api/reviews/' + self.review_id)
            self.assertEqual(detail.status_code, 200, detail.text)
            row = listed.json()['reviews'][0]
            self.assertEqual(detail.json(), row)
            self.assertEqual(row['run_id'], run['id'])
            self.assertEqual(row['active_run_id'], run['id'])
            self.assertTrue(row['interactive_required'])
            self.assertFalse(row['reflection_required'])
            for module in self.content['modules']:
                for lesson in module['lessons']:
                    if lesson['id'] != self.lesson['id']:
                        self.seed_review(lesson['id'])
            counts.clear()
            many = self.client.get('/api/reviews')
            self.assertEqual(len(many.json()['reviews']), 30)
            self.assertEqual(len(counts), first_count)
            self.assertLessEqual(first_count, 5)
            counts.clear()
            workflow = self.client.get('/api/me/workflow')
            self.assertEqual(workflow.status_code, 200)
            self.assertLessEqual(len(counts), 10)
            for value in (listed.json(), detail.json(), run, workflow.json()):
                for field in ('correct_option_id', 'correct_assignments', 'first_responses', 'snapshot_json', 'rubric_version'):
                    self.assertNotIn(field, str(value))
            self.assertEqual(workflow.json()['resume']['feedback'], [])
        finally:
            event.remove(self.app.state.db.engine.sync_engine, 'before_cursor_execute', count)
