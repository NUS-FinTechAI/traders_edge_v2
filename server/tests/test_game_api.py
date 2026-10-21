import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import func, inspect, select, text

from app.config import Settings
from app.db import Profile
from app.game import service
from app.game.models import GameEvent, GameOrder
from app.main import create_app
from app.migration_v11 import upgrade
from progression_fixtures import fixture_content, use_fixture_scenarios

T0 = 1_800_000_000_000
SCENARIO = 'practice-trend-rider'
PLAN = {'strategy': 'trend', 'max_loss_pct': 10}


class GameApiTests(unittest.TestCase):
    def setUp(self):
        use_fixture_scenarios(self)
        self.temp = tempfile.TemporaryDirectory()
        self.app = create_app(Settings(database_url=f'sqlite+aiosqlite:///{self.temp.name}/games.db'), fixture_content())
        self.client = TestClient(self.app, headers={'Origin': 'http://localhost:5173'})
        self.client.__enter__()
        self.app.state.resolve_game, self.app.state.settle_game = service.resolve_game, service.settle_game
        self.user_id = self.client.post('/api/session').json()['profile_id']
        self.now = T0
        self.clock = patch('app.game.clock.now_ms', side_effect=lambda: self.now)
        self.clock.start()

    def tearDown(self):
        self.clock.stop()
        self.client.__exit__(None, None, None)
        self.temp.cleanup()

    def create(self, **body):
        response = self.client.post('/api/games', json={'mode': 'practice', 'scenario_id': SCENARIO, **body})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def started(self):
        game = self.create()
        response = self.client.post(f'/api/games/{game["id"]}/start', json={'plan': PLAN})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def order(self, game_id, key='order-0001', **body):
        payload = {'client_order_id': key, 'symbol': 'SUNR', 'side': 'buy', 'type': 'market', 'qty': 10, **body}
        return self.client.post(f'/api/games/{game_id}/orders', json=payload)

    def advance(self, days):
        self.now += days * 2000

    def count(self, model, **filters):
        async def read():
            async with self.app.state.db.sessions() as db:
                query = select(func.count()).select_from(model)
                for key, value in filters.items():
                    query = query.where(getattr(model, key) == value)
                return await db.scalar(query)
        return self.client.portal.call(read)

    def switch_user(self):
        self.client.cookies.clear()
        return self.client.post('/api/session').json()['profile_id']

    def test_practice_match_runs_from_briefing_to_result(self):
        game = self.create()
        self.assertEqual((game['status'], game['tick'], game['news']), ('briefing', 0, []))
        self.assertTrue(all(bar['t'] < 0 for bar in game['bars']['SUNR']))

        started = self.client.post(f'/api/games/{game["id"]}/start', json={'plan': PLAN}).json()
        placed = self.order(game['id'])
        self.advance(3)
        midway = self.client.get(f'/api/games/{game["id"]}').json()
        self.advance(100)
        ended = self.client.get(f'/api/games/{game["id"]}').json()
        finished = self.client.post(f'/api/games/{game["id"]}/finish', json={'reflection': 'Held through the dip.'})

        self.assertEqual((started['status'], started['me']['plan']), ('running', PLAN))
        self.assertEqual(placed.status_code, 200, placed.text)
        self.assertEqual(placed.json()['order']['status'], 'filled')
        self.assertEqual(midway['tick'], 3)
        self.assertEqual(max(bar['t'] for bar in midway['bars']['SUNR']), 3)
        self.assertEqual((ended['status'], ended['tick'], ended['next_tick_at']), ('ended', 40, None))
        result = finished.json()
        self.assertEqual(finished.status_code, 200, finished.text)
        self.assertEqual(result['profit'], ended['me']['profit'])
        self.assertEqual(result['of'], 4)
        self.assertEqual(result['rewards'], {'xp': 0, 'stocks': 0, 'gems': 0, 'items': [], 'badges': []})
        self.assertEqual(result['stats']['trades'], 1)
        self.assertIn(result['plan_review']['kept_loss_limit'], (True, False))
        self.assertEqual(result['decision_score'], sum(result['decision_breakdown'].values()))
        self.assertEqual(result['reflection'], 'Held through the dip.')
        self.assertEqual(self.client.get(f'/api/games/{game["id"]}/result').json(), result)
        self.assertEqual(self.client.get(f'/api/games/{game["id"]}').json()['status'], 'settled')
        self.assertEqual(self.client.get('/api/games').json(), {'games': []})

    def test_reflection_added_after_settling_is_stored_once(self):
        game = self.started()
        self.advance(100)
        settled = self.client.post(f'/api/games/{game["id"]}/finish', json={}).json()

        first = self.client.post(f'/api/games/{game["id"]}/finish', json={'reflection': 'Sell sooner.'}).json()
        second = self.client.post(f'/api/games/{game["id"]}/finish', json={'reflection': 'Changed my mind.'}).json()

        self.assertIsNone(settled['reflection'])
        self.assertEqual((first['reflection'], second['reflection']), ('Sell sooner.', 'Sell sooner.'))
        self.assertEqual({**first, 'reflection': None}, settled)

    def test_state_names_the_campaign_context(self):
        game = self.create()

        self.assertEqual((game['mode'], game['chapter_id'], game['level_id'], game['boss']), ('practice', None, None, None))

    def test_commands_are_logged_with_observed_context(self):
        game = self.started()
        self.order(game['id'])
        self.order(game['id'], key='order-0002', qty=10**6)
        self.advance(100)
        self.client.post(f'/api/games/{game["id"]}/finish', json={})

        async def read():
            async with self.app.state.db.sessions() as db:
                return list(await db.scalars(select(GameEvent).where(GameEvent.game_id == game['id']).order_by(GameEvent.created_at)))
        events = self.client.portal.call(read)

        self.assertEqual([event.kind for event in events], ['start', 'order', 'rejected', 'finish'])
        self.assertEqual(events[0].payload['plan'], PLAN)
        self.assertEqual(events[0].payload['attempt'], 1)
        self.assertEqual(set(events[1].payload['observed']), {'tick', 'prices', 'cash', 'available_cash', 'equity', 'positions',
                                                             'open_orders', 'latest_headline'})
        self.assertIn('Not enough cash', events[2].payload['reason'])

    def test_repeated_client_order_id_returns_the_original_order(self):
        game = self.started()

        first = self.order(game['id'])
        self.advance(2)
        repeat = self.order(game['id'])
        different = self.order(game['id'], qty=11)

        self.assertEqual(repeat.json()['order'], first.json()['order'])
        self.assertEqual(self.count(GameOrder, game_id=game['id']), 1)
        self.assertEqual(different.status_code, 409)

    def test_rule_breaking_order_is_rejected_with_a_plain_reason(self):
        game = self.started()

        response = self.order(game['id'], side='sell')

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json(), {'detail': 'You do not own any SUNR shares to sell.'})
        self.assertEqual(self.count(GameOrder), 0)

    def test_trading_before_the_start_is_rejected(self):
        game = self.create()

        self.assertEqual(self.order(game['id']).json(), {'detail': 'Start the match before trading.'})

    def test_trading_after_the_end_is_rejected(self):
        game = self.started()
        self.advance(100)

        self.assertEqual(self.order(game['id']).json(), {'detail': 'This match has ended.'})

    def test_cancel_releases_a_resting_order_and_repeats_safely(self):
        game = self.started()
        resting = self.order(game['id'], type='limit', limit_price=1.0).json()['order']
        self.advance(1)

        cancelled = self.client.delete(f'/api/games/{game["id"]}/orders/{resting["id"]}')
        again = self.client.delete(f'/api/games/{game["id"]}/orders/{resting["id"]}')

        self.assertEqual(cancelled.status_code, 200, cancelled.text)
        self.assertEqual(cancelled.json()['me']['orders'][0]['status'], 'cancelled')
        self.assertEqual(cancelled.json()['me']['available_cash'], cancelled.json()['me']['cash'])
        self.assertEqual(again.status_code, 200)

    def test_cancelling_a_filled_order_conflicts(self):
        game = self.started()
        filled = self.order(game['id']).json()['order']

        response = self.client.delete(f'/api/games/{game["id"]}/orders/{filled["id"]}')

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['detail'], 'This order has already filled.')

    def test_forfeit_ranks_last_and_settles_the_match(self):
        game = self.started()
        self.advance(5)

        result = self.client.post(f'/api/games/{game["id"]}/finish', json={'forfeit': True}).json()
        self.advance(5)
        state = self.client.get(f'/api/games/{game["id"]}').json()

        self.assertTrue(result['forfeited'])
        self.assertFalse(result['won'])
        self.assertEqual(result['rank'], result['of'])
        self.assertEqual((state['status'], state['tick'], state['paused']), ('settled', 5, True))
        self.assertTrue(all(mission['progress'] == 'Forfeited' for mission in result['missions']))

    def test_leaving_from_the_briefing_forfeits_with_no_market_days_played(self):
        game = self.create()

        result = self.client.post(f'/api/games/{game["id"]}/finish', json={'forfeit': True}).json()
        state = self.client.get(f'/api/games/{game["id"]}').json()

        self.assertEqual((result['forfeited'], result['profit'], result['rank']), (True, 0.0, result['of']))
        self.assertEqual(state['status'], 'settled')
        self.assertTrue(all(entry['profit'] == 0 for entry in state['leaderboard']))

    def test_finish_without_forfeit_waits_for_the_last_day(self):
        game = self.started()

        response = self.client.post(f'/api/games/{game["id"]}/finish', json={})

        self.assertEqual(response.status_code, 409)

    def test_settle_hook_runs_once_and_its_rewards_are_stored(self):
        calls = []

        async def settle(db, profile, game, participant, result):
            calls.append(result['rank'])
            return {'rewards': {'xp': 10, 'stocks': 0, 'gems': 0, 'items': [], 'badges': []}, 'stars': {'normal': True, 'special': False},
                    'unlocked': None}
        self.app.state.settle_game = settle
        game = self.started()
        self.advance(100)

        first = self.client.post(f'/api/games/{game["id"]}/finish', json={}).json()
        second = self.client.post(f'/api/games/{game["id"]}/finish', json={}).json()

        self.assertEqual(len(calls), 1)
        self.assertEqual(first, second)
        self.assertEqual((first['rewards']['xp'], first['stars']), (10, {'normal': True, 'special': False}))

    def test_default_resolver_rejects_modes_other_than_practice(self):
        response = self.client.post('/api/games', json={'mode': 'boss', 'chapter_id': 'ch1'})

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()['detail'], 'This mode is not available yet')

    def test_practice_without_a_scenario_picks_a_practice_scenario_and_limits_bots(self):
        game = self.create(scenario_id=None, bots=1)

        self.assertTrue(game['scenario']['id'].startswith('practice-'))
        self.assertEqual(len(game['leaderboard']), 2)

    def test_resolver_seed_and_chosen_bots_shape_the_match(self):
        async def resolve(db, profile, request):
            return service.GameSpec(SCENARIO, 'daily', context={'seed': 20261021}, bot_ids=['ironhand-iris'])
        self.app.state.resolve_game = resolve

        first, second = self.create(mode='daily'), self.create(mode='daily')

        self.assertEqual(first['bars'], second['bars'])
        self.assertEqual([e['bot_id'] for e in first['leaderboard'] if e['kind'] == 'bot'], ['ironhand-iris'])

    def test_non_participant_cannot_read_or_trade(self):
        game = self.started()
        self.switch_user()

        self.assertEqual(self.client.get(f'/api/games/{game["id"]}').status_code, 404)
        self.assertEqual(self.order(game['id']).status_code, 404)
        self.assertEqual(self.client.get(f'/api/games/{game["id"]}/result').status_code, 404)

    def test_solo_clock_pauses_and_steps_one_day(self):
        game = self.started()
        self.advance(2)
        url = f'/api/games/{game["id"]}/clock'

        refused = self.client.post(url, json={'action': 'step'})
        paused = self.client.post(url, json={'action': 'pause'}).json()
        self.advance(10)
        stepped = self.client.post(url, json={'action': 'step'}).json()
        fast = self.client.post(url, json={'action': 'speed', 'speed': 4}).json()

        self.assertEqual(refused.status_code, 409)
        self.assertEqual((paused['tick'], paused['paused']), (2, True))
        self.assertEqual(stepped['tick'], 3)
        self.assertEqual((fast['speed'], fast['tick_ms']), (4, 500))

    def test_multiplayer_match_runs_on_a_fixed_clock_without_pause(self):
        other = self.switch_user()

        async def create():
            async with self.app.state.db.sessions.begin() as db:
                profiles = [await db.get(Profile, self.user_id), await db.get(Profile, other)]
                game = await service.create_multiplayer_game(db, SCENARIO, 'private', profiles, ['hodl-hannah'], 'lobby-1')
                return game.id
        game_id = self.client.portal.call(create)

        state = self.client.get(f'/api/games/{game_id}').json()
        planned = self.client.post(f'/api/games/{game_id}/start', json={'plan': PLAN}).json()
        clock = self.client.post(f'/api/games/{game_id}/clock', json={'action': 'pause'})

        self.assertEqual((state['status'], state['tick_ms'], len(state['leaderboard'])), ('running', 3000, 3))
        self.assertEqual(planned['me']['plan'], PLAN)
        self.assertEqual(clock.status_code, 403)

    def test_since_returns_only_newer_bars(self):
        game = self.started()
        self.advance(5)

        state = self.client.get(f'/api/games/{game["id"]}', params={'since': 3}).json()

        self.assertEqual([bar['t'] for bar in state['bars']['SUNR']], [4, 5])

    def test_active_list_includes_an_unfinished_match(self):
        game = self.started()
        self.advance(4)

        games = self.client.get('/api/games').json()['games']

        self.assertEqual([(g['id'], g['status'], g['tick'], g['title']) for g in games], [(game['id'], 'running', 4, 'Trend Rider')])

    def test_migration_repeat_keeps_populated_game_tables(self):
        game = self.started()
        self.order(game['id'])

        async def verify():
            async with self.app.state.db.engine.begin() as connection:
                tables = await connection.run_sync(lambda sync: inspect(sync).get_table_names())
                before = {table: (await connection.execute(text('SELECT * FROM "' + table + '"'))).all() for table in tables}
                await upgrade(connection)
                after = {table: (await connection.execute(text('SELECT * FROM "' + table + '"'))).all() for table in tables}
                self.assertEqual(before, after)
                self.assertTrue({'games', 'game_participants', 'game_orders', 'game_events'} <= set(tables))
        self.client.portal.call(verify)


if __name__ == '__main__':
    unittest.main()
