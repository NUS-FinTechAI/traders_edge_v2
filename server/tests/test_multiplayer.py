from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
import os
import tempfile
import unittest
import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.engine import make_url

from app.config import Settings
from app.main import create_app
from app.migration_v9 import upgrade
from app.multiplayer import core
from app.multiplayer.models import MultiplayerCommand, MultiplayerJoinThrottle, MultiplayerLobby
from app.simulation import engine
import test_learning as fixtures
from test_simulation import order


class MultiplayerCoreTests(unittest.TestCase):
    def test_elo_shared_profit_ties_and_forfeits(self):
        self.assertEqual(core.elo_delta(1000, 1000, 1), 16)
        self.assertEqual(core.elo_delta(1000, 1000, 0), -16)
        self.assertEqual(core.elo_delta(1000, 1000, 0.5), 0)
        self.assertLess(core.elo_delta(1400, 1000, 1), 16)
        snapshot = {'participants': {'a': core.waiting_participant('A', 1), 'b': core.waiting_participant('B', 1)}}
        core.start(snapshot, 12, 'falling')
        a, b = snapshot['participants'].values()
        for participant in (a, b):
            participant['state']['tick'] = 29
        result = core.result(snapshot)
        self.assertEqual([entry['rank'] for entry in result['leaderboard']], [1, 1])
        self.assertFalse(any(entry['win'] for entry in result['leaderboard']))
        a['forfeit'] = True
        a['state']['cash'] = '10020.00'
        result = core.result(snapshot)
        self.assertEqual(result['leaderboard'][0]['user_id'], 'b')
        self.assertTrue(result['leaderboard'][0]['win'])
        self.assertEqual(result['leaderboard'][1]['profit'], '20.00')
        a['forfeit'] = False
        a['state'].update(cash='10001.00', fees='2.00')
        self.assertEqual(core.result(snapshot)['leaderboard'][0]['profit'], '1.00')

    def test_ready_barrier_and_identical_observations(self):
        snapshot = {'participants': {'a': core.waiting_participant('A', 1), 'b': core.waiting_participant('B', 1)}}
        core.start(snapshot, 12, 'volatile')
        a, b = snapshot['participants'].values()
        self.assertEqual(a['state'], b['state'])
        a['ready'] = True
        self.assertFalse(core.advance_if_ready(snapshot))
        self.assertEqual(a['state']['tick'], 0)
        b['ready'] = True
        self.assertTrue(core.advance_if_ready(snapshot))
        self.assertEqual(a['state']['tick'], 1)
        self.assertEqual(engine.public_view(a['state'])['quotes'], engine.public_view(b['state'])['quotes'])
        self.assertFalse(a['ready'])
        self.assertFalse(b['ready'])


