from copy import deepcopy
from concurrent.futures import ThreadPoolExecutor
import json
from datetime import datetime
from dataclasses import replace
import tempfile
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import select, text

from app.challenges import core
from app.challenges.models import ChallengeAttempt, ChallengeCommand
from app.db import Database
from app.main import create_app
from app.migrations import MIGRATIONS
from unittest.mock import patch
from app.migration_v5 import upgrade
from app.simulation import engine
import test_learning as fixtures
from test_simulation import order


class ChallengeCoreTests(unittest.TestCase):
    def test_equal_market_start_duration_and_actual_opponent_orders(self):
        snapshot = core.new_snapshot(123, 'rising', 3)
        human = snapshot['human']
        for agent in snapshot['agents']:
            for key in ('seed', 'prices', 'liquidity', 'initial_cash', 'tick'):
                self.assertEqual(agent['state'][key], human[key])
        self.assertEqual(len(snapshot['agents'][0]['state']['orders']), 4)
        for _ in range(6):
            core.advance(snapshot, 5)
        self.assertEqual([agent['state']['tick'] for agent in snapshot['agents']], [29] * 3)
        self.assertTrue(all(agent['state']['fills'] for agent in snapshot['agents']))
        result = core.complete(snapshot, 'I observed without a thesis and compared the final outcomes.')
        for entry in result['leaderboard']:
            self.assertEqual(engine.amount(entry['profit']), engine.amount(entry['final_value']) - 10000)
        self.assertEqual(result['final_tick'], 29)

    def test_strategy_never_uses_future_prices(self):
        a = engine.new_session(12, 'volatile', ticks=30)
        b = deepcopy(a)
        for symbol in engine.SYMBOLS:
            b['prices'][symbol][1:] = ['999.00'] * 29
        core.ai_decision(a, 'basket')
        core.ai_decision(b, 'basket')
        self.assertEqual(a['orders'], b['orders'])

        for state in (a, b):
            state['tick'] = 5
            for symbol in engine.SYMBOLS:
                state['prices'][symbol][:6] = ['40.00', '41.00', '42.00', '43.00', '44.00', '45.00']
            state['orders'] = []
        core.ai_decision(a, 'momentum')
        core.ai_decision(b, 'momentum')
        self.assertEqual(a['orders'], b['orders'])

    def test_private_authoring_metadata_never_becomes_public_policy(self):
        snapshot = core.new_snapshot(1, 'rising', policy={'seed': 99, 'answer': 'secret',
            'profit': 'client-profit', 'objective': 'Compare order costs', 'difficulty': 'chapter-2'})
        self.assertNotIn('seed', snapshot['policy'])
        self.assertNotIn('answer', snapshot['policy'])
        self.assertEqual(snapshot['policy']['profit'], core.POLICY['profit'])
        self.assertEqual(snapshot['policy']['objective'], 'Compare order costs')

    def test_ties_are_joint_rank_and_not_a_human_victory(self):
        snapshot = core.new_snapshot(4, 'sideways')
        for state in [snapshot['human'], snapshot['agents'][0]['state']]:
            state['tick'] = 29
            state['orders'] = []
        result = core.complete(snapshot, 'I observed without executing an order and kept the initial cash.')
        self.assertFalse(result['win'])
        self.assertEqual([entry['rank'] for entry in result['leaderboard']], [1, 1])

    def test_human_must_outperform_all_ai_and_fees_count_once(self):
        snapshot = core.new_snapshot(4, 'sideways', 3)
        for state in [snapshot['human'], *[a['state'] for a in snapshot['agents']]]:
            state.update(tick=29, orders=[], cash='10001.00', fees='2.00')
        snapshot['agents'][2]['state']['cash'] = '10002.00'
        result = core.complete(snapshot, 'This fixture tests the shared profit rule for multiple opponents.')
        self.assertEqual(result['profit'], '1.00')
        self.assertFalse(result['win'])
        snapshot = core.new_snapshot(4, 'sideways', 3)
        for state in [snapshot['human'], *[a['state'] for a in snapshot['agents']]]:
            state.update(tick=29, orders=[], cash='10000.00')
        snapshot['human']['cash'] = '10001.00'
        self.assertTrue(core.complete(snapshot, 'The human strictly outperforms every other participant here.')['win'])

    def test_json_restart_matches_uninterrupted_strategy(self):
        a = core.new_snapshot(99, 'volatile', 3)
        core.advance(a, 5)
        b = json.loads(json.dumps(a))
        for _ in range(5):
            core.advance(a, 5)
            core.advance(b, 5)
        self.assertEqual(a, b)


