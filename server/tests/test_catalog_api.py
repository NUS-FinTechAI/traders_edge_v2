"""Exercise the authored catalog through the public API and authoritative grading."""
from copy import deepcopy
from dataclasses import replace
import tempfile
import unittest

from fastapi.testclient import TestClient

from app.config import Settings
from app.content.catalog import load_catalog
from app.main import create_app


class CatalogAPITests(unittest.TestCase):
    def test_every_module_remains_unpublished_without_independent_approval(self):
        content = load_catalog()
        with tempfile.TemporaryDirectory() as directory:
            settings = Settings(database_url=f'sqlite+aiosqlite:///{directory}/publication.db')
            app = create_app(settings, content)
            with TestClient(app, headers={'Origin': 'http://localhost:5173'}) as client:
                self.assertEqual(client.post('/api/session').status_code, 200)
                app.state.settings = replace(settings, environment='production')
                for module in content['modules']:
                    with self.subTest(module=module['id']):
                        response = client.get(f"/api/modules/{module['id']}/map")
                        self.assertEqual(response.status_code, 503, response.text)
                        response = client.post(f"/api/modules/{module['id']}/diagnostic-runs", json={'idempotency_key': module['id'] + '-publication'})
                        self.assertEqual(response.status_code, 503, response.text)
                        self.assertIn('independent publication review', response.text)
                self.assertEqual(client.get('/api/me/profile').json()['xp'], 0)

    def test_all_authored_learning_paths_grade_and_unlock_without_key_leaks(self):
        private_catalog = load_catalog()
        modules = private_catalog['modules']
        self.assertEqual(len(modules), 10)
        self.assertEqual(sum(len(m['entry_tasks']) for m in modules), 30)
        self.assertEqual(sum(len(l['questions']) for m in modules for l in m['lessons']), 60)
        self.assertEqual(sum(len(m['assessment']) for m in modules), 50)
        self.assertEqual(sum(len(l['tasks']) for m in modules for l in m['lessons']), 97)
        self.assertEqual(sum(len(l['bonus_tasks']) for m in modules for l in m['lessons']), 30)
        with tempfile.TemporaryDirectory() as directory:
            app = create_app(Settings(database_url=f'sqlite+aiosqlite:///{directory}/catalog.db'))
            with TestClient(app, headers={'Origin': 'http://localhost:5173'}) as client:
                self.assertEqual(client.post('/api/session').status_code, 200)
                counter = 0

                def key():
                    nonlocal counter
                    counter += 1
                    return f'catalog-command-{counter}'

                def public(response):
                    self.assertEqual(response.status_code, 200, response.text)
                    for private in ('correct_option_id', 'correct_assignments', 'snapshot_json', 'first_responses'):
                        self.assertNotIn(private, response.text)
                    result = response.json()
                    task = result.get('current_step')
                    if task:
                        self.assertNotIn('critical', task)
                        self.assertNotIn('explanation', task)
                    return result

                def start(path, **extra):
                    return public(client.post('/api/' + path, json={'idempotency_key': key(), **extra}))

                def reject(path, **extra):
                    response = client.post('/api/' + path, json={'idempotency_key': key(), **extra})
                    self.assertEqual(response.status_code, 403, response.text)

                def answer(task, wrong=False):
                    if task['type'] in {'instruction', 'simulation'}:
                        return {'acknowledged': True}
                    if task['type'] == 'choice':
                        option = next(o['id'] for o in task['options'] if o['id'] != task['correct_option_id']) if wrong else task['correct_option_id']
                        return {'option_id': option, 'confidence': 60}
                    assignments = deepcopy(task['correct_assignments'])
                    if wrong:
                        item = next(iter(assignments))
                        assignments[item] = next(c['id'] for c in task['categories'] if c['id'] != assignments[item])
                    return {'assignments': assignments, 'confidence': 60}

                def submit(run, task, value):
                    path = f"/api/learning-runs/{run['id']}/steps/{task['id']}/submit"
                    body = {'idempotency_key': key(), 'answer': value}
                    response = client.post(path, json=body)
                    result = public(response)
                    replay = client.post(path, json=body)
                    self.assertEqual(replay.status_code, 200, replay.text)
                    self.assertEqual(replay.json(), result)
                    return result

                def finish(run, tasks, unsure=False, retry=False):
                    attempted_retry = False
                    if len(tasks) > 1:
                        skipped = client.post(f"/api/learning-runs/{run['id']}/steps/{tasks[-1]['id']}/submit", json={'idempotency_key': key(), 'answer': answer(tasks[-1])})
                        self.assertEqual(skipped.status_code, 409, skipped.text)
                    for index, task in enumerate(tasks):
                        self.assertEqual(run['current_step']['id'], task['id'])
                        if retry and not attempted_retry and task['type'] != 'instruction':
                            run = submit(run, task, answer(task, wrong=True))
                            self.assertEqual(run['current_step']['id'], task['id'])
                            self.assertFalse(run['feedback'][0]['correct'])
                            self.assertIsNone(run['result'])
                            attempted_retry = True
                        if task['type'] == 'simulation':
                            path = f"/api/learning-runs/{run['id']}/simulation"
                            view = public(client.post(path, json={'idempotency_key': key()}))
                            while view['tick'] < view['bound_policy']['min_observe']:
                                view = public(client.post(f"/api/simulations/{view['id']}/advance", json={'idempotency_key': key(), 'steps': view['bound_policy']['max_advance']}))
                            view = public(client.get(path))
                            self.assertEqual(view['orders'], [])
                            body = {'idempotency_key': key(), 'audit': {'tick': view['tick'], 'engine_version': view['version'], 'observation_token': view['observation_token'], 'orders': [], 'session_fees': view['fees'], 'price_limit_guarantees_fill': False, 'no_order_reason': 'no_thesis_supplied'}}
                            run = public(client.post(path + '/review', json=body))
                            self.assertEqual(public(client.post(path + '/review', json=body)), run)
                        else:
                            value = {'option_id': 'unsure', 'confidence': 0} if unsure else answer(task)
                            run = submit(run, task, value)
                        self.assertEqual(run['progress']['completed_steps'], index + 1)
                        if run['purpose'] in ('diagnostic', 'assessment') and index < len(tasks) - 1:
                            self.assertEqual(run['feedback'], [])
                            self.assertIsNone(run['result'])
                            self.assertNotIn('explanation', str(run))
                        self.assertEqual(public(client.get(f"/api/learning-runs/{run['id']}")), run)
                    self.assertEqual(run['status'], 'completed')
                    self.assertIsNone(run['current_step'])
                    return run

                for number, module in enumerate(modules):
                    with self.subTest(module=module['id']):
                        mid = module['id']
                        mapping = public(client.get(f'/api/modules/{mid}/map'))
                        self.assertTrue(mapping['interactive_available'])
                        self.assertTrue(mapping['unlocked'])
                        self.assertFalse(mapping['diagnostic']['completed'])
                        self.assertFalse(mapping['assessment_available'])
                        first = module['lessons'][0]
                        reject(f"levels/{first['id']}/runs")
                        reject(f'modules/{mid}/assessment-runs')
                        if number < 9:
                            reject(f"modules/{modules[number + 1]['id']}/diagnostic-runs")
                        baseline = finish(start(f'modules/{mid}/diagnostic-runs'), module['entry_tasks'], unsure=True)
                        self.assertIsNone(baseline['result']['passed'])
                        self.assertEqual(baseline['result']['score_percent'], 0)
                        self.assertEqual(baseline['result']['xp_awarded'], 0)
                        self.assertEqual(start(f'modules/{mid}/diagnostic-runs'), baseline)
                        for position, lesson in enumerate(module['lessons']):
                            lid = lesson['id']
                            level = public(client.get(f'/api/levels/{lid}'))
                            self.assertEqual(level['level']['required_steps'], len(lesson['tasks']))
                            self.assertEqual(level['level']['bonus_steps'], len(lesson['bonus_tasks']))
                            self.assertTrue(level['level']['unlocked'])
                            reject(f'levels/{lid}/runs', purpose='bonus')
                            if position < 2:
                                reject(f"levels/{module['lessons'][position + 1]['id']}/runs")
                            response = client.get(f'/api/lessons/{lid}')
                            lesson_data = public(response)['lesson']
                            self.assertNotIn('critical', lesson_data['questions'][0])
                            self.assertEqual(len(lesson_data['learning_cycle']), 9)
                            body = {'idempotency_key': key(), 'answers': [{'question_id': q['id'], 'option_id': q['correct_option_id']} for q in lesson['questions']], 'reflection': 'This legacy request must not bypass the required interactive tasks.'}
                            self.assertEqual(client.post(f'/api/lessons/{lid}/complete', json=body).status_code, 403)
                            completed = finish(start(f'levels/{lid}/runs'), lesson['tasks'], retry=True)
                            self.assertTrue(completed['result']['passed'])
                            self.assertTrue(completed['result']['standard_star'])
                            self.assertEqual(completed['result']['xp_awarded'], 20)
                            repeated = finish(start(f'levels/{lid}/runs'), lesson['tasks'])
                            self.assertEqual(repeated['result']['xp_awarded'], 0)
                        mapping = public(client.get(f'/api/modules/{mid}/map'))
                        self.assertTrue(mapping['assessment_available'])
                        self.assertTrue(all(n['standard_star'] and not n['bonus_star'] for n in mapping['levels']))
                        assessment = public(client.get(f'/api/modules/{mid}/assessment'))
                        self.assertTrue(assessment)
                        body = {'idempotency_key': key(), 'answers': [{'question_id': q['id'], 'option_id': q['correct_option_id']} for q in module['assessment']], 'reflection': 'This legacy request must not bypass the stepwise exit check.'}
                        self.assertEqual(client.post(f'/api/modules/{mid}/assessment', json=body).status_code, 403)
                        tasks = [{'type': 'choice', **q} for q in module['assessment']]
                        passed = finish(start(f'modules/{mid}/assessment-runs'), tasks)
                        self.assertTrue(passed['result']['passed'])
                        self.assertEqual(passed['result']['xp_awarded'], 50)
                        if number < 9:
                            next_map = public(client.get(f"/api/modules/{modules[number + 1]['id']}/map"))
                            self.assertTrue(next_map['unlocked'])
                        for lesson in module['lessons']:
                            path = f"levels/{lesson['id']}/runs"
                            bonus = finish(start(path, purpose='bonus'), lesson['bonus_tasks'], retry=True)
                            self.assertTrue(bonus['result']['bonus_star'])
                            self.assertEqual(bonus['result']['xp_awarded'], 0)
                            repeated_bonus = finish(start(path, purpose='bonus'), lesson['bonus_tasks'])
                            self.assertTrue(repeated_bonus['result']['bonus_star'])
                            self.assertEqual(repeated_bonus['result']['xp_awarded'], 0)
                        again = finish(start(f'modules/{mid}/assessment-runs'), tasks)
                        self.assertEqual(again['result']['xp_awarded'], 0)
                        mapping = public(client.get(f'/api/modules/{mid}/map'))
                        self.assertTrue(mapping['mastered'])
                        self.assertTrue(all(n['standard_star'] and n['bonus_star'] and n['completion_source'] == 'interactive' for n in mapping['levels']))
                        self.assertEqual(client.get('/api/me/profile').json()['xp'], (number + 1) * 110)
                profile = client.get('/api/me/profile').json()
                self.assertEqual(len(profile['completed_lesson_ids']), 30)
                self.assertEqual(len(profile['mastered_module_ids']), 10)
                self.assertEqual(profile['xp'], 1100)
                self.assertEqual(len(client.get('/api/reviews').json()['reviews']), 30)
                self.assertTrue(client.get('/api/archive').json()['terms'])
                workflow = public(client.get('/api/me/workflow'))
                self.assertIsNone(workflow['next_action'])
                self.assertIsNone(workflow['resume'])
