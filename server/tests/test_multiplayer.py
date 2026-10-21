import unittest
from unittest.mock import patch

from sqlalchemy import func, select

from app.economy_models import EconomyEvent
from app.game.models import Game, GameParticipant
from app.multiplayer import elo
from app.multiplayer.models import Rating
from progression_fixtures import AppCase

COOKIE = 'traders_edge_session'
PLAN = {'strategy': 'trend', 'max_loss_pct': 10}


class EloTests(unittest.TestCase):
    def test_equal_ratings_move_by_half_k(self):
        self.assertEqual(elo.deltas({'a': 1000, 'b': 1000}, {'a': 1, 'b': 2}), {'a': 16, 'b': -16})

    def test_equal_rank_is_a_draw(self):
        self.assertEqual(elo.deltas({'a': 1000, 'b': 1000}, {'a': 1, 'b': 1}), {'a': 0, 'b': 0})
        self.assertEqual(elo.deltas({'a': 1200, 'b': 1000}, {'a': 1, 'b': 1}), {'a': -8, 'b': 8})

    def test_pairwise_changes_against_every_other_player(self):
        changes = elo.deltas({'a': 1000, 'b': 1000, 'c': 1000}, {'a': 1, 'b': 2, 'c': 3})

        self.assertEqual(changes, {'a': 32, 'b': 0, 'c': -32})

    def test_tiers(self):
        self.assertEqual([elo.tier(value) for value in (1099, 1100, 1299, 1300, 1500, 1699, 1700)],
                         ['Bronze', 'Silver', 'Silver', 'Gold', 'Platinum', 'Platinum', 'Diamond'])


