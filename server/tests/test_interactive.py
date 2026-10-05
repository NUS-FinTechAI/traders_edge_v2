from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from dataclasses import replace
import tempfile
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import Settings
from app.content.catalog import load_catalog
from app.main import create_app


class InteractiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.settings = Settings(database_url=f'sqlite+aiosqlite:///{self.temp.name}/runs.db')
        self.content = load_catalog()
        self.module = self.content['modules'][0]
        self.mid = self.module['id']
        self.app = create_app(self.settings, self.content)
        self.client = TestClient(self.app, headers={'Origin': 'http://localhost:5173'})
        self.client.__enter__()
        self.client.post('/api/session')
        self.counter = 0

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.temp.cleanup()

    def key(self):
        self.counter += 1
        return f'interactive-{self.counter}'

    def start(self, path, **extra):
        response = self.client.post('/api/' + path, json={'idempotency_key': self.key(), **extra})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def answer(self, task, wrong=False):
        if task['type'] == 'instruction':
            return {'acknowledged': True}
        if task['type'] == 'choice':
            option = task['correct_option_id']
            if wrong:
                option = next(o['id'] for o in task['options'] if o['id'] != option)
            return {'option_id': option, 'confidence': 60}
        assignments = deepcopy(task['correct_assignments'])
        if wrong:
            item = next(iter(assignments))
            assignments[item] = next(c['id'] for c in task['categories'] if c['id'] != assignments[item])
        return {'assignments': assignments}

    def submit(self, run, task, wrong=False):
        response = self.client.post(f"/api/learning-runs/{run['id']}/steps/{task['id']}/submit", json={'idempotency_key': self.key(), 'answer': self.answer(task, wrong)})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def finish(self, run, tasks, wrong=()):
        for index, task in enumerate(tasks):
            run = self.submit(run, task, index in wrong)
            if run['purpose'] in ('diagnostic', 'assessment') and index < len(tasks) - 1:
                self.assertEqual(run['feedback'], [])
                self.assertIsNone(run['result'])
                self.assertNotIn('correct', str(run))
        self.assertEqual(run['status'], 'completed')
        return run

    def baseline(self, wrong=()):
        result = self.finish(self.start(f'modules/{self.mid}/diagnostic-runs'), self.module['entry_tasks'], wrong)
        self.assertIsNone(result['result']['passed'])
        return result

    def lessons(self):
        results = []
        for lesson in self.module['lessons']:
            results.append(self.finish(self.start(f"levels/{lesson['id']}/runs"), lesson['tasks']))
        return results

    def test_complete_happy_flow_bonus_independent_and_repeat_xp(self):
        self.baseline()
        first = self.module['lessons'][0]
        runs = self.lessons()
        self.assertEqual([r['result']['xp_awarded'] for r in runs], [20, 20, 20])
        mapping = self.client.get(f'/api/modules/{self.mid}/map').json()
        self.assertTrue(mapping['assessment_available'])
        self.assertTrue(all(n['standard_star'] and not n['bonus_star'] for n in mapping['levels']))
        bonus = self.finish(self.start(f"levels/{first['id']}/runs", purpose='bonus'), first['bonus_tasks'])
        self.assertTrue(bonus['result']['bonus_star'])
        self.assertEqual(bonus['result']['xp_awarded'], 0)
        repeated_bonus = self.finish(self.start(f"levels/{first['id']}/runs", purpose='bonus'), first['bonus_tasks'])
        self.assertTrue(repeated_bonus['result']['bonus_star'])
        self.assertEqual(repeated_bonus['result']['xp_awarded'], 0)
        self.assertTrue(self.client.get(f'/api/modules/{self.mid}/map').json()['levels'][0]['bonus_star'])
        repeated = self.finish(self.start(f"levels/{first['id']}/runs"), first['tasks'])
        self.assertEqual(repeated['result']['xp_awarded'], 0)
        tasks = [{'type': 'choice', **q} for q in self.module['assessment']]
        passed = self.finish(self.start(f'modules/{self.mid}/assessment-runs'), tasks)
        self.assertTrue(passed['result']['passed'])
        self.assertEqual(passed['result']['profile']['xp'], 110)
        self.assertEqual(len(self.client.get('/api/reviews').json()['reviews']), 3)
        self.assertTrue(self.client.get('/api/curriculum').json()['modules'][1]['unlocked'])
        again = self.finish(self.start(f'modules/{self.mid}/assessment-runs'), tasks)
        self.assertEqual(again['result']['xp_awarded'], 0)

    def test_wrong_baseline_unlocks_without_mastery_and_first_answers_are_frozen(self):
        done = self.baseline(wrong=range(len(self.module['entry_tasks'])))
        self.assertEqual(done['result']['score_percent'], 0)
        self.assertEqual(done['result']['xp_awarded'], 0)
        self.assertEqual(done['result']['profile']['mastered_module_ids'], [])
        again = self.start(f'modules/{self.mid}/diagnostic-runs')
        self.assertEqual(again, done)
        self.assertTrue(self.client.get(f'/api/modules/{self.mid}/map').json()['levels'][0]['unlocked'])
        task = self.module['entry_tasks'][0]
        response = self.client.post(f"/api/learning-runs/{done['id']}/steps/{task['id']}/submit", json={'idempotency_key': self.key(), 'answer': self.answer(task)})
        self.assertEqual(response.status_code, 409)

    def test_gates_order_ownership_and_legacy_bypass(self):
        first, second = self.module['lessons'][:2]
        for path in (f"levels/{first['id']}/runs", f'modules/{self.mid}/assessment-runs'):
            self.assertEqual(self.client.post('/api/' + path, json={'idempotency_key': self.key()}).status_code, 403)
        legacy = {'idempotency_key': self.key(), 'answers': [{'question_id': q['id'], 'option_id': q['correct_option_id']} for q in first['questions']], 'reflection': 'This old route must not skip the new tasks.'}
        self.assertEqual(self.client.post(f"/api/lessons/{first['id']}/complete", json=legacy).status_code, 403)
        self.baseline()
        self.assertEqual(self.client.post(f'/api/modules/{self.mid}/assessment-runs', json={'idempotency_key': self.key()}).status_code, 403)
        self.assertEqual(self.client.post(f"/api/levels/{first['id']}/runs", json={'idempotency_key': self.key(), 'purpose': 'bonus'}).status_code, 403)
        self.assertEqual(self.client.post(f"/api/levels/{second['id']}/runs", json={'idempotency_key': self.key()}).status_code, 403)
        run = self.start(f"levels/{first['id']}/runs")
        last = first['tasks'][-1]
        self.assertEqual(self.client.post(f"/api/learning-runs/{run['id']}/steps/{last['id']}/submit", json={'idempotency_key': self.key(), 'answer': self.answer(last)}).status_code, 409)
        self.client.cookies.clear()
        self.client.post('/api/session')
        self.assertEqual(self.client.get('/api/learning-runs/' + run['id']).status_code, 403)
        self.assertEqual(self.client.post(f"/api/learning-runs/{run['id']}/steps/{first['tasks'][0]['id']}/submit", json={'idempotency_key': self.key(), 'answer': self.answer(first['tasks'][0])}).status_code, 403)

    def test_practice_retry_feedback_persists_first_response(self):
        self.baseline()
        lesson = self.module['lessons'][0]
        run = self.start(f"levels/{lesson['id']}/runs")
        for task in lesson['tasks']:
            if task['type'] == 'instruction':
                run = self.submit(run, task)
                continue
            wrong = self.submit(run, task, wrong=True)
            self.assertEqual(wrong['current_step']['id'], task['id'])
            self.assertFalse(wrong['feedback'][0]['correct'])
            self.assertTrue(wrong['feedback'][0]['explanation'])
            self.assertEqual(self.client.get('/api/learning-runs/' + run['id']).json(), wrong)
            with TestClient(create_app(self.settings, self.content)) as restarted:
                restarted.cookies.set(self.settings.cookie_name, self.client.cookies.get(self.settings.cookie_name))
                self.assertEqual(restarted.get('/api/learning-runs/' + run['id']).json(), wrong)
            run = self.submit(run, task)
        from app.db import LearningRun
        async def evidence():
            async with self.app.state.db.sessions() as db:
                return (await db.get(LearningRun, run['id'])).state_json
        state = self.client.portal.call(evidence)
        first_decision = next(t for t in lesson['tasks'] if t['type'] != 'instruction')
        self.assertFalse(state['first_responses'][first_decision['id']]['correct'])
        self.assertGreater(len(state['responses']), len(lesson['tasks']))

    def test_restart_concurrent_replay_retirement_and_changed_payload(self):
        path = f'/api/modules/{self.mid}/diagnostic-runs'
        body = {'idempotency_key': self.key()}
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda _: self.client.post(path, json=body), range(2)))
        self.assertEqual([r.status_code for r in responses], [200, 200])
        self.assertEqual(responses[0].json(), responses[1].json())
        run = responses[0].json()
        task = self.module['entry_tasks'][0]
        step_path = f"/api/learning-runs/{run['id']}/steps/{task['id']}/submit"
        payload = {'idempotency_key': self.key(), 'answer': self.answer(task, True)}
        first = self.client.post(step_path, json=payload).json()
        token = self.client.cookies.get(self.settings.cookie_name)
        retired = deepcopy(self.content)
        retired['modules'] = []
        with TestClient(create_app(self.settings, retired), headers={'Origin': 'http://localhost:5173'}) as restarted:
            restarted.cookies.set(self.settings.cookie_name, token)
            self.assertEqual(restarted.post(path, json=body).json(), run)
            self.assertEqual(restarted.post(step_path, json=payload).json(), first)
            self.assertEqual(restarted.get('/api/learning-runs/' + run['id']).json(), first)
            self.assertEqual(restarted.post(step_path, json={**payload, 'answer': self.answer(task)}).status_code, 409)
            next_task = self.module['entry_tasks'][1]
            continued = restarted.post(f"/api/learning-runs/{run['id']}/steps/{next_task['id']}/submit", json={'idempotency_key': self.key(), 'answer': self.answer(next_task)})
            self.assertEqual(continued.status_code, 200, continued.text)

    def test_failed_exit_retains_progress_and_critical_rule(self):
        self.baseline()
        self.lessons()
        tasks = [{'type': 'choice', **q} for q in self.module['assessment']]
        failed = self.finish(self.start(f'modules/{self.mid}/assessment-runs'), tasks, wrong=(0,))
        self.assertFalse(failed['result']['passed'])
        self.assertEqual(failed['result']['score_percent'], 80)
        self.assertFalse(failed['result']['critical_items_passed'])
        self.assertEqual(len(failed['result']['profile']['completed_lesson_ids']), 3)
        self.assertEqual(failed['result']['profile']['xp'], 60)
        legacy = {'idempotency_key': self.key(), 'answers': [{'question_id': q['id'], 'option_id': q['correct_option_id']} for q in self.module['assessment']], 'reflection': 'Old assessments must not bypass the run.'}
        self.assertEqual(self.client.post(f'/api/modules/{self.mid}/assessment', json=legacy).status_code, 403)
        noncritical = next(i for i, t in enumerate(tasks) if not t['critical'])
        passed = self.finish(self.start(f'modules/{self.mid}/assessment-runs'), tasks, wrong=(noncritical,))
        self.assertTrue(passed['result']['passed'])
        self.assertEqual(passed['result']['score_percent'], 80)

    def test_replay_precedes_prerequisites_and_pinned_version_resolution(self):
        from app.db import LearningRun
        path = f'/api/modules/{self.mid}/diagnostic-runs'
        body = {'idempotency_key': self.key()}
        initial = self.client.post(path, json=body).json()
        self.assertEqual(self.client.post('/api/levels/m01-l02/runs', json=body).status_code, 409)
        task = self.module['entry_tasks'][0]
        step_path = f"/api/learning-runs/{initial['id']}/steps/{task['id']}/submit"
        submission = {'idempotency_key': self.key(), 'answer': self.answer(task)}
        stored = self.client.post(step_path, json=submission).json()
        async def retire_rubric():
            async with self.app.state.db.sessions.begin() as db:
                run = await db.get(LearningRun, initial['id'])
                run.snapshot_json = {**run.snapshot_json, 'rubric_version': 'retired-version'}
        self.client.portal.call(retire_rubric)
        self.assertEqual(self.client.post(path, json=body).json(), initial)
        self.assertEqual(self.client.post(step_path, json=submission).json(), stored)
        self.assertEqual(self.client.get('/api/learning-runs/' + initial['id']).status_code, 409)
        self.assertEqual(self.client.post(path, json={}).status_code, 422)
        self.assertEqual(self.client.post(step_path, json={'idempotency_key': self.key(), 'answer': self.answer(task)}).status_code, 409)

    def test_final_reward_cross_worker_replay_preserves_original_profile(self):
        from app.db import Attempt, LearningRunCommand, XPLedger
        self.baseline()
        lesson = self.module['lessons'][0]
        run = self.start(f"levels/{lesson['id']}/runs")
        for task in lesson['tasks'][:-1]:
            run = self.submit(run, task)
        task = lesson['tasks'][-1]
        path = f"/api/learning-runs/{run['id']}/steps/{task['id']}/submit"
        body = {'idempotency_key': self.key(), 'answer': self.answer(task)}
        token = self.client.cookies.get(self.settings.cookie_name)
        with TestClient(create_app(self.settings, self.content), headers={'Origin': 'http://localhost:5173'}) as worker:
            worker.cookies.set(self.settings.cookie_name, token)
            with ThreadPoolExecutor(max_workers=2) as pool:
                responses = list(pool.map(lambda client: client.post(path, json=body), (self.client, worker)))
            self.assertEqual([r.status_code for r in responses], [200, 200])
            self.assertEqual(responses[0].json(), responses[1].json())
        original = responses[0].json()
        self.assertEqual(original['result']['xp_awarded'], 20)
        next_lesson = self.module['lessons'][1]
        self.finish(self.start(f"levels/{next_lesson['id']}/runs"), next_lesson['tasks'])
        self.assertEqual(self.client.get('/api/me/profile').json()['xp'], 40)
        self.content['modules'] = []
        self.assertEqual(self.client.post(path, json=body).json(), original)
        self.assertEqual(self.client.post(path, json={**body, 'answer': self.answer(task, True)}).status_code, 409)
        async def records():
            async with self.app.state.db.sessions() as db:
                attempts = list((await db.scalars(select(Attempt).where(Attempt.target_id == lesson['id']))).all())
                rewards = list((await db.scalars(select(XPLedger).where(XPLedger.event_key == 'lesson:' + lesson['id']))).all())
                command = await db.get(LearningRunCommand, (original['result']['profile']['id'], body['idempotency_key']))
                return len(attempts), len(rewards), command.response
        self.assertEqual(self.client.portal.call(records), (1, 1, original))

    def test_assessment_type_cannot_be_overridden_by_authored_question(self):
        from app.content.validate import validate_catalog
        self.baseline()
        self.lessons()
        for question in self.module['assessment']:
            question['type'] = 'instruction'
        validate_catalog(self.content)
        run = self.start(f'modules/{self.mid}/assessment-runs')
        self.assertEqual(run['current_step']['type'], 'choice')
        path = f"/api/learning-runs/{run['id']}/steps/{run['current_step']['id']}/submit"
        self.assertEqual(self.client.post(path, json={'idempotency_key': self.key(), 'answer': {'acknowledged': True}}).status_code, 422)
        result = self.finish(run, [{**q, 'type': 'choice'} for q in self.module['assessment']])
        self.assertTrue(result['result']['passed'])
        self.assertEqual(result['result']['xp_awarded'], 50)

    def test_invalid_pinned_tasks_fail_closed_without_partial_evidence(self):
        from app.db import Attempt, LearningRun, LearningRunCommand, LessonCompletion, XPLedger
        self.baseline()
        lesson = self.module['lessons'][0]
        start_path = f"/api/levels/{lesson['id']}/runs"
        start_body = {'idempotency_key': self.key()}
        started = self.client.post(start_path, json=start_body)
        self.assertEqual(started.status_code, 200, started.text)
        run = started.json()
        instruction = deepcopy(lesson['tasks'][0])
        choice = deepcopy(next(t for t in lesson['tasks'] if t['type'] == 'choice'))
        classification = deepcopy(next(t for t in lesson['tasks'] if t['type'] == 'classification'))
        missing_choice_key = {k: v for k, v in choice.items() if k != 'correct_option_id'}
        missing_assignment_key = {k: v for k, v in classification.items() if k != 'correct_assignments'}
        cases = [
            ('instruction-only', [instruction], {'acknowledged': True}),
            ('missing-choice-key', [missing_choice_key], self.answer(choice)),
            ('missing-classification-key', [missing_assignment_key], self.answer(classification)),
            ('unknown-choice-key', [{**choice, 'correct_option_id': 'missing'}], self.answer(choice)),
            ('invalid-assignment', [{**classification, 'correct_assignments': {}}], self.answer(classification)),
            ('unsupported-type', [{**choice, 'type': 'client_complete'}], self.answer(choice)),
            ('malformed-options', [{**choice, 'options': [{}]}], self.answer(choice)),
        ]
        for group in ('items', 'categories'):
            task = deepcopy(classification)
            old = task[group][0]['id']
            new = ' ' + old
            task[group][0]['id'] = new
            task['correct_assignments'] = {new if group == 'items' and key == old else key: new if group == 'categories' and value == old else value for key, value in task['correct_assignments'].items()}
            cases.append((f'trimmed-{group}', [task], self.answer(task)))
        async def corrupt(tasks):
            async with self.app.state.db.sessions.begin() as db:
                stored = await db.get(LearningRun, run['id'])
                stored.snapshot_json = {**stored.snapshot_json, 'tasks': tasks}
                return deepcopy(stored.state_json)
        async def records(key):
            async with self.app.state.db.sessions() as db:
                stored = await db.get(LearningRun, run['id'])
                return (stored.status, stored.state_json, await db.scalar(select(Attempt.id).where(Attempt.target_id == lesson['id'])), await db.get(LessonCompletion, (stored.user_id, lesson['id'])), await db.get(XPLedger, (stored.user_id, 'lesson:' + lesson['id'])), await db.get(LearningRunCommand, (stored.user_id, key)))
        with TestClient(create_app(self.settings, self.content), headers={'Origin': 'http://localhost:5173'}, raise_server_exceptions=False) as worker:
            worker.cookies.set(self.settings.cookie_name, self.client.cookies.get(self.settings.cookie_name))
            for label, tasks, answer in cases:
                with self.subTest(label=label):
                    before = self.client.portal.call(corrupt, tasks)
                    key = self.key()
                    response = worker.post(f"/api/learning-runs/{run['id']}/steps/{tasks[0]['id']}/submit", json={'idempotency_key': key, 'answer': answer})
                    self.assertEqual(response.status_code, 409, response.text)
                    self.assertEqual(response.json()['detail'], 'Invalid pinned learning content')
                    self.assertEqual(worker.get('/api/learning-runs/' + run['id']).status_code, 409)
                    self.assertEqual(worker.get('/api/me/workflow').status_code, 409)
                    self.assertEqual(worker.post(start_path, json=start_body).json(), run)
                    self.assertEqual(self.client.portal.call(records, key), ('active', before, None, None, None, None))

    def test_invalid_injected_start_creates_no_run_or_command(self):
        from app.db import LearningRun, LearningRunCommand
        self.module['entry_tasks'] = [deepcopy(self.module['lessons'][0]['tasks'][0])]
        body = {'idempotency_key': self.key()}
        response = self.client.post(f'/api/modules/{self.mid}/diagnostic-runs', json=body)
        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()['detail'], 'Invalid pinned learning content')
        async def records():
            async with self.app.state.db.sessions() as db:
                return (await db.scalar(select(LearningRun.id)), await db.scalar(select(LearningRunCommand.key)))
        self.assertEqual(self.client.portal.call(records), (None, None))

    def test_different_keys_cross_worker_final_step_has_one_completion(self):
        from threading import Barrier
        from app.db import Attempt, LearningRunCommand, LessonCompletion, ReviewItem, XPLedger
        self.baseline()
        lesson = self.module['lessons'][0]
        run = self.start(f"levels/{lesson['id']}/runs")
        for task in lesson['tasks'][:-1]:
            run = self.submit(run, task)
        task = lesson['tasks'][-1]
        path = f"/api/learning-runs/{run['id']}/steps/{task['id']}/submit"
        bodies = [{'idempotency_key': self.key(), 'answer': self.answer(task)} for _ in range(2)]
        barrier = Barrier(2)
        def submit(client_body):
            client, body = client_body
            barrier.wait(timeout=10)
            return client.post(path, json=body)
        with TestClient(create_app(self.settings, self.content), headers={'Origin': 'http://localhost:5173'}) as worker:
            worker.cookies.set(self.settings.cookie_name, self.client.cookies.get(self.settings.cookie_name))
            with ThreadPoolExecutor(max_workers=2) as pool:
                responses = list(pool.map(submit, zip((self.client, worker), bodies)))
        self.assertEqual(sorted(r.status_code for r in responses), [200, 409])
        winner = next(i for i, response in enumerate(responses) if response.status_code == 200)
        original = responses[winner].json()
        self.assertEqual(original['result']['xp_awarded'], 20)
        self.assertEqual(self.client.get('/api/me/profile').json()['xp'], 20)
        self.assertEqual(self.client.post(path, json=bodies[winner]).json(), original)
        self.assertEqual(self.client.post(path, json=bodies[1 - winner]).status_code, 409)
        async def records():
            async with self.app.state.db.sessions() as db:
                attempts = list((await db.scalars(select(Attempt.id).where(Attempt.target_id == lesson['id']))).all())
                rewards = list((await db.scalars(select(XPLedger.amount).where(XPLedger.event_key == 'lesson:' + lesson['id']))).all())
                completions = list((await db.scalars(select(LessonCompletion.lesson_id).where(LessonCompletion.lesson_id == lesson['id']))).all())
                reviews = list((await db.scalars(select(ReviewItem.id).where(ReviewItem.lesson_id == lesson['id']))).all())
                commands = list((await db.scalars(select(LearningRunCommand.key).where(LearningRunCommand.key.in_([b['idempotency_key'] for b in bodies])))).all())
                return len(attempts), rewards, len(completions), len(reviews), commands
        self.assertEqual(self.client.portal.call(records), (1, [20], 1, 1, [bodies[winner]['idempotency_key']]))

    def test_transaction_failure_does_not_partially_complete_or_reward(self):
        from unittest.mock import patch
        from app.learning_runs import remember
        from app.db import Attempt, LearningRun, LearningRunCommand, XPLedger
        self.baseline()
        lesson = self.module['lessons'][0]
        run = self.start(f"levels/{lesson['id']}/runs")
        for task in lesson['tasks'][:-1]:
            run = self.submit(run, task)
        last = lesson['tasks'][-1]
        body = {'idempotency_key': self.key(), 'answer': self.answer(last)}
        path = f"/api/learning-runs/{run['id']}/steps/{last['id']}/submit"
        async def fail_after_command(*args):
            await remember(*args)
            raise RuntimeError('injected pre-commit failure')
        with patch('app.learning_runs.remember', fail_after_command):
            with self.assertRaises(RuntimeError):
                self.client.post(path, json=body)
        self.assertEqual(self.client.get('/api/learning-runs/' + run['id']).json(), run)
        self.assertEqual(self.client.get('/api/me/profile').json()['xp'], 0)
        async def records():
            async with self.app.state.db.sessions() as db:
                owner = (await db.get(LearningRun, run['id'])).user_id
                return (await db.scalar(select(Attempt).where(Attempt.target_id == lesson['id'])), await db.get(XPLedger, (owner, 'lesson:' + lesson['id'])), await db.get(LearningRunCommand, (owner, body['idempotency_key'])))
        self.assertEqual(self.client.portal.call(records), (None, None, None))
        self.assertEqual(self.client.post(path, json=body).json()['result']['xp_awarded'], 20)

    def test_malformed_tasks_do_not_advance_and_reviews_use_authored_interval(self):
        from app.db import ReviewItem, aware, now
        self.baseline()
        lesson = self.module['lessons'][0]
        lesson['review_after_days'] = 3
        run = self.start(f"levels/{lesson['id']}/runs")
        first = lesson['tasks'][0]
        path = f"/api/learning-runs/{run['id']}/steps/{first['id']}/submit"
        for answer in ({'acknowledged': False}, {'acknowledged': True, 'option_id': 'x'}, {'acknowledged': 'true'}):
            self.assertEqual(self.client.post(path, json={'idempotency_key': self.key(), 'answer': answer}).status_code, 422)
        for task in lesson['tasks']:
            if task['type'] == 'classification':
                path = f"/api/learning-runs/{run['id']}/steps/{task['id']}/submit"
                for assignments in ({}, {**task['correct_assignments'], 'foreign': 'protect'}, {k: 'unknown' for k in task['correct_assignments']}):
                    self.assertEqual(self.client.post(path, json={'idempotency_key': self.key(), 'answer': {'assignments': assignments}}).status_code, 422)
            run = self.submit(run, task)
        async def interval():
            async with self.app.state.db.sessions() as db:
                review = await db.scalar(select(ReviewItem).where(ReviewItem.lesson_id == lesson['id']))
                return (aware(review.due_at) - now()).total_seconds()
        self.assertAlmostEqual(self.client.portal.call(interval), 3 * 86400, delta=10)

    def test_legacy_completion_is_preserved_without_fabricating_diagnostic_or_bonus(self):
        from app.db import Attempt, LessonCompletion, XPLedger
        owner = self.client.get('/api/me/profile').json()['id']
        async def seed_legacy():
            async with self.app.state.db.sessions.begin() as db:
                db.add(Attempt(id='old-attempt', user_id=owner, kind='lesson', target_id='m01-l01', idempotency_key='old-command', request_hash='0' * 64, answers=[], reflection='Historical only', score=100, passed=True, result={'historical': True}))
                await db.flush()
                db.add(LessonCompletion(user_id=owner, lesson_id='m01-l01', attempt_id='old-attempt'))
                db.add(XPLedger(user_id=owner, event_key='lesson:m01-l01', amount=20, reason='Historical reward'))
        self.client.portal.call(seed_legacy)
        mapping = self.client.get(f'/api/modules/{self.mid}/map').json()
        self.assertFalse(mapping['diagnostic']['completed'])
        self.assertIsNone(mapping['diagnostic']['run_id'])
        self.assertTrue(mapping['levels'][0]['standard_star'])
        self.assertEqual(mapping['levels'][0]['completion_source'], 'legacy')
        self.assertFalse(mapping['levels'][0]['bonus_star'])
        self.baseline()
        lesson = self.module['lessons'][0]
        repeat = self.finish(self.start(f"levels/{lesson['id']}/runs"), lesson['tasks'])
        self.assertEqual(repeat['result']['xp_awarded'], 0)
        self.assertEqual(repeat['result']['profile']['xp'], 20)
        self.assertEqual(self.client.get('/api/attempts/old-attempt').json(), {'historical': True})

    def test_workflow_read_queries_are_bounded_across_module_counts(self):
        from sqlalchemy import event
        counts = []
        snapshot_counts = []
        modules = self.content['modules']
        statements = []
        def capture(connection, cursor, statement, parameters, context, executemany):
            if statement.lstrip().upper().startswith('SELECT'):
                statements.append(statement)
        engine = self.app.state.db.engine.sync_engine
        for size in (1, 10):
            self.content['modules'] = modules[:size]
            statements.clear()
            event.listen(engine, 'before_cursor_execute', capture)
            try:
                response = self.client.get('/api/me/workflow')
            finally:
                event.remove(engine, 'before_cursor_execute', capture)
            self.assertEqual(response.status_code, 200, response.text)
            value = response.json()
            counts.append(len(statements))
            snapshot_counts.append(sum('learning_runs.snapshot_json' in statement for statement in statements))
            self.assertEqual(len(value['modules']), size)
            self.assertEqual(value['next_action'], {'kind': 'diagnostic', 'module_id': self.mid})
            self.assertIsNone(value['resume'])
            self.assertFalse(value['modules'][0]['levels'][0]['unlocked'])
            self.assertTrue(all(not module['unlocked'] for module in value['modules'][1:]))
            self.assertEqual(value['profile'], self.client.get('/api/me/profile').json())
            self.assertEqual(value['practice_eligibility'], self.client.get('/api/curriculum').json()['practice_eligibility'])
        self.content['modules'] = modules
        self.assertEqual(counts, [counts[0]] * len(counts), f'Workflow SELECT counts for 1/10 modules: {counts}')
        self.assertLessEqual(max(counts), 10, f'Workflow SELECT counts for 1/10 modules: {counts}')
        self.assertEqual(snapshot_counts, [1, 1], 'Only the latest resume run needs its private snapshot')

    def test_workflow_prefetch_preserves_owned_progress_maps_and_resume(self):
        from sqlalchemy import event
        self.baseline(wrong=(0,))
        first, second = self.module['lessons'][:2]
        self.finish(self.start(f"levels/{first['id']}/runs"), first['tasks'])
        self.finish(self.start(f"levels/{first['id']}/runs", purpose='bonus'), first['bonus_tasks'])
        run = self.start(f"levels/{second['id']}/runs")
        run = self.submit(run, second['tasks'][0])
        run = self.submit(run, second['tasks'][1], wrong=True)
        statements = []
        def capture(connection, cursor, statement, parameters, context, executemany):
            if statement.lstrip().upper().startswith('SELECT'):
                statements.append(statement)
        engine = self.app.state.db.engine.sync_engine
        event.listen(engine, 'before_cursor_execute', capture)
        try:
            response = self.client.get('/api/me/workflow')
        finally:
            event.remove(engine, 'before_cursor_execute', capture)
        self.assertEqual(response.status_code, 200, response.text)
        workflow = response.json()
        self.assertEqual(workflow['profile'], self.client.get('/api/me/profile').json())
        self.assertEqual(workflow['resume'], run)
        self.assertEqual(workflow['next_action'], {'kind': 'resume', 'run_id': run['id'], 'module_id': self.mid, 'level_id': second['id']})
        self.assertEqual(workflow['practice_eligibility'], self.client.get('/api/curriculum').json()['practice_eligibility'])
        for mapping in workflow['modules']:
            self.assertEqual(mapping, self.client.get(f"/api/modules/{mapping['module_id']}/map").json())
        levels = workflow['modules'][0]['levels']
        self.assertTrue(levels[0]['standard_star'])
        self.assertTrue(levels[0]['bonus_star'])
        self.assertEqual(levels[0]['completion_source'], 'interactive')
        self.assertEqual(levels[1]['active_run_id'], run['id'])
        self.assertFalse(levels[2]['unlocked'])
        self.assertFalse(workflow['modules'][0]['assessment_available'])
        self.client.cookies.clear()
        self.client.post('/api/session')
        other = self.client.get('/api/me/workflow').json()
        self.assertIsNone(other['resume'])
        self.assertEqual(other['profile']['xp'], 0)
        self.assertFalse(other['modules'][0]['diagnostic']['completed'])
        self.assertTrue(all(not level['standard_star'] and not level['bonus_star'] for level in other['modules'][0]['levels']))
        self.assertLessEqual(len(statements), 10, f'Populated workflow SELECT count: {len(statements)}')
        self.assertEqual(sum('learning_runs.snapshot_json' in statement for statement in statements), 1)

    def test_nested_legacy_answer_metadata_stays_private(self):
        lesson = self.module['lessons'][0]
        lesson['questions'][0]['options'][0]['author_only'] = {'answer_hint': 'private-annotation'}
        from app.content.validate import validate_catalog
        validate_catalog(self.content)
        self.baseline()
        response = self.client.get('/api/lessons/' + lesson['id'])
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('author_only', response.text)
        self.assertNotIn('private-annotation', response.text)

    def test_assessment_option_metadata_stays_private_across_resume_and_replay(self):
        from app.content.validate import validate_catalog
        from app.db import LearningRun
        question = self.module['assessment'][0]
        question['options'][0]['author_only'] = {'answer_hint': 'private-option-hint'}
        validate_catalog(self.content)
        self.baseline()
        self.lessons()
        body = {'idempotency_key': self.key()}
        path = f'/api/modules/{self.mid}/assessment-runs'
        response = self.client.post(path, json=body)
        self.assertEqual(response.status_code, 200, response.text)
        run = response.json()
        for response in (response, self.client.get('/api/learning-runs/' + run['id']), self.client.get('/api/me/workflow'), self.client.post(path, json=body)):
            self.assertEqual(response.status_code, 200, response.text)
            self.assertNotIn('author_only', response.text)
            self.assertNotIn('private-option-hint', response.text)
        self.assertEqual(self.client.post(path, json=body).json(), run)
        async def saved_metadata():
            async with self.app.state.db.sessions() as db:
                return (await db.get(LearningRun, run['id'])).snapshot_json['tasks'][0]['options'][0]['author_only']
        self.assertEqual(self.client.portal.call(saved_metadata), {'answer_hint': 'private-option-hint'})

    def test_pinned_choice_ids_reject_unsubmittable_keys(self):
        from app.db import LearningRun
        for option_id in ('x' * 101, ' leading', 'trailing '):
            with self.subTest(option_id=option_id):
                run = self.start(f'modules/{self.mid}/diagnostic-runs')
                async def corrupt():
                    async with self.app.state.db.sessions.begin() as db:
                        saved = await db.get(LearningRun, run['id'])
                        snapshot = deepcopy(saved.snapshot_json)
                        task = snapshot['tasks'][0]
                        old = task['correct_option_id']
                        next(o for o in task['options'] if o['id'] == old)['id'] = option_id
                        task['correct_option_id'] = option_id
                        saved.snapshot_json = snapshot
                self.client.portal.call(corrupt)
                self.assertEqual(self.client.get('/api/learning-runs/' + run['id']).status_code, 409)
                # A new profile keeps each corrupt run isolated from subsequent starts.
                self.client.cookies.clear()
                self.client.post('/api/session')

    def test_public_projection_and_production_gate(self):
        for path in ('me/workflow', f'modules/{self.mid}/map', 'levels/m01-l01'):
            response = self.client.get('/api/' + path)
            self.assertEqual(response.status_code, 200, response.text)
            for private in ('correct_option_id', 'correct_assignments', 'critical', 'snapshot_json'):
                self.assertNotIn(private, response.text)
        run = self.start(f'modules/{self.mid}/diagnostic-runs')
        self.assertEqual(self.client.get('/api/me/workflow').json()['resume']['id'], run['id'])
        self.app.state.settings = replace(self.settings, environment='production')
        for path in ('me/workflow', f'modules/{self.mid}/map', 'levels/m01-l01', 'learning-runs/' + run['id']):
            self.assertEqual(self.client.get('/api/' + path).status_code, 503)
        self.assertEqual(self.client.post(f'/api/modules/{self.mid}/diagnostic-runs', json={'idempotency_key': self.key()}).status_code, 503)
        self.app.state.settings = self.settings