class ChallengeAPITests(unittest.TestCase):
    tearDown = fixtures.LearningTests.tearDown
    body = fixtures.LearningTests.body
    complete_module = fixtures.LearningTests.complete_module

    def setUp(self):
        fixtures.LearningTests.setUp(self)

    def unlock(self):
        for index in range(4):
            self.complete_module(index)

    def start(self, key='create-challenge-key', **changes):
        return self.client.post('/api/challenges', json={'idempotency_key': key, **changes})

    def final_tick(self, identifier):
        for index in range(6):
            result = self.client.post(f'/api/challenges/{identifier}/advance', json={
                'steps': 5, 'idempotency_key': f'advance-challenge-{index}'})
            self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()['player']['tick'], 29)

    def test_start_prerequisites_payload_and_private_future(self):
        self.assertEqual(self.start().status_code, 403)
        self.unlock()
        first = self.start(opponent_count=3)
        self.assertEqual(first.status_code, 201, first.text)
        self.assertEqual(self.start(opponent_count=3).json(), first.json())
        view = first.json()
        self.assertEqual(len(view['opponents']), 3)
        self.assertEqual([len(values) for values in view['player']['history'].values()], [1] * 4)
        for key in ('seed', 'kind', 'prices', 'liquidity', 'strategy', 'events'):
            self.assertNotIn(key, view['player'])
            self.assertNotIn(key, view['opponents'][0])
        self.assertIsNone(view['result'])
        self.assertEqual(self.start(key='forged-challenge-key', seed=1).status_code, 422)
        self.assertEqual(self.start(key='forged-profit-key', profit='100').status_code, 422)
        self.assertEqual(self.start(key='unknown-mode-key', mode='ranked').status_code, 422)
        self.assertEqual(self.start(key='unknown-daily-key', mode='daily').status_code, 201)
        self.assertEqual(self.start(key='practice-module-key', module_id='m2').status_code, 422)

    def test_ownership_plan_order_cancel_and_no_early_reward(self):
        self.unlock()
        identifier = self.start().json()['id']
        path = f'/api/challenges/{identifier}'
        calls = []
        async def reward(db, user, result):
            calls.append(result)
            return {'xp': 5}
        self.app.state.challenge_result_handler = reward
        body = {**order(type='limit', price='1', quantity=1), 'idempotency_key': 'challenge-order-key'}
        self.assertEqual(self.client.post(path + '/orders', json={**body, 'plan': {}}).status_code, 422)
        self.assertEqual(self.client.get(path).json()['player']['orders'], [])
        accepted = self.client.post(path + '/orders', json=body)
        self.assertEqual(accepted.status_code, 200, accepted.text)
        self.assertEqual(self.client.post(path + '/orders', json=body).json(), accepted.json())
        cancelled = self.client.post(path + '/orders/order-1/cancel', json={'idempotency_key': 'challenge-cancel-key'})
        self.assertEqual(cancelled.json()['player']['orders'][0]['status'], 'cancelled')
        completion = {'idempotency_key': 'challenge-complete-key', 'reflection': 'I kept the plan and evaluated costs without changing my price.'}
        self.assertEqual(self.client.post(path + '/complete', json=completion).status_code, 422)
        self.assertEqual(calls, [])
        self.final_tick(identifier)
        finished = self.client.post(path + '/complete', json=completion)
        self.assertEqual(finished.status_code, 200, finished.text)
        self.assertEqual(finished.json()['result']['awards'], {'xp': 5})
        self.assertEqual(len(calls), 1)
        self.assertEqual(self.client.post(path + '/complete', json=completion).json(), finished.json())
        self.assertEqual(len(calls), 1)
        self.assertEqual(self.client.post(path + '/advance', json={'steps': 1, 'idempotency_key': 'after-complete-key'}).status_code, 409)
        self.client.cookies.clear()
        self.client.post('/api/session')
        self.assertEqual(self.client.get(path).status_code, 404)
        self.assertEqual(self.client.post(path + '/complete', json=completion).status_code, 404)
        self.assertEqual(self.client.get('/api/challenges').json()['attempts'], [])

    def test_concurrent_exact_replay_and_history_records_observed_decision(self):
        self.unlock()
        identifier = self.start().json()['id']
        path = f'/api/challenges/{identifier}/advance'
        body = {'steps': 5, 'idempotency_key': 'concurrent-challenge-key'}
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: self.client.post(path, json=body), range(2)))
        self.assertEqual([r.status_code for r in results], [200, 200])
        self.assertEqual(results[0].json(), results[1].json())
        self.assertEqual(self.client.post(path, json={**body, 'steps': 1}).status_code, 409)
        async def inspect():
            async with self.app.state.db.sessions() as db:
                attempt = await db.get(ChallengeAttempt, identifier)
                return attempt.snapshot_json['events']
        events = self.client.portal.call(inspect)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]['before']['tick'], 0)
        self.assertEqual(events[0]['after']['tick'], 5)
        self.assertEqual([len(v) for v in events[0]['before']['history'].values()], [1] * 4)
        self.assertEqual(events[0]['payload'], {'steps': 5})
        self.assertEqual(events[0]['attempt_number'], 1)
        self.assertIsNotNone(datetime.fromisoformat(events[0]['recorded_at']).tzinfo)

    def test_saved_orders_replay_before_retired_version_and_survive_restart(self):
        self.unlock()
        identifier = self.start().json()['id']
        path = f'/api/challenges/{identifier}/orders'
        body = {**order(quantity=1), 'idempotency_key': 'restart-challenge-key'}
        before = self.client.post(path, json=body).json()
        token = self.client.cookies.get(self.settings.cookie_name)
        restarted_app = create_app(self.settings, self.content)
        with TestClient(restarted_app, headers={'Origin': 'http://localhost:5173'}) as restarted:
            restarted.cookies.set(self.settings.cookie_name, token)
            self.assertEqual(restarted.post(path, json=body).json(), before)
            self.assertEqual(len(restarted.get(f'/api/challenges/{identifier}').json()['player']['orders']), 1)
        async def retire():
            async with self.app.state.db.sessions.begin() as db:
                attempt = await db.get(ChallengeAttempt, identifier)
                attempt.version = 'retired'
        self.client.portal.call(retire)
        self.assertEqual(self.client.post(path, json=body).json(), before)
        self.assertEqual(self.client.get(f'/api/challenges/{identifier}').status_code, 409)
        self.assertEqual(self.client.post(path, json={**body, 'idempotency_key': 'new-version-challenge'}).status_code, 409)

    def test_unapproved_saved_content_blocks_production_fresh_commands_but_replays(self):
        self.unlock()
        identifier = self.start().json()['id']
        path = f'/api/challenges/{identifier}/advance'
        body = {'steps': 1, 'idempotency_key': 'before-production-key'}
        saved = self.client.post(path, json=body).json()
        self.app.state.settings = replace(self.settings, environment='production')
        self.assertEqual(self.client.post(path, json=body).json(), saved)
        self.assertEqual(self.client.get(f'/api/challenges/{identifier}').status_code, 503)
        self.assertEqual(self.client.post(path, json={**body, 'idempotency_key': 'unapproved-fresh-key'}).status_code, 503)

    def test_active_cap_abandon_does_not_invoke_completion_hook(self):
        self.unlock()
        calls = []
        async def reward(db, user, result):
            calls.append(result)
        self.app.state.challenge_result_handler = reward
        first = self.start().json()
        self.assertEqual(self.start(key='second-challenge-key').status_code, 201)
        self.assertEqual(self.start(key='third-challenge-key').status_code, 201)
        self.assertEqual(self.start(key='fourth-challenge-key').status_code, 409)
        body = {'idempotency_key': 'abandon-challenge-key'}
        abandoned = self.client.post(f"/api/challenges/{first['id']}/abandon", json=body)
        self.assertEqual(abandoned.json()['status'], 'abandoned')
        self.assertIsNone(abandoned.json()['result'])
        self.assertEqual(calls, [])
        self.assertEqual(self.client.post(f"/api/challenges/{first['id']}/abandon", json=body).json(), abandoned.json())
        self.assertEqual(self.start(key='fourth-challenge-key').status_code, 201)

    def test_mode_start_and_abandon_hooks_are_owned_atomic_and_replay_once(self):
        starts, losses = [], []
        async def start_handler(request, db, user, body):
            starts.append(body.mode)
            return {'challenge_id': 'daily-2026-10-06', 'mode': 'daily', 'seed': 1, 'kind': 'falling'}
        async def abandon_handler(db, user, result):
            losses.append(result)
        self.app.state.challenge_start_handler = start_handler
        self.app.state.challenge_abandon_handler = abandon_handler
        first = self.start(mode='daily')
        self.assertEqual(first.status_code, 201, first.text)
        self.assertEqual(self.start(mode='daily').json(), first.json())
        self.assertEqual(starts, ['daily'])
        identifier = first.json()['id']
        payload = {'idempotency_key': 'daily-abandon-key'}
        abandoned = self.client.post(f'/api/challenges/{identifier}/abandon', json=payload)
        self.assertEqual(abandoned.status_code, 200, abandoned.text)
        self.assertEqual(self.client.post(f'/api/challenges/{identifier}/abandon', json=payload).json(), abandoned.json())
        self.assertEqual(len(losses), 1)
        self.assertEqual(losses[0]['status'], 'abandoned')
        self.assertFalse(losses[0]['win'])
        self.assertNotIn('profit', losses[0])
        second = self.start(key='daily-second-key', mode='daily')
        self.assertEqual(second.json()['attempt_number'], 2)

    def test_result_hook_failure_rolls_back_completion_command_and_state(self):
        self.unlock()
        identifier = self.start().json()['id']
        self.final_tick(identifier)
        async def failing(db, user, result):
            raise RuntimeError('award unavailable')
        self.app.state.challenge_result_handler = failing
        body = {'idempotency_key': 'atomic-completion-key', 'reflection': 'I observed the entire scenario and evaluated my planned decisions.'}
        with self.assertRaises(RuntimeError):
            self.client.post(f'/api/challenges/{identifier}/complete', json=body)
        self.assertEqual(self.client.get(f'/api/challenges/{identifier}').json()['status'], 'active')
        async def saved():
            async with self.app.state.db.sessions() as db:
                return await db.scalar(select(ChallengeCommand).where(ChallengeCommand.key == body['idempotency_key']))
        self.assertIsNone(self.client.portal.call(saved))
        del self.app.state.challenge_result_handler
        self.assertEqual(self.client.post(f'/api/challenges/{identifier}/complete', json=body).status_code, 200)

    def test_migration_keeps_populated_profile_and_is_repeatable(self):
        async def run():
            with tempfile.TemporaryDirectory() as directory:
                database = Database(fixtures.Settings(database_url=f'sqlite+aiosqlite:///{directory}/migration.db'))
                with patch('app.migrations.MIGRATIONS', MIGRATIONS[:4]):
                    await database.migrate()
                async with database.engine.begin() as connection:
                    await connection.execute(text("INSERT INTO profiles (id, display_name, leaderboard_opt_in, analytics_opt_in, created_at) VALUES ('kept', 'Learner', 0, 0, CURRENT_TIMESTAMP)"))
                    before = (await connection.execute(text('SELECT * FROM profiles'))).all()
                    await upgrade(connection)
                    await upgrade(connection)
                    self.assertEqual((await connection.execute(text('SELECT * FROM profiles'))).all(), before)
                    self.assertEqual((await connection.execute(text('SELECT COUNT(*) FROM challenge_attempts'))).scalar(), 0)
                    self.assertEqual((await connection.execute(text('SELECT COUNT(*) FROM challenge_commands'))).scalar(), 0)
                await database.engine.dispose()
        self.client.portal.call(run)


if __name__ == '__main__':
    unittest.main()