class MultiplayerTests(AppCase):
    def setUp(self):
        super().setUp()
        self.ms = 1_800_000_000_000
        clock = patch('app.game.clock.now_ms', side_effect=lambda: self.ms)
        clock.start()
        self.addCleanup(clock.stop)
        self.users = {'host': (self.user_id, self.client.cookies.get(COOKIE))}

    def add_user(self, name):
        user_id = self.switch_user()
        self.client.patch('/api/me', json={'display_name': name})
        self.users[name] = (user_id, self.client.cookies.get(COOKIE))
        return user_id

    def act_as(self, name):
        self.user_id, cookie = self.users[name]
        self.client.cookies.clear()
        self.client.cookies.set(COOKIE, cookie)

    def test_lobby_join_by_code_and_host_starts_a_private_game(self):
        created = self.client.post('/api/lobbies', json={'scenario_id': 'practice-choppy-range', 'bots': 2})
        lobby = created.json()
        too_few = self.client.post(f'/api/lobbies/{lobby["id"]}/start', json={})
        self.add_user('guest')
        joined = self.client.post('/api/lobbies/join', json={'code': lobby['code'].lower()}).json()
        not_host = self.client.post(f'/api/lobbies/{lobby["id"]}/start', json={})
        self.act_as('host')
        started = self.client.post(f'/api/lobbies/{lobby["id"]}/start', json={}).json()
        self.act_as('guest')
        seen = self.client.get(f'/api/lobbies/{lobby["id"]}').json()
        game = self.client.get(f'/api/games/{seen["game_id"]}').json()

        self.assertEqual(created.status_code, 201, created.text)
        self.assertRegex(lobby['code'], r'^[A-HJ-NP-Z2-9]{6}$')
        self.assertEqual((lobby['bots'], lobby['max_members'], lobby['is_host']), (2, 30, True))
        self.assertEqual((too_few.status_code, too_few.json()['detail']), (409, 'At least 2 players are needed to start'))
        self.assertEqual([member['is_host'] for member in joined['members']], [True, False])
        self.assertEqual((not_host.status_code, not_host.json()['detail']), (403, 'Only the host can start the match'))
        self.assertEqual(started['status'], 'started')
        self.assertEqual(seen['game_id'], started['game_id'])
        self.assertEqual((game['mode'], game['status']), ('private', 'running'))
        self.assertEqual(sum(entry['kind'] == 'bot' for entry in game['leaderboard']), 2)

    def test_lobby_rejects_joins_when_full_or_started_and_hides_from_outsiders(self):
        with patch('app.multiplayer.service.MAX_MEMBERS', 2):
            lobby = self.client.post('/api/lobbies', json={'bots': 0}).json()
            self.add_user('second')
            self.client.post('/api/lobbies/join', json={'code': lobby['code']})
            self.add_user('third')
            full = self.client.post('/api/lobbies/join', json={'code': lobby['code']})
            hidden = self.client.get(f'/api/lobbies/{lobby["id"]}')
            missing = self.client.post('/api/lobbies/join', json={'code': 'ZZZZZZ'})

        self.assertEqual((full.status_code, full.json()['detail']), (409, 'This lobby is full (2 players)'))
        self.assertEqual(hidden.status_code, 404)
        self.assertEqual(missing.status_code, 404)

    def test_host_leaving_an_open_lobby_closes_it(self):
        lobby = self.client.post('/api/lobbies', json={}).json()
        self.add_user('guest')
        self.client.post('/api/lobbies/join', json={'code': lobby['code']})
        self.act_as('host')
        left = self.client.post(f'/api/lobbies/{lobby["id"]}/leave', json={})
        self.act_as('guest')
        view = self.client.get(f'/api/lobbies/{lobby["id"]}').json()
        rejoin = self.client.post('/api/lobbies/join', json={'code': lobby['code']})

        self.assertEqual(left.status_code, 204)
        self.assertEqual(view['status'], 'closed')
        self.assertEqual([member['name'] for member in view['members']], ['guest'])
        self.assertEqual(rejoin.status_code, 200)

    def test_lobby_scenarios_fall_back_to_the_practice_pool(self):
        scenarios = self.client.get('/api/lobbies/scenarios').json()['scenarios']

        self.assertEqual([item['id'] for item in scenarios], ['practice-choppy-range', 'practice-earnings-gap', 'practice-trend-rider'])

    def test_ranked_queue_is_locked_until_the_chapter_three_boss(self):
        status = self.client.get('/api/matchmaking').json()
        rejected = self.client.post('/api/matchmaking', json={})

        self.assertEqual(status, {'status': 'idle', 'game_id': None, 'rating': 1000, 'tier': 'Bronze', 'waiting_since': None,
                                  'locked_reason': 'Win the Chapter 3 boss to unlock ranked matches'})
        self.assertEqual(rejected.status_code, 403)

    def ranked_pair(self):
        self.win_boss('ch3')
        waiting = self.client.post('/api/matchmaking', json={}).json()
        self.add_user('rival')
        self.win_boss('ch3')
        matched = self.client.post('/api/matchmaking', json={}).json()
        self.act_as('host')
        host_view = self.client.get('/api/matchmaking').json()
        return waiting, matched, host_view

    def test_two_searching_players_are_paired_into_a_ranked_game(self):
        waiting, matched, host_view = self.ranked_pair()

        self.assertEqual((waiting['status'], waiting['game_id']), ('searching', None))
        self.assertIsNotNone(waiting['waiting_since'])
        self.assertEqual(matched['status'], 'matched')
        self.assertEqual(host_view['game_id'], matched['game_id'])
        game = self.client.get(f'/api/games/{matched["game_id"]}').json()
        self.assertEqual((game['mode'], [entry['kind'] for entry in game['leaderboard']]), ('ranked', ['human', 'human']))
        self.assertEqual(self.client.delete('/api/matchmaking').status_code, 204)
        self.assertEqual(self.client.get('/api/matchmaking').json()['status'], 'idle')

    def finish_ranked(self, game_id, name, order=False):
        self.act_as(name)
        self.client.post(f'/api/games/{game_id}/start', json={'plan': PLAN})
        if order:
            symbol = self.client.get(f'/api/games/{game_id}').json()['assets'][0]['symbol']
            placed = self.client.post(f'/api/games/{game_id}/orders', json={'client_order_id': 'ranked-order-1', 'symbol': symbol, 'side': 'buy',
                                                                            'type': 'market', 'qty': 20})
            self.assertEqual(placed.status_code, 200, placed.text)

    def test_ranked_results_rate_every_human_once_and_pay_gems(self):
        _, matched, _ = self.ranked_pair()
        game_id = matched['game_id']
        self.finish_ranked(game_id, 'host', order=True)
        self.finish_ranked(game_id, 'rival')
        self.ms += 200 * 3000
        self.act_as('host')
        host = self.client.post(f'/api/games/{game_id}/finish', json={}).json()
        self.act_as('rival')
        rival = self.client.post(f'/api/games/{game_id}/finish', json={}).json()

        async def ratings(db):
            rows = {row.user_id: row for row in await db.scalars(select(Rating))}
            events = await db.scalar(select(func.count()).select_from(EconomyEvent).where(EconomyEvent.event_key == f'elo:{game_id}'))
            return {user: (row.rating, row.matches, row.wins) for user, row in rows.items()}, events
        values, events = self.run_db(ratings)
        host_id, rival_id = self.users['host'][0], self.users['rival'][0]
        winner, loser = (host, rival) if host['won'] else (rival, host)
        self.assertNotEqual(host['profit'], rival['profit'])
        self.assertEqual(events, 2)
        self.assertEqual(sorted(value[0] for value in values.values()), [984, 1016])
        self.assertEqual(sum(value[2] for value in values.values()), 1)
        self.assertEqual((values[host_id][1], values[rival_id][1]), (1, 1))
        self.assertEqual((winner['rewards']['xp'], winner['rewards']['gems']), (20, 25))
        self.assertEqual(loser['rewards']['xp'], 10)
        self.assertEqual(loser['rewards']['gems'], 5 if loser is host else 0)
        ranked = self.client.get('/api/leaderboards/ranked').json()
        self.assertEqual(ranked['me']['value'], values[rival_id][0])

    def test_private_games_never_change_ratings(self):
        lobby = self.client.post('/api/lobbies', json={}).json()
        self.add_user('guest')
        self.client.post('/api/lobbies/join', json={'code': lobby['code']})
        self.act_as('host')
        game_id = self.client.post(f'/api/lobbies/{lobby["id"]}/start', json={}).json()['game_id']
        self.ms += 200 * 3000
        settled = self.client.post(f'/api/games/{game_id}/finish', json={}).json()

        async def count(db):
            return await db.scalar(select(func.count()).select_from(Rating))
        self.assertEqual(settled['rewards'], {'xp': 0, 'stocks': 0, 'gems': 0, 'items': [], 'badges': []})
        self.assertEqual(self.run_db(count), 0)

    def test_new_match_after_finishing_the_previous_one(self):
        _, matched, _ = self.ranked_pair()
        self.ms += 200 * 3000
        self.client.post(f'/api/games/{matched["game_id"]}/finish', json={})

        after = self.client.get('/api/matchmaking').json()
        requeued = self.client.post('/api/matchmaking', json={}).json()

        async def games(db):
            return await db.scalar(select(func.count()).select_from(Game)), await db.scalar(select(func.count()).select_from(GameParticipant))
        self.assertEqual(after['status'], 'idle')
        self.assertEqual(requeued['status'], 'searching')
        self.assertEqual(self.run_db(games), (1, 2))