class MultiplayerAPITests(unittest.TestCase):
    postgres = False

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.content = fixtures.fixture_catalog()
        self.schema = None
        url = f'sqlite+aiosqlite:///{self.temp.name}/multiplayer.db'
        if self.postgres:
            import psycopg
            from psycopg import sql
            self.base_url = make_url(os.environ['TRADERS_EDGE_TEST_POSTGRES_URL'])
            if (self.base_url.drivername != 'postgresql+psycopg'
                    or self.base_url.host not in {'127.0.0.1', 'localhost', '::1'}
                    or not (self.base_url.database or '').startswith('traders_edge_qa')
                    or self.base_url.query):
                raise ValueError('PostgreSQL tests require a loopback disposable traders_edge_qa database without connection options')
            self.schema = 'traders_edge_qa_multiplayer_' + uuid.uuid4().hex
            with psycopg.connect(self.base_url.set(drivername='postgresql').render_as_string(hide_password=False), autocommit=True) as connection:
                connection.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(self.schema)))
            url = self.base_url.update_query_dict({'options': f'-csearch_path={self.schema}'}).render_as_string(hide_password=False)
        self.settings = Settings(database_url=url)
        self.app = create_app(self.settings, self.content)
        self.client = TestClient(self.app, headers={'Origin': 'http://localhost:5173'})
        self.client.__enter__()
        self.tokens = []
        self.counter = 0
        self.observed_commands = {}
        for _ in range(2):
            self.client.cookies.clear()
            self.client.post('/api/session')
            self.tokens.append(self.client.cookies.get(self.settings.cookie_name))
            for index in range(9):
                fixtures.LearningTests.complete_module(self, index)
        self.client.cookies.clear()
        self.other_app = create_app(replace(self.settings, auto_migrate=False), self.content)
        self.other = TestClient(self.other_app, headers={'Origin': 'http://localhost:5173'})
        self.other.__enter__()

    body = fixtures.LearningTests.body

    def tearDown(self):
        self.other.__exit__(None, None, None)
        self.client.__exit__(None, None, None)
        if self.schema:
            import psycopg
            from psycopg import sql
            with psycopg.connect(self.base_url.set(drivername='postgresql').render_as_string(hide_password=False), autocommit=True) as connection:
                connection.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(self.schema)))
        self.temp.cleanup()

    def post(self, player, path, body, worker=None):
        if path.endswith('/ready') or path.endswith('/orders') or path.endswith('/cancel'):
            key = (player, body['idempotency_key'])
            if key not in self.observed_commands:
                observed = self.get(player, '/' + path.split('/')[1], worker).json().get('player')
                self.observed_commands[key] = observed['tick'] if observed else 0
            body = {'expected_tick': self.observed_commands[key], **body}
        return (worker or self.client).post('/api/multiplayer' + path, json=body,
            headers={'Cookie': f'{self.settings.cookie_name}={self.tokens[player]}'})

    def get(self, player, path, worker=None):
        return (worker or self.client).get('/api/multiplayer' + path,
            headers={'Cookie': f'{self.settings.cookie_name}={self.tokens[player]}'})

    def private(self):
        first = self.post(0, '/lobbies', {'idempotency_key': 'private-create-key'})
        self.assertEqual(first.status_code, 201, first.text)
        joined = self.post(1, '/join', {'idempotency_key': 'private-join-key', 'code': first.json()['join_code']})
        self.assertEqual(joined.status_code, 200, joined.text)
        identifier = first.json()['id']
        started = self.post(0, f'/{identifier}/start', {'idempotency_key': 'private-start-key'})
        self.assertEqual(started.status_code, 200, started.text)
        return identifier

    def public(self):
        queued = self.post(0, '/matchmaking', {'idempotency_key': 'public-queue-first'})
        paired = self.post(1, '/matchmaking', {'idempotency_key': 'public-queue-second'}, self.other)
        self.assertEqual(queued.status_code, 200, queued.text)
        self.assertEqual(paired.status_code, 200, paired.text)
        self.assertEqual(queued.json()['id'], paired.json()['id'])
        self.assertEqual(paired.json()['status'], 'active')
        return paired.json()['id']

    def finish(self, identifier, from_tick=0, forfeit=None):
        for tick in range(from_tick, 29):
            for player in (0, 1):
                if player == forfeit:
                    continue
                response = self.post(player, f'/{identifier}/ready', {'idempotency_key': f'ready-player-{player}-tick-{tick}'})
                self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['status'], 'finished')
        return response.json()

    def test_private_host_start_ownership_codes_and_no_future(self):
        first = self.post(0, '/lobbies', {'idempotency_key': 'private-create-key'})
        identifier, code = first.json()['id'], first.json()['join_code']
        self.assertEqual(self.post(0, '/lobbies', {'idempotency_key': 'private-create-key'}).json(), first.json())
        self.assertEqual(self.post(0, f'/{identifier}/start', {'idempotency_key': 'too-early-start-key'}).status_code, 409)
        self.assertEqual(self.get(1, f'/{identifier}').status_code, 404)
        joined = self.post(1, '/join', {'idempotency_key': 'private-join-key', 'code': code})
        self.assertEqual(joined.status_code, 200, joined.text)
        self.assertNotIn('join_code', joined.json())
        self.assertEqual(self.post(1, f'/{identifier}/start', {'idempotency_key': 'nonhost-start-key'}).status_code, 403)
        started = self.post(0, f'/{identifier}/start', {'idempotency_key': 'private-start-key'})
        view = started.json()
        self.assertEqual([len(v) for v in view['player']['history'].values()], [1] * 4)
        for key in ('seed', 'kind', 'prices', 'liquidity', 'events'):
            self.assertNotIn(key, view['player'])
            self.assertNotIn(key, view['participants'][0])
        self.assertEqual(self.get(1, f'/{identifier}').json()['player']['quotes'], view['player']['quotes'])
        self.assertEqual(self.post(1, '/join', {'idempotency_key': 'late-private-join', 'code': code}).status_code, 404)

    def test_private_results_and_reflections_never_rate_or_award(self):
        identifier = self.private()
        calls = []
        async def awards(db, user, result):
            calls.append(result)
        self.app.state.multiplayer_result_handler = awards
        result = self.finish(identifier)
        self.assertEqual([entry['rank'] for entry in result['result']['leaderboard']], [1, 1])
        for player in (0, 1):
            body = {'idempotency_key': f'private-complete-{player}', 'reflection': 'I observed the shared market without supplying a trading thesis.'}
            completed = self.post(player, f'/{identifier}/complete', body)
            self.assertEqual(completed.status_code, 200, completed.text)
            self.assertEqual(completed.json()['awards'], {})
            self.assertEqual(self.post(player, f'/{identifier}/complete', body).json(), completed.json())
        self.assertEqual(calls, [])
        self.assertEqual(self.get(0, '/leaderboard').json()['players'], [])
        for token in self.tokens:
            profile = self.client.get('/api/me/profile', headers={'Cookie': f'{self.settings.cookie_name}={token}'}).json()
            self.assertEqual(profile['game_xp'], 0)

    def test_planned_orders_ready_barrier_cancel_and_owned_actions(self):
        identifier = self.private()
        body = {**order(type='limit', price='1', quantity=1), 'idempotency_key': 'multiplayer-order-key'}
        self.assertEqual(self.post(0, f'/{identifier}/orders', {**body, 'plan': {}}).status_code, 422)
        accepted = self.post(0, f'/{identifier}/orders', body)
        self.assertEqual(accepted.status_code, 200, accepted.text)
        self.assertEqual(self.post(0, f'/{identifier}/orders', body).json(), accepted.json())
        self.assertEqual(self.get(1, f'/{identifier}').json()['player']['orders'], [])
        self.assertEqual(self.post(1, f'/{identifier}/orders/order-1/cancel', {'idempotency_key': 'other-cancel-key'}).status_code, 422)
        self.assertEqual(self.post(0, f'/{identifier}/orders/order-1/cancel', {'idempotency_key': 'own-cancel-key'}).status_code, 200)
        ready = self.post(0, f'/{identifier}/ready', {'idempotency_key': 'barrier-first-ready'})
        self.assertEqual(ready.json()['player']['tick'], 0)
        self.assertEqual(self.post(0, f'/{identifier}/ready', {'idempotency_key': 'duplicate-ready-key'}).status_code, 409)
        self.assertEqual(self.post(0, f'/{identifier}/orders', {**body, 'idempotency_key': 'ready-order-key'}).status_code, 409)
        advanced = self.post(1, f'/{identifier}/ready', {'idempotency_key': 'barrier-second-ready'})
        self.assertEqual(advanced.json()['player']['tick'], 1)
        self.assertEqual(self.post(0, f'/{identifier}/ready', {'idempotency_key': 'barrier-first-ready'}).json(), ready.json())
        self.assertEqual(self.get(0, f'/{identifier}').json()['player']['tick'], 1)
        self.assertEqual(self.post(0, f'/{identifier}/complete', {'idempotency_key': 'early-complete-key',
            'reflection': 'I observed the scenario and would like to finish before its shared endpoint.'}).status_code, 409)

    def test_two_workers_empty_public_queue_pair_once_and_rejoin(self):
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(self.post, index, '/matchmaking', {'idempotency_key': f'worker-queue-key-{index}'},
                self.client if index == 0 else self.other) for index in (0, 1)]
            results = [future.result(timeout=20) for future in futures]
        self.assertEqual([response.status_code for response in results], [200, 200], [response.text for response in results])
        self.assertEqual(results[0].json()['id'], results[1].json()['id'])
        identifier = results[0].json()['id']
        view = self.get(0, f'/{identifier}').json()
        self.assertEqual(view['status'], 'active')
        self.assertEqual(len(view['participants']), 2)
        self.assertEqual(self.post(0, '/matchmaking', {'idempotency_key': 'already-queued-key'}).json()['id'], identifier)
        self.assertEqual(len(self.get(0, '/matches').json()['matches']), 1)

    def test_two_workers_final_ready_rates_once_tie_and_frozen_result(self):
        identifier = self.public()
        for tick in range(28):
            for player in (0, 1):
                self.assertEqual(self.post(player, f'/{identifier}/ready', {'idempotency_key': f'pre-final-{player}-{tick}'}).status_code, 200)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(self.post, player, f'/{identifier}/ready', {'idempotency_key': f'final-worker-{player}'},
                self.client if player == 0 else self.other) for player in (0, 1)]
            results = [future.result(timeout=20) for future in futures]
        self.assertEqual([response.status_code for response in results], [200, 200], [response.text for response in results])
        result = self.get(0, f'/{identifier}').json()['result']
        self.assertEqual(result['final_tick'], 29)
        self.assertEqual([entry['rating_after'] for entry in result['leaderboard']], [1000, 1000])
        self.assertEqual([entry['rating_delta'] for entry in result['leaderboard']], [0, 0])
        self.assertEqual(self.post(0, f'/{identifier}/abandon', {'idempotency_key': 'late-abandon-key'}).status_code, 409)
        self.assertEqual(self.get(0, f'/{identifier}').json()['result'], result)
        for player in (0, 1):
            self.assertEqual(self.post(player, f'/{identifier}/ready', {'idempotency_key': f'final-worker-{player}'}).json(), results[player].json())
            self.assertEqual(self.get(player, '/leaderboard').json()['your_matches'], 1)

    def test_forfeit_below_finisher_and_own_public_award_once(self):
        identifier = self.public()
        calls = []
        async def awards(db, user, result):
            calls.append(result)
            return {'xp': 20, 'premium': 10 if result['win'] else 0}
        self.app.state.multiplayer_result_handler = awards
        abandoned = self.post(0, f'/{identifier}/abandon', {'idempotency_key': 'forfeit-match-key'})
        self.assertEqual(abandoned.status_code, 200, abandoned.text)
        finished = self.finish(identifier, forfeit=0)
        entries = finished['result']['leaderboard']
        self.assertFalse(entries[0]['forfeit'])
        self.assertTrue(entries[0]['win'])
        self.assertEqual(entries[0]['rating_after'], 1016)
        self.assertEqual(entries[1]['rating_after'], 984)
        self.assertEqual(self.post(0, f'/{identifier}/complete', {'idempotency_key': 'forfeit-complete-key',
            'reflection': 'I forfeited before the shared final observation and cannot claim completion.'}).status_code, 409)
        body = {'idempotency_key': 'public-complete-key', 'reflection': 'I completed the observations and reviewed the shared net-profit result.'}
        completed = self.post(1, f'/{identifier}/complete', body)
        self.assertEqual(completed.status_code, 200, completed.text)
        self.assertEqual(completed.json()['awards'], {'xp': 20, 'premium': 10})
        self.assertEqual(self.post(1, f'/{identifier}/complete', body).json(), completed.json())
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]['mode'], 'public_ranked')
        self.assertEqual(calls[0]['user_id'], entries[0]['user_id'])

    def test_actual_order_profit_winner_and_loser_complete_without_replaying_rating(self):
        with patch('app.multiplayer.api.secrets.randbits', return_value=1), patch('app.multiplayer.api.secrets.choice', return_value='rising'):
            identifier = self.public()
        placed = self.post(0, f'/{identifier}/orders', {**order(quantity=10), 'idempotency_key': 'profit-order-key'})
        self.assertEqual(placed.status_code, 200, placed.text)
        calls = []
        registered = self.app.state.multiplayer_result_handler
        async def awards(db, user, result):
            calls.append(result)
            return await registered(db, user, result)
        self.app.state.multiplayer_result_handler = awards
        final = self.finish(identifier)
        self.assertEqual(final['result']['leaderboard'][0]['profit'],
            engine.money(engine.amount(self.get(0, f'/{identifier}').json()['player']['equity']) - 10000))
        self.assertGreater(engine.amount(final['result']['leaderboard'][0]['profit']), 0)
        for player in (0, 1):
            complete = self.post(player, f'/{identifier}/complete', {'idempotency_key': f'profit-complete-{player}',
                'reflection': 'I compared the plan and realized costs with the shared final portfolio value.'})
            self.assertEqual(complete.status_code, 200, complete.text)
            self.assertEqual(complete.json()['awards']['awarded'], {'xp': 10, 'stocks': 0, 'premium': 10 if player == 0 else 5})
            profile = self.client.get('/api/me/profile', headers={'Cookie': f'{self.settings.cookie_name}={self.tokens[player]}'}).json()
            self.assertEqual(profile['game_xp'], 10)
            wallet = self.client.get('/api/me/economy', headers={'Cookie': f'{self.settings.cookie_name}={self.tokens[player]}'}).json()
            self.assertEqual(wallet['premium_balance'], 10 if player == 0 else 5)
            repeat = self.post(player, f'/{identifier}/complete', {'idempotency_key': f'profit-complete-{player}',
                'reflection': 'I compared the plan and realized costs with the shared final portfolio value.'})
            self.assertEqual(repeat.json(), complete.json())
        self.assertEqual([call['win'] for call in calls], [True, False])
        self.assertEqual(self.get(0, '/leaderboard').json()['your_matches'], 1)

    def test_failed_award_rolls_back_reflection_and_command_preserving_final_rating(self):
        identifier = self.public()
        self.finish(identifier)
        registered = self.app.state.multiplayer_result_handler
        async def failing(db, user, result):
            raise RuntimeError('award unavailable')
        self.app.state.multiplayer_result_handler = failing
        body = {'idempotency_key': 'atomic-match-complete', 'reflection': 'I reviewed the entire match and its final result before completing.'}
        with self.assertRaises(RuntimeError):
            self.post(0, f'/{identifier}/complete', body)
        saved = self.get(0, f'/{identifier}').json()
        self.assertEqual(saved['status'], 'finished')
        self.assertFalse(saved['player']['finished'])
        self.assertIsNone(saved['awards'])
        self.assertEqual(self.get(0, '/leaderboard').json()['your_matches'], 1)
        async def command():
            async with self.app.state.db.sessions() as db:
                return await db.scalar(select(MultiplayerCommand).where(MultiplayerCommand.key == body['idempotency_key']))
        self.assertIsNone(self.client.portal.call(command))
        self.app.state.multiplayer_result_handler = registered
        recovered = self.post(0, f'/{identifier}/complete', body)
        self.assertEqual(recovered.status_code, 200)
        self.assertEqual(recovered.json()['awards']['awarded'], {'xp': 10, 'stocks': 0, 'premium': 5})

    def test_private_foundations_and_public_integrated_mastery_gates(self):
        self.client.cookies.clear()
        self.client.post('/api/session')
        self.assertEqual(self.client.post('/api/multiplayer/lobbies', json={'idempotency_key': 'newbie-private-start'}).status_code, 403)
        self.assertEqual(self.client.post('/api/multiplayer/matchmaking', json={'idempotency_key': 'newbie-public-start'}).status_code, 403)
        for index in range(4):
            fixtures.LearningTests.complete_module(self, index)
        self.assertEqual(self.client.post('/api/multiplayer/lobbies', json={'idempotency_key': 'foundation-private-start'}).status_code, 201)
        self.assertEqual(self.client.post('/api/multiplayer/matchmaking', json={'idempotency_key': 'foundation-public-start'}).status_code, 403)
        for index in range(4, 9):
            fixtures.LearningTests.complete_module(self, index)
        self.assertEqual(self.client.post('/api/multiplayer/matchmaking', json={'idempotency_key': 'integrated-public-start'}).status_code, 200)

    def test_all_forfeit_no_contest_and_waiting_cancel_can_resume(self):
        identifier = self.public()
        self.post(0, f'/{identifier}/abandon', {'idempotency_key': 'no-contest-first'})
        cancelled = self.post(1, f'/{identifier}/abandon', {'idempotency_key': 'no-contest-second'})
        self.assertEqual(cancelled.json()['status'], 'cancelled')
        self.assertIsNone(cancelled.json()['result'])
        self.assertEqual(self.get(0, '/leaderboard').json()['your_matches'], 0)
        waiting = self.post(0, '/lobbies', {'idempotency_key': 'waiting-create-key'}).json()['id']
        self.assertEqual(self.post(0, f'/{waiting}/abandon', {'idempotency_key': 'waiting-cancel-key'}).json()['status'], 'cancelled')
        self.assertEqual(self.get(0, f'/{waiting}').json()['status'], 'cancelled')

    def test_unknown_codes_throttle_persists_and_success_replay_ignores_throttle(self):
        created = self.post(0, '/lobbies', {'idempotency_key': 'private-code-key'}).json()
        valid = {'idempotency_key': 'valid-join-key', 'code': created['join_code']}
        joined = self.post(1, '/join', valid)
        for index in range(11):
            self.assertEqual(self.post(1, '/join', {'idempotency_key': f'bad-code-key-{index}', 'code': '0000000000000000'}).status_code, 404)
        self.assertEqual(self.post(1, '/join', {'idempotency_key': 'throttled-code-key', 'code': '0000000000000000'}).status_code, 429)
        self.assertEqual(self.post(1, '/join', valid).json(), joined.json())
        async def inspect():
            async with self.app.state.db.sessions() as db:
                return list((await db.scalars(select(MultiplayerJoinThrottle.attempts))).all())
        self.assertIn(12, self.client.portal.call(inspect))

    def test_restart_and_retired_version_replay_before_gate(self):
        identifier = self.private()
        body = {**order(quantity=1), 'idempotency_key': 'restart-multiplayer-key'}
        first = self.post(0, f'/{identifier}/orders', body)
        self.assertEqual(self.post(0, f'/{identifier}/orders', body, self.other).json(), first.json())
        async def retire():
            async with self.app.state.db.sessions.begin() as db:
                lobby = await db.get(MultiplayerLobby, identifier)
                lobby.version = 'retired'
        self.client.portal.call(retire)
        self.assertEqual(self.post(0, f'/{identifier}/orders', body, self.other).json(), first.json())
        self.assertEqual(self.get(0, f'/{identifier}').status_code, 409)
        self.assertEqual(self.post(0, f'/{identifier}/orders', {**body, 'idempotency_key': 'fresh-retired-match'}).status_code, 409)
        self.assertEqual(self.post(0, f'/{identifier}/orders', {**body, 'quantity': 2}).status_code, 409)

    def test_unapproved_saved_match_blocks_production_but_replays_prior_commands(self):
        identifier = self.private()
        body = {'idempotency_key': 'publication-ready-key', 'expected_tick': 0}
        saved = self.post(0, f'/{identifier}/ready', body).json()
        self.app.state.settings = replace(self.settings, environment='production')
        self.assertEqual(self.post(0, f'/{identifier}/ready', body).json(), saved)
        self.assertEqual(self.get(0, f'/{identifier}').status_code, 503)
        self.assertEqual(self.post(1, f'/{identifier}/ready', {'idempotency_key': 'publication-fresh-key', 'expected_tick': 0}).status_code, 503)
        async def allowed(request, db, user, mode):
            return
        self.app.state.multiplayer_access_handler = allowed
        self.assertEqual(self.post(0, '/lobbies', {'idempotency_key': 'callback-bypass-key'}).status_code, 503)

    def test_stale_order_and_ready_reject_without_mutation(self):
        identifier = self.private()
        self.post(0, f'/{identifier}/ready', {'idempotency_key': 'stale-first-ready', 'expected_tick': 0})
        self.post(1, f'/{identifier}/ready', {'idempotency_key': 'stale-second-ready', 'expected_tick': 0})
        before = self.get(0, f'/{identifier}').json()
        for path, payload in [('/orders', order(quantity=1)), ('/ready', {})]:
            rejected = self.post(0, f'/{identifier}' + path, {**payload, 'idempotency_key': 'stale-action' + path.replace('/', '-'), 'expected_tick': 0})
            self.assertEqual(rejected.status_code, 409, rejected.text)
        self.assertEqual(self.get(0, f'/{identifier}').json(), before)

    def test_migration_repeat_preserves_profile(self):
        async def migrate():
            async with self.app.state.db.engine.begin() as connection:
                before = (await connection.execute(text('SELECT * FROM profiles ORDER BY id'))).all()
                await upgrade(connection)
                await upgrade(connection)
                self.assertEqual((await connection.execute(text('SELECT * FROM profiles ORDER BY id'))).all(), before)
        self.client.portal.call(migrate)


@unittest.skipUnless(os.getenv('TRADERS_EDGE_TEST_POSTGRES_URL'), 'Disposable PostgreSQL test URL not configured')
class MultiplayerPostgreSQLTests(MultiplayerAPITests):
    postgres = True


if __name__ == '__main__':
    unittest.main()
