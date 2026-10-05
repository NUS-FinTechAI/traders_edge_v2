from contextlib import contextmanager
from copy import deepcopy
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import event, select

from app.db import Attempt, LearningRun, LearningRunCommand, MasteredModule, Profile, SimulationSession, XPLedger, uid
from app.main import create_app
import test_interactive as fixtures
from test_simulation import order


class BoundSimulationTests(unittest.TestCase):
    tearDown = fixtures.InteractiveTests.tearDown
    key = fixtures.InteractiveTests.key
    start = fixtures.InteractiveTests.start
    answer = fixtures.InteractiveTests.answer
    submit = fixtures.InteractiveTests.submit
    finish = fixtures.InteractiveTests.finish
    baseline = fixtures.InteractiveTests.baseline

    def setUp(self):
        fixtures.InteractiveTests.setUp(self)
        baseline = self.baseline()
        self.user_id = baseline['result']['profile']['id']
        async def unlock():
            async with self.app.state.db.sessions.begin() as db:
                for module in self.content['modules'][:4]:
                    db.add(MasteredModule(user_id=self.user_id, module_id=module['id'], attempt_id=baseline['result']['attempt_id']))
        self.client.portal.call(unlock)
        self.module = self.content['modules'][4]
        self.mid = self.module['id']
        self.baseline()
        self.lesson = self.module['lessons'][0]
        self.run = self.start('levels/m05-l01/runs')
        self.path = f"/api/learning-runs/{self.run['id']}/simulation"

    def ready(self):
        self.assertEqual(self.lesson['tasks'][-1]['type'], 'simulation')
        for task in self.lesson['tasks'][:-1]:
            self.run = self.submit(self.run, task)
        return self.run

    def bind(self):
        response = self.client.post(self.path, json={'idempotency_key': self.key()})
        self.assertEqual(response.status_code, 200, response.text)
        self.view = response.json()
        self.base = '/api/simulations/' + self.view['id']
        return self.view

    def advance(self, steps=2):
        response = self.client.post(self.base + '/advance', json={'steps': steps, 'idempotency_key': self.key()})
        self.assertEqual(response.status_code, 200, response.text)
        self.view = response.json()
        return self.view

    def audit(self, **changes):
        view = self.client.get(self.path).json()
        return {'tick': view['tick'], 'engine_version': view['version'], 'observation_token': view['observation_token'],
                'orders': [{'order_id': o['id'], 'status': o['status'], 'filled_quantity': o['filled'], 'limit_price': o['price']} for o in view['orders']],
                'session_fees': view['fees'], 'price_limit_guarantees_fill': False,
                'no_order_reason': None if view['orders'] else 'no_thesis_supplied', **changes}

    def review(self, **changes):
        response = self.client.post(self.path + '/review', json={'idempotency_key': self.key(), 'audit': self.audit(**changes)})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_bind_gates_resume_and_no_hidden_future(self):
        self.assertEqual(self.client.post(self.path, json={'idempotency_key': self.key()}).status_code, 409)
        self.assertEqual(self.client.get('/api/simulations').json()['sessions'], [])
        self.ready()
        first = self.bind()
        second = self.bind()
        self.assertEqual(first['id'], second['id'])
        self.assertEqual(first['total_ticks'], 30)
        self.assertEqual(len(first['quotes']), 4)
        self.assertEqual(first['bound_policy']['unit_price_cap'], first['quotes'][0]['ask'])
        for private in ('seed', 'kind', 'liquidity', 'prices'):
            self.assertNotIn(private, first)
        self.assertEqual([len(v) for v in first['history'].values()], [1] * 4)
        step = self.run['current_step']['id']
        self.assertEqual(self.client.post(f"/api/learning-runs/{self.run['id']}/steps/{step}/submit", json={'idempotency_key': self.key(), 'answer': {'acknowledged': True}}).status_code, 409)

    def test_observe_requires_accurate_audit_reason_and_replays_after_finish(self):
        self.ready()
        self.bind()
        for _ in range(5):
            self.advance()
        for changes in ({'no_order_reason': None}, {'session_fees': '1.00'}, {'price_limit_guarantees_fill': True}):
            wrong = self.review(**changes)
            self.assertEqual(wrong['status'], 'active')
            self.assertFalse(wrong['feedback'][0]['correct'])
            self.assertFalse(self.client.get(self.path).json()['finished'])
        body = {'idempotency_key': self.key(), 'audit': self.audit(session_fees='0.000')}
        done = self.client.post(self.path + '/review', json=body)
        self.assertEqual(done.status_code, 200, done.text)
        self.assertEqual(done.json()['result']['xp_awarded'], 20)
        self.assertFalse(done.json()['result']['bonus_star'])
        self.assertEqual(self.client.post(self.path + '/review', json=body).json(), done.json())
        self.assertTrue(self.client.get(self.path).json()['finished'])
        self.assertEqual(self.client.post(self.base + '/advance', json={'steps': 1, 'idempotency_key': self.key()}).status_code, 409)

    def test_plain_routes_enforce_bound_constraints_and_plan(self):
        self.ready()
        self.bind()
        valid = {**order(type='limit', price=self.view['bound_policy']['unit_price_cap'], quantity=1)}
        for changes in ({'symbol': 'COVE'}, {'side': 'sell'}, {'type': 'market'}, {'quantity': 6}, {'price': '40.05'}, {'plan': {}}):
            response = self.client.post(self.base + '/orders', json={**valid, **changes, 'idempotency_key': self.key()})
            self.assertEqual(response.status_code, 422, response.text)
        self.assertEqual(self.client.post(self.base + '/advance', json={'steps': 3, 'idempotency_key': self.key()}).status_code, 422)
        self.assertEqual(self.client.post(self.base + '/debrief', json={'reflection': 'An ordinary reflection must not bypass the graded audit.', 'idempotency_key': self.key()}).status_code, 409)
        for _ in range(2):
            self.assertEqual(self.client.post(self.base + '/orders', json={**valid, 'idempotency_key': self.key()}).status_code, 200)
        self.assertEqual(self.client.post(self.base + '/orders', json={**valid, 'idempotency_key': self.key()}).status_code, 422)
        for _ in range(14):
            self.advance()
        self.assertEqual(self.client.post(self.base + '/advance', json={'steps': 2, 'idempotency_key': self.key()}).status_code, 422)
        self.assertEqual(self.client.get(self.path).json()['tick'], 28)
        self.advance(1)
        self.assertEqual(self.review()['status'], 'completed')

    def saved(self):
        async def read():
            async with self.app.state.db.sessions() as db:
                run = await db.get(LearningRun, self.run['id'])
                sessions = list((await db.scalars(select(SimulationSession))).all())
                attempts = list((await db.scalars(select(Attempt).where(Attempt.target_id == 'm05-l01'))).all())
                rewards = list((await db.scalars(select(XPLedger).where(XPLedger.event_key == 'lesson:m05-l01'))).all())
                commands = list((await db.scalars(select(LearningRunCommand).where(LearningRunCommand.run_id == run.id))).all())
                return {'run': deepcopy(run.state_json), 'snapshot': deepcopy(run.snapshot_json), 'status': run.status,
                        'sessions': [deepcopy(s.snapshot_json) for s in sessions],
                        'attempts': len(attempts), 'rewards': len(rewards), 'commands': len(commands)}
        return self.client.portal.call(read)

    def change_session(self, mutate):
        async def change():
            async with self.app.state.db.sessions.begin() as db:
                session = await db.get(SimulationSession, self.view['id'])
                state = deepcopy(session.snapshot_json)
                mutate(state)
                session.snapshot_json = state
        self.client.portal.call(change)

    def test_stale_and_malformed_audits_leave_no_evidence(self):
        self.ready()
        self.bind()
        early = self.client.post(self.path + '/review', json={'idempotency_key': self.key(), 'audit': self.audit()})
        self.assertEqual(early.status_code, 409)
        for _ in range(5):
            self.advance()
        for fields, status in [({'tick': 9}, 409), ({'engine_version': 2}, 409),
                               ({'tick': True}, 422), ({'session_fees': 'NaN'}, 422),
                               ({'session_fees': '0.001'}, 422), ({'session_fees': 0}, 422),
                               ({'no_order_reason': 'because'}, 422), ({'extra': 'prose'}, 422),
                               ({'price_limit_guarantees_fill': 'false'}, 422)]:
            before = self.saved()
            response = self.client.post(self.path + '/review', json={'idempotency_key': self.key(), 'audit': self.audit(**fields)})
            self.assertEqual(response.status_code, status, response.text)
            self.assertEqual(self.saved(), before)

    def test_same_tick_placement_and_cancellation_invalidate_audits_without_evidence(self):
        self.ready()
        self.bind()
        for _ in range(5):
            self.advance()
        for operation in ('place', 'cancel'):
            with self.subTest(operation=operation):
                stale = self.audit()
                if operation == 'place':
                    response = self.client.post(self.base + '/orders', json={**order(type='limit', price='1.00', quantity=1), 'idempotency_key': self.key()})
                else:
                    response = self.client.post(self.base + '/orders/order-1/cancel', json={'idempotency_key': self.key()})
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(response.json()['tick'], stale['tick'])
                self.assertNotEqual(response.json()['observation_token'], stale['observation_token'])
                before = self.saved()
                response = self.client.post(self.path + '/review', json={'idempotency_key': self.key(), 'audit': stale})
                self.assertEqual(response.status_code, 409, response.text)
                self.assertEqual(self.saved(), before)
        self.assertEqual(self.review()['status'], 'completed')

    def test_fresh_tokenless_audits_reject_but_historical_commands_replay_exactly(self):
        import hashlib
        import json
        from app.simulation.lesson_api import Review
        self.ready()
        self.bind()
        for _ in range(5):
            self.advance()
        body = {'idempotency_key': self.key(), 'audit': self.audit()}
        legacy_body = deepcopy(body)
        legacy_body['audit'].pop('observation_token')
        self.assertEqual(Review(**legacy_body).model_dump(exclude={'idempotency_key'}), {'audit': legacy_body['audit']})
        before = self.saved()
        for legacy_audit in (legacy_body['audit'], {**legacy_body['audit'], 'observation_token': None}):
            response = self.client.post(self.path + '/review', json={'idempotency_key': self.key(), 'audit': legacy_audit})
            self.assertEqual(response.status_code, 409, response.text)
            self.assertEqual(self.saved(), before)
        done = self.client.post(self.path + '/review', json=body)
        self.assertEqual(done.status_code, 200, done.text)
        historical_response = deepcopy(done.json())
        historical_response['feedback'][0]['audited_observation'].pop('observation_token')
        encoded = json.dumps({'operation': 'simulation:review', 'target': self.run['id'], 'payload': {'audit': legacy_body['audit']}}, sort_keys=True, separators=(',', ':'))
        historical_hash = hashlib.sha256(encoded.encode()).hexdigest()
        async def historical_command():
            async with self.app.state.db.sessions.begin() as db:
                command = await db.get(LearningRunCommand, (self.user_id, body['idempotency_key']))
                command.request_hash = historical_hash
                command.response = historical_response
                run = await db.get(LearningRun, self.run['id'])
                run.snapshot_json = {**run.snapshot_json, 'rubric_version': 'retired'}
                session = await db.get(SimulationSession, self.view['id'])
                session.version = 99
        self.client.portal.call(historical_command)
        before = self.saved()
        replay = self.client.post(self.path + '/review', json=legacy_body)
        self.assertEqual(replay.status_code, 200, replay.text)
        self.assertEqual(replay.json(), historical_response)
        self.assertEqual(self.saved(), before)
        conflict = self.client.post(self.path + '/review', json={**legacy_body, 'audit': {**legacy_body['audit'], 'session_fees': '1.00'}})
        self.assertEqual(conflict.status_code, 409, conflict.text)

    def test_observation_token_depends_only_on_public_observed_engine_state(self):
        from app.simulation import api, engine
        state = engine.new_session(1, 'sideways', 30)
        token = api.observation_token(engine.public_view(state))
        state['seed'] = 2
        state['kind'] = 'falling'
        state['prices']['NORTH'][29] = '20.00'
        state['liquidity']['NORTH'][29] = 0
        self.assertEqual(api.observation_token(engine.public_view(state)), token)
        state['liquidity']['NORTH'][0] += 1
        self.assertNotEqual(api.observation_token(engine.public_view(state)), token)

    def test_order_audit_retries_exact_set_and_preserves_pre_cancel_observation(self):
        self.ready()
        self.bind()
        body = {**order(type='limit', price='1.00', quantity=5), 'idempotency_key': self.key()}
        self.assertEqual(self.client.post(self.base + '/orders', json=body).status_code, 200)
        for _ in range(5):
            self.advance()
        claim = self.audit()['orders'][0]
        self.assertEqual(claim['status'], 'open')
        for changes in ({'orders': []}, {'orders': [claim, claim]},
                        {'orders': [{**claim, 'order_id': 'fake'}]},
                        {'orders': [{**claim, 'filled_quantity': 1}]},
                        {'orders': [{**claim, 'status': 'filled'}]},
                        {'orders': [{**claim, 'limit_price': '1.01'}]},
                        {'session_fees': '0.25'}, {'price_limit_guarantees_fill': True}):
            self.assertFalse(self.review(**changes)['feedback'][0]['correct'])
            self.assertEqual(self.saved()['attempts'], 0)
        result = self.review(orders=[{**claim, 'limit_price': '1.000'}])
        self.assertEqual(result['status'], 'completed')
        view = self.client.get(self.path).json()
        self.assertEqual(view['orders'][0]['status'], 'cancelled')
        self.assertEqual(view['audited_observation']['orders'][0]['status'], 'open')
        self.assertEqual(result['feedback'][0]['observation_phase'], 'before_finish_cancellation')
        self.assertIn('Learner-selected structured facts', view['reflection'])
        for suffix, payload in [('/orders', body), ('/orders/order-1/cancel', {}), ('/debrief', {'reflection': 'This should not mutate a completed learning session.'})]:
            self.assertEqual(self.client.post(self.base + suffix, json={**payload, 'idempotency_key': self.key()}).status_code, 409)

    def test_current_ask_reason_uses_ask_not_mid_or_historical_path(self):
        self.ready()
        self.bind()
        for _ in range(5):
            self.advance()
        # A controlled current observation isolates the cent boundary from random future paths.
        self.change_session(lambda s: s['prices']['NORTH'].__setitem__(s['tick'], '40.00'))
        self.assertFalse(self.review(no_order_reason='current_ask_above_cap')['feedback'][0]['correct'])
        self.change_session(lambda s: s['prices']['NORTH'].__setitem__(s['tick'], '40.01'))
        view = self.client.get(self.path).json()
        north = view['quotes'][0]
        self.assertLess(north['mid'], view['bound_policy']['unit_price_cap'])
        self.assertGreater(north['ask'], view['bound_policy']['unit_price_cap'])
        self.assertEqual(self.review(no_order_reason='current_ask_above_cap')['status'], 'completed')

    def test_cap_session_failure_and_invalid_binding_leave_no_orphan(self):
        self.ready()
        for _ in range(3):
            self.assertEqual(self.client.post('/api/simulations', json={'idempotency_key': self.key()}).status_code, 201)
        before = self.saved()
        self.assertEqual(self.client.post(self.path, json={'idempotency_key': self.key()}).status_code, 409)
        self.assertEqual(self.saved(), before)
        async def corrupt():
            async with self.app.state.db.sessions.begin() as db:
                run = await db.get(LearningRun, self.run['id'])
                snapshot = deepcopy(run.snapshot_json)
                snapshot['simulation_binding']['max_orders'] = 3
                run.snapshot_json = snapshot
        self.client.portal.call(corrupt)
        before = self.saved()
        self.assertEqual(self.client.post(self.path, json={'idempotency_key': self.key()}).status_code, 409)
        self.assertEqual(self.saved(), before)

    def test_missing_first_four_mastery_rejects_bind(self):
        self.ready()
        async def revoke():
            async with self.app.state.db.sessions.begin() as db:
                row = await db.get(MasteredModule, (self.user_id, self.content['modules'][0]['id']))
                await db.delete(row)
        self.client.portal.call(revoke)
        self.assertEqual(self.client.post(self.path, json={'idempotency_key': self.key()}).status_code, 403)
        self.assertEqual(self.saved()['sessions'], [])

    def test_restart_owner_and_reciprocal_link_checks(self):
        self.ready()
        self.bind()
        self.advance()
        self.view = self.client.get(self.path).json()
        token = self.client.cookies.get(self.settings.cookie_name)
        with TestClient(create_app(self.settings, self.content), headers={'Origin': 'http://localhost:5173'}) as restarted:
            restarted.cookies.set(self.settings.cookie_name, token)
            self.assertEqual(restarted.get(self.path).json(), self.view)
            self.assertEqual(restarted.get(self.base).json(), self.view)
        self.client.cookies.clear()
        self.client.post('/api/session')
        self.assertEqual(self.client.get(self.path).status_code, 403)
        self.assertEqual(self.client.get(self.base).status_code, 404)
        self.client.cookies.set(self.settings.cookie_name, token)
        original = deepcopy(self.saved()['sessions'][0])
        for mutate in (lambda s: s.pop('bound_policy'), lambda s: s['bound_policy'].update(run_id='another-run'), lambda s: s['bound_policy'].update(unit_price_cap='40.05')):
            self.change_session(mutate)
            self.assertEqual(self.client.get(self.base).status_code, 409)
            self.assertEqual(self.client.post(self.base + '/advance', json={'idempotency_key': self.key(), 'steps': 1}).status_code, 409)
            self.change_session(lambda s: s.update(deepcopy(original)))

    def test_missing_reverse_link_cannot_create_a_second_bound_session(self):
        self.ready()
        self.bind()
        async def unlink():
            async with self.app.state.db.sessions.begin() as db:
                run = await db.get(LearningRun, self.run['id'])
                run.state_json = {k: v for k, v in run.state_json.items() if k != 'simulation_session_id'}
        self.client.portal.call(unlink)
        before = self.saved()
        self.assertEqual(self.client.post(self.path, json={'idempotency_key': self.key()}).status_code, 409)
        self.assertEqual(self.client.get(self.base).status_code, 409)
        self.assertEqual(self.saved(), before)

    def test_bind_and_review_share_learning_namespace_replay_before_retirement(self):
        self.ready()
        body = {'idempotency_key': self.key()}
        first = self.client.post(self.path, json=body).json()
        self.view = first
        self.base = '/api/simulations/' + first['id']
        command = {'idempotency_key': self.key(), 'steps': 2}
        advanced = self.client.post(self.base + '/advance', json=command).json()
        for _ in range(4):
            self.advance()
        review_body = {'idempotency_key': self.key(), 'audit': self.audit()}
        done = self.client.post(self.path + '/review', json=review_body).json()
        self.assertEqual(self.client.post(self.path, json={'idempotency_key': review_body['idempotency_key']}).status_code, 409)
        async def retire():
            async with self.app.state.db.sessions.begin() as db:
                run = await db.get(LearningRun, self.run['id'])
                run.snapshot_json = {**run.snapshot_json, 'rubric_version': 'retired'}
                session = await db.get(SimulationSession, first['id'])
                session.version = 99
        self.client.portal.call(retire)
        self.content['modules'] = []
        self.assertEqual(self.client.post(self.path, json=body).json(), first)
        self.assertEqual(self.client.post(self.path + '/review', json=review_body).json(), done)
        self.assertEqual(self.client.post(self.base + '/advance', json=command).json(), advanced)
        self.assertEqual(self.client.get(self.path).status_code, 409)
        self.assertEqual(self.client.post(self.base + '/advance', json={**command, 'idempotency_key': self.key()}).status_code, 409)

    def test_injected_finish_failure_rolls_back_session_evidence_attempt_and_xp(self):
        self.ready()
        self.bind()
        for _ in range(5):
            self.advance()
        before = self.saved()
        body = {'idempotency_key': self.key(), 'audit': self.audit()}
        from app import learning_runs
        original = learning_runs.finish_run
        async def fail_after_finish(*args):
            await original(*args)
            raise RuntimeError('injected after reward and session finish')
        with patch.object(learning_runs, 'finish_run', side_effect=fail_after_finish):
            with self.assertRaises(RuntimeError):
                self.client.post(self.path + '/review', json=body)
        self.assertEqual(self.saved(), before)
        done = self.client.post(self.path + '/review', json=body)
        self.assertEqual(done.status_code, 200, done.text)
        self.assertEqual(done.json()['result']['xp_awarded'], 20)
        self.assertEqual(self.saved()['attempts'], 1)
        self.assertEqual(self.saved()['rewards'], 1)

    def test_partial_fill_fees_cancellation_and_no_automatic_completion(self):
        from app.simulation import engine
        self.ready()
        with patch('app.simulation.api.secrets.randbits', return_value=1):
            self.bind()
        state = self.saved()['sessions'][0]
        generated = engine.new_session(1, 'sideways', 30)
        self.assertEqual(state['prices'], generated['prices'])
        self.assertEqual(state['liquidity'], generated['liquidity'])
        body = {**order(type='limit', price=self.view['bound_policy']['unit_price_cap'], quantity=5), 'idempotency_key': self.key()}
        missing_plan = {k: v for k, v in body.items() if k != 'plan'}
        self.assertEqual(self.client.post(self.base + '/orders', json=missing_plan).status_code, 422)
        self.assertEqual(self.client.post(self.base + '/orders', json=body).status_code, 200)
        view = self.advance(1)
        self.assertEqual(view['orders'][0]['status'], 'partial')
        self.assertEqual(view['orders'][0]['filled'], 4)
        self.assertGreater(engine.cents(view['fees']), 0)
        self.assertTrue(all(engine.cents(f['price']) <= engine.cents(view['bound_policy']['unit_price_cap']) for f in view['fills']))
        cancelled = self.client.post(self.base + '/orders/order-1/cancel', json={'idempotency_key': self.key()})
        self.assertEqual(cancelled.status_code, 200, cancelled.text)
        self.assertEqual(cancelled.json()['orders'][0]['status'], 'cancelled')
        for _ in range(4):
            self.advance()
        self.advance(1)
        self.assertEqual(self.saved()['attempts'], 0)
        self.assertFalse(self.review(session_fees='0.00')['feedback'][0]['correct'])
        self.assertEqual(self.review()['result']['xp_awarded'], 20)

    def test_bind_failure_rolls_back_both_links_and_session(self):
        self.ready()
        before = self.saved()
        body = {'idempotency_key': self.key()}
        with patch('app.simulation.api.response', side_effect=RuntimeError('injected bind response failure')):
            with self.assertRaises(RuntimeError):
                self.client.post(self.path, json=body)
        self.assertEqual(self.saved(), before)
        self.assertEqual(self.client.post(self.path, json=body).status_code, 200)
        self.assertEqual(len(self.saved()['sessions']), 1)

    def test_bound_publication_and_pinned_task_version_checks_on_plain_routes(self):
        from dataclasses import replace
        self.ready()
        self.bind()
        self.app.state.settings = replace(self.settings, environment='production')
        before = self.saved()
        for path in (self.path, self.base):
            self.assertEqual(self.client.get(path).status_code, 503)
        self.assertEqual(self.client.post(self.base + '/advance', json={'idempotency_key': self.key(), 'steps': 1}).status_code, 503)
        self.assertEqual(self.saved(), before)
        self.app.state.settings = self.settings
        original = deepcopy(before['snapshot'])
        async def change_snapshot(snapshot):
            async with self.app.state.db.sessions.begin() as db:
                run = await db.get(LearningRun, self.run['id'])
                run.snapshot_json = snapshot
        for mutation in (lambda s: s.update(rubric_version='interactive-1'),
                         lambda s: s['tasks'].reverse(),
                         lambda s: s['tasks'].pop(),
                         lambda s: s['simulation_binding'].update(engine_version=2)):
            snapshot = deepcopy(original)
            mutation(snapshot)
            self.client.portal.call(change_snapshot, snapshot)
            before = self.saved()
            self.assertEqual(self.client.get(self.base).status_code, 409)
            self.assertEqual(self.client.post(self.base + '/advance', json={'idempotency_key': self.key(), 'steps': 1}).status_code, 409)
            self.assertEqual(self.saved(), before)
        self.client.portal.call(change_snapshot, original)
        self.assertEqual(self.client.get(self.base).status_code, 200)

    def test_two_workers_bind_once_and_review_once_with_exact_replay(self):
        from concurrent.futures import ThreadPoolExecutor
        self.ready()
        token = self.client.cookies.get(self.settings.cookie_name)
        with TestClient(create_app(self.settings, self.content), headers={'Origin': 'http://localhost:5173'}) as worker:
            worker.cookies.set(self.settings.cookie_name, token)
            bodies = [{'idempotency_key': self.key()} for _ in range(2)]
            with ThreadPoolExecutor(max_workers=2) as pool:
                replies = list(pool.map(lambda args: args[0].post(self.path, json=args[1]), zip((self.client, worker), bodies)))
            self.assertEqual([r.status_code for r in replies], [200, 200])
            self.assertEqual(replies[0].json()['id'], replies[1].json()['id'])
            self.assertEqual(len(self.saved()['sessions']), 1)
            self.view = replies[0].json()
            self.base = '/api/simulations/' + self.view['id']
            for _ in range(5):
                self.advance()
            body = {'idempotency_key': self.key(), 'audit': self.audit()}
            with ThreadPoolExecutor(max_workers=2) as pool:
                replies = list(pool.map(lambda client: client.post(self.path + '/review', json=body), (self.client, worker)))
            self.assertEqual([r.status_code for r in replies], [200, 200])
            self.assertEqual(replies[0].json(), replies[1].json())
            self.assertEqual(replies[0].json()['result']['xp_awarded'], 20)
            self.assertEqual(worker.post(self.path + '/review', json={**body, 'idempotency_key': self.key()}).status_code, 409)
        self.assertEqual(self.saved()['attempts'], 1)
        self.assertEqual(self.saved()['rewards'], 1)

    @contextmanager
    def captured_queries(self):
        statements = []
        def capture(connection, cursor, statement, parameters, context, executemany):
            if statement.lstrip().upper().startswith('SELECT'):
                statements.append((' '.join(statement.split()), parameters))
        engine = self.app.state.db.engine.sync_engine
        event.listen(engine, 'before_cursor_execute', capture)
        try:
            yield statements
        finally:
            event.remove(engine, 'before_cursor_execute', capture)

    def test_reciprocal_selects_are_owner_scoped_and_foreign_links_are_isolated(self):
        from app.simulation import engine
        self.ready()
        foreign_id = uid()
        foreign_session_id = uid()
        async def foreign_session():
            async with self.app.state.db.sessions.begin() as db:
                db.add(Profile(id=foreign_id))
                await db.flush()
                state = engine.new_session(1, 'sideways', 30)
                state['bound_policy'] = {'run_id': self.run['id']}
                db.add(SimulationSession(id=foreign_session_id, user_id=foreign_id, mode='guided', scenario_kind='sideways', version=1, snapshot_json=state))
        self.client.portal.call(foreign_session)
        with self.captured_queries() as statements:
            self.bind()
        reverse = [(sql, params) for sql, params in statements if 'FROM simulation_sessions' in sql and 'bound_policy' in str(params)]
        self.assertEqual(len(reverse), 1)
        self.assertIn('simulation_sessions.user_id =', reverse[0][0].split(' WHERE ')[1])
        self.assertIn(self.user_id, reverse[0][1])
        unbound = self.client.post('/api/simulations', json={'idempotency_key': self.key()}).json()
        async def foreign_run():
            async with self.app.state.db.sessions.begin() as db:
                original = await db.get(LearningRun, self.run['id'])
                db.add(LearningRun(id=uid(), user_id=foreign_id, purpose=original.purpose, module_id=original.module_id,
                                   level_id=original.level_id, content_version=original.content_version, status='active',
                                   snapshot_json=deepcopy(original.snapshot_json), state_json={**deepcopy(original.state_json), 'simulation_session_id': unbound['id']}))
        self.client.portal.call(foreign_run)
        with self.captured_queries() as statements:
            self.assertEqual(self.client.get('/api/simulations/' + unbound['id']).status_code, 200)
            self.assertEqual(self.client.get(self.base).status_code, 200)
        lookups = [(sql, params) for sql, params in statements if 'FROM learning_runs' in sql and 'simulation_session_id' in str(params)]
        self.assertEqual(len(lookups), 2)
        for sql, params in lookups:
            self.assertIn('learning_runs.user_id =', sql.split(' WHERE ')[1])
            self.assertIn(self.user_id, params)
            self.assertNotIn(foreign_id, params)
        self.assertEqual(self.client.get('/api/simulations/' + foreign_session_id).status_code, 404)

    def test_session_cap_counts_in_sql_without_reading_completed_snapshots(self):
        from app.simulation import engine
        self.ready()
        legacy_id = uid()
        async def history():
            async with self.app.state.db.sessions.begin() as db:
                foreign_id = uid()
                db.add(Profile(id=foreign_id))
                await db.flush()
                for index in range(25):
                    state = engine.new_session(index, 'sideways', 30)
                    state['finished'] = index < 20
                    db.add(SimulationSession(id=legacy_id if index == 20 else uid(), user_id=self.user_id if index < 22 else foreign_id,
                                             mode='guided', scenario_kind='sideways', version=1, snapshot_json=state))
        self.client.portal.call(history)
        with self.captured_queries() as statements:
            third = self.client.post('/api/simulations', json={'idempotency_key': self.key()})
            self.assertEqual(third.status_code, 201, third.text)
            fourth = self.client.post('/api/simulations', json={'idempotency_key': self.key()})
            self.assertEqual(fourth.status_code, 409, fourth.text)
        counts = [(sql, params) for sql, params in statements if 'FROM simulation_sessions' in sql]
        self.assertEqual(len(counts), 2)
        for sql, params in counts:
            self.assertIn('count(', sql.lower().split(' from ')[0])
            self.assertNotIn('snapshot_json', sql.split(' FROM ')[0])
            self.assertIn('simulation_sessions.user_id =', sql.split(' WHERE ')[1])
            self.assertIn(self.user_id, params)
        async def legacy_missing_flag():
            async with self.app.state.db.sessions.begin() as db:
                session = await db.get(SimulationSession, legacy_id)
                session.snapshot_json = {k: v for k, v in session.snapshot_json.items() if k != 'finished'}
        self.client.portal.call(legacy_missing_flag)
        self.assertEqual(self.client.post('/api/simulations', json={'idempotency_key': self.key()}).status_code, 409)
        self.assertEqual(self.client.post(self.path, json={'idempotency_key': self.key()}).status_code, 409)

    def test_audit_issues_explain_observed_errors_and_replay_preserves_first_response(self):
        self.ready()
        self.bind()
        body = {**order(type='limit', price='1.00', quantity=5), 'idempotency_key': self.key()}
        self.assertEqual(self.client.post(self.base + '/orders', json=body).status_code, 200)
        for _ in range(5):
            self.advance()
        claim = self.audit()['orders'][0]
        cases = [({'session_fees': '0.25'}, 'session_fees', '0.00'),
                 ({'orders': [{**claim, 'status': 'filled'}]}, 'order_status', 'open'),
                 ({'orders': [{**claim, 'filled_quantity': 1}]}, 'filled_quantity', 0),
                 ({'orders': [{**claim, 'limit_price': '1.01'}]}, 'unit_price', '1.00'),
                 ({'orders': []}, 'order_set', ['order-1']),
                 ({'price_limit_guarantees_fill': True}, 'limit_guarantee', False),
                 ({'no_order_reason': 'no_thesis_supplied'}, 'no_order_reason_with_orders', None)]
        first = None
        for changes, code, expected in cases:
            payload = {'idempotency_key': self.key(), 'audit': self.audit(**changes)}
            response = self.client.post(self.path + '/review', json=payload)
            self.assertEqual(response.status_code, 200, response.text)
            result = response.json()
            issue = next(i for i in result['feedback'][0]['issues'] if i['code'] == code)
            self.assertEqual(issue['expected'], expected)
            self.assertTrue(issue['message'])
            for private in ('seed', 'liquidity', 'prices', 'kind'):
                self.assertNotIn(private, issue)
            if first is None:
                first = (payload, result, deepcopy(self.saved()['run']['first_responses']))
            self.assertEqual(self.saved()['run']['first_responses'], first[2])
        self.assertEqual(self.review()['status'], 'completed')
        self.assertEqual(self.client.post(self.path + '/review', json=first[0]).json(), first[1])
        self.assertEqual(self.saved()['run']['first_responses'], first[2])

    def test_no_order_issue_feedback_distinguishes_missing_reason_and_current_ask(self):
        self.ready()
        self.bind()
        for _ in range(5):
            self.advance()
        self.change_session(lambda s: s['prices']['NORTH'].__setitem__(s['tick'], '40.00'))
        missing = self.review(no_order_reason=None)['feedback'][0]['issues'][0]
        self.assertEqual(missing['code'], 'no_order_reason_required')
        self.assertIn('no_thesis_supplied', missing['expected'])
        self.assertIn('reason', missing['message'])
        wrong = self.review(no_order_reason='current_ask_above_cap')['feedback'][0]['issues'][0]
        self.assertEqual(wrong['code'], 'current_ask_not_above_cap')
        self.assertEqual(wrong['observed'], {'current_ask': '40.04', 'unit_price_cap': '40.04'})
        self.assertIn('ask', wrong['message'])
        correct = self.review(no_order_reason='no_thesis_supplied')
        self.assertEqual(correct['feedback'][0]['issues'], [])
        self.assertEqual(correct['status'], 'completed')

    def test_malformed_bound_market_data_returns_conflict_without_mutation(self):
        self.ready()
        self.bind()
        replay_body = {'idempotency_key': self.key(), 'steps': 2}
        replay_response = self.client.post(self.base + '/advance', json=replay_body).json()
        for _ in range(4):
            self.advance()
        audit = self.audit()
        original = deepcopy(self.saved()['sessions'][0])
        mutations = [
            lambda s, field: s.pop(field),
            lambda s, field: s.update({field: None}),
            lambda s, field: s.update({field: 'not a dictionary'}),
            lambda s, field: s[field].pop('NORTH'),
            lambda s, field: s[field].update(EXTRA=[1] * 30),
            lambda s, field: s[field].update(NORTH=s[field]['NORTH'][:10]),
            lambda s, field: s[field].update(NORTH=5),
            lambda s, field: s[field].update(NORTH={'tick': 10}),
            lambda s, field: s[field]['HARBOR'].__setitem__(s['tick'], 'not numeric'),
            lambda s, field: s[field]['NORTH'].__setitem__(s['tick'], None),
            lambda s, field: s[field]['NORTH'].__setitem__(s['tick'], True),
            lambda s, field: s[field]['NORTH'].__setitem__(s['tick'], {}),
            lambda s, field: s[field]['NORTH'].__setitem__(29, 'not numeric'),
        ]
        with TestClient(create_app(self.settings, self.content), headers={'Origin': 'http://localhost:5173'}, raise_server_exceptions=False) as worker:
            worker.cookies.set(self.settings.cookie_name, self.client.cookies.get(self.settings.cookie_name))
            for field in ('prices', 'liquidity'):
                for index, mutate in enumerate(mutations):
                    with self.subTest(field=field, mutation=index):
                        self.change_session(lambda s: s.update(deepcopy(original)))
                        self.change_session(lambda s: mutate(s, field))
                        before = self.saved()
                        for path in (self.path, self.base):
                            response = worker.get(path)
                            self.assertEqual(response.status_code, 409, response.text)
                        response = worker.post(self.base + '/advance', json={'idempotency_key': self.key(), 'steps': 1})
                        self.assertEqual(response.status_code, 409, response.text)
                        response = worker.post(self.path + '/review', json={'idempotency_key': self.key(), 'audit': audit})
                        self.assertEqual(response.status_code, 409, response.text)
                        self.assertEqual(worker.post(self.base + '/advance', json=replay_body).json(), replay_response)
                        self.assertEqual(self.saved(), before)
            for field, value in (('prices', '0.00'), ('prices', '-1.00'), ('prices', 'NaN'), ('prices', '1e1000'), ('liquidity', -1), ('liquidity', 1.5)):
                with self.subTest(field=field, value=value):
                    self.change_session(lambda s: s.update(deepcopy(original)))
                    self.change_session(lambda s: s[field]['NORTH'].__setitem__(s['tick'], value))
                    before = self.saved()
                    self.assertEqual(worker.get(self.path).status_code, 409)
                    self.assertEqual(self.saved(), before)
        self.change_session(lambda s: s.update(deepcopy(original)))
        self.assertEqual(self.client.get(self.path).status_code, 200)
        self.assertEqual(self.review()['status'], 'completed')

    def test_zero_liquidity_remains_a_valid_nonfill_case(self):
        self.ready()
        self.bind()
        self.change_session(lambda s: s['liquidity'].update(NORTH=[0] * 30))
        body = {**order(type='limit', price=self.view['bound_policy']['unit_price_cap'], quantity=1), 'idempotency_key': self.key()}
        response = self.client.post(self.base + '/orders', json=body)
        self.assertEqual(response.status_code, 200, response.text)
        for _ in range(5):
            self.advance()
        self.assertEqual(self.view['orders'][0]['filled'], 0)
        self.assertEqual(self.view['fees'], '0.00')
        self.assertEqual(self.view['quotes'][0]['available_units'], 0)
        self.assertEqual(self.review()['status'], 'completed')

    def test_session_list_projects_owned_learning_pointer_after_completion(self):
        self.ready()
        self.bind()
        bound_id = self.view['id']
        unbound = self.client.post('/api/simulations', json={'idempotency_key': self.key()}).json()
        unbound_base = '/api/simulations/' + unbound['id']
        for _ in range(5):
            self.advance()
        self.assertEqual(self.review()['status'], 'completed')
        for _ in range(2):
            self.assertEqual(self.client.post(unbound_base + '/advance', json={'idempotency_key': self.key(), 'steps': 5}).status_code, 200)
        self.assertEqual(self.client.post(unbound_base + '/debrief', json={'idempotency_key': self.key(), 'reflection': 'I observed this generic practice session without submitting any orders.'}).status_code, 200)
        with self.captured_queries() as statements:
            response = self.client.get('/api/simulations')
        self.assertEqual(response.status_code, 200, response.text)
        sessions = {s['id']: s for s in response.json()['sessions']}
        self.assertEqual(set(sessions), {bound_id, unbound['id']})
        self.assertEqual(sessions[bound_id]['learning_run_id'], self.run['id'])
        self.assertIsNone(sessions[unbound['id']]['learning_run_id'])
        for item in sessions.values():
            self.assertEqual(set(item), {'id', 'mode', 'tick', 'finished', 'updated_at', 'learning_run_id'})
            self.assertEqual(item['mode'], 'guided')
            self.assertTrue(item['finished'])
            self.assertEqual(item['tick'], 10)
        queries = [(sql, params) for sql, params in statements if 'FROM simulation_sessions' in sql]
        self.assertEqual(len(queries), 1)
        sql, params = queries[0]
        projection = sql.split(' FROM ')[0]
        self.assertNotRegex(projection, r'(?:SELECT |, )simulation_sessions\.snapshot_json(?:,| AS |$)')
        self.assertNotRegex(projection, r'(?:SELECT |, )learning_runs\.(?:snapshot_json|state_json)(?:,| AS |$)')
        self.assertIn('learning_runs.user_id =', sql)
        self.assertIn('simulation_sessions.user_id =', sql)
        self.assertIn(self.user_id, params)
        self.client.cookies.clear()
        self.client.post('/api/session')
        self.assertEqual(self.client.get('/api/simulations').json(), {'sessions': []})

    def test_legacy_snapshot_one_and_step_command_hash_remain_compatible(self):
        import hashlib
        import json
        async def legacy():
            async with self.app.state.db.sessions.begin() as db:
                run = await db.get(LearningRun, self.run['id'])
                snapshot = deepcopy(run.snapshot_json)
                snapshot.pop('simulation_binding')
                snapshot['rubric_version'] = 'interactive-1'
                snapshot['tasks'] = snapshot['tasks'][:-1]
                run.snapshot_json = snapshot
        self.client.portal.call(legacy)
        task = self.lesson['tasks'][0]
        body = {'idempotency_key': self.key(), 'answer': {'acknowledged': True}}
        path = f"/api/learning-runs/{self.run['id']}/steps/{task['id']}/submit"
        first = self.client.post(path, json=body)
        self.assertEqual(first.status_code, 200, first.text)
        encoded = json.dumps({'operation': 'submit-step', 'target': [self.run['id'], task['id']], 'payload': {'answer': {'acknowledged': True, 'option_id': None, 'assignments': None, 'confidence': None}}}, sort_keys=True, separators=(',', ':'))
        expected = hashlib.sha256(encoded.encode()).hexdigest()
        async def digest():
            async with self.app.state.db.sessions() as db:
                return (await db.get(LearningRunCommand, (self.user_id, body['idempotency_key']))).request_hash
        self.assertEqual(self.client.portal.call(digest), expected)
        result = first.json()
        for task in self.lesson['tasks'][1:-1]:
            result = self.submit(result, task)
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(result['result']['xp_awarded'], 20)
        self.assertEqual(self.client.post(path, json=body).json(), first.json())
        self.assertEqual(self.saved()['sessions'], [])
