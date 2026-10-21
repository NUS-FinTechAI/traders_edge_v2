from datetime import timedelta
from unittest.mock import patch

from sqlalchemy import select

from app.campaign import daily
from app.economy_models import EconomyAccount
from app.game.models import Game
from app.player import ledger
from progression_fixtures import AppCase, result

ROTATION = ('practice-trend-rider', 'practice-choppy-range', 'practice-earnings-gap', 'practice-trend-rider', 'practice-choppy-range',
            'practice-earnings-gap', 'practice-trend-rider')


class DailyTests(AppCase):
    def setUp(self):
        super().setUp()
        rotation = patch('app.campaign.daily.ROTATION', ROTATION)
        rotation.start()
        self.addCleanup(rotation.stop)

    def unlock(self):
        self.win_boss('ch1')

    def start_daily(self):
        return self.client.post('/api/games', json={'mode': 'daily'})

    def seeds(self):
        async def read(db):
            return [(game.seed, game.context) for game in await db.scalars(select(Game).where(Game.mode == 'daily').order_by(Game.created_at))]
        return self.run_db(read)

    def give_gems(self, amount):
        async def seed(db):
            await ledger.credit(db, self.user_id, 'test-gems', self.now, gems=amount)
        self.run_db(seed)

    def test_daily_is_locked_until_the_chapter_one_boss_is_won(self):
        locked = self.client.get('/api/daily').json()
        rejected = self.start_daily()
        self.unlock()

        self.assertEqual((locked['unlocked'], locked['locked_reason']), (False, 'Win the Chapter 1 boss to unlock the daily challenge'))
        self.assertEqual(rejected.status_code, 403)
        self.assertTrue(self.client.get('/api/daily').json()['unlocked'])

    def test_weekday_rotation_follows_the_utc_date(self):
        names = [daily.scenario_for(self.now + timedelta(days=offset)) for offset in range(7)]

        self.assertEqual(names, list(ROTATION))
        self.assertEqual(self.client.get('/api/daily').json()['scenario']['id'], ROTATION[0])
        self.assertEqual(self.client.get('/api/daily').json()['opponent']['bot_id'], 'momentum-max-rookie')

    def test_first_attempt_uses_the_shared_seed_and_retries_do_not(self):
        self.unlock()
        first = self.start_daily()
        second = self.start_daily()
        self.switch_user()
        self.win_boss('ch1')
        other = self.start_daily()

        (seed_one, context_one), (seed_two, context_two), (seed_other, _) = self.seeds()
        self.assertEqual([first.status_code, second.status_code, other.status_code], [201, 201, 201])
        self.assertEqual(seed_one, daily.shared_seed('2026-10-19'))
        self.assertEqual(seed_other, seed_one)
        self.assertEqual((context_one['attempt'], context_two['attempt']), (1, 2))
        self.assertNotIn('seed', context_two)

    def test_a_loss_starts_a_cooldown_that_blocks_with_retry_details(self):
        self.unlock()
        settled = self.settle('daily', result(won=False), context={'day': '2026-10-19'})
        blocked = self.start_daily()
        view = self.client.get('/api/daily').json()

        self.assertEqual(settled['rewards']['xp'], 15)
        self.assertEqual(blocked.status_code, 409)
        self.assertEqual(blocked.json()['detail'], 'Next daily try at 14:00 UTC, or skip the wait for 20 Gems')
        self.assertEqual(view['cooldown_until'], (self.now + timedelta(hours=2)).isoformat())
        self.now += timedelta(hours=2, seconds=1)
        self.assertEqual(self.start_daily().status_code, 201)

    def test_the_utc_reset_clears_a_cooldown_from_yesterday(self):
        self.unlock()
        self.now = self.now.replace(hour=23)
        self.settle('daily', result(won=False), context={'day': '2026-10-19'})
        self.now += timedelta(hours=1, minutes=30)

        self.assertIsNone(self.client.get('/api/daily').json()['cooldown_until'])
        self.assertEqual(self.start_daily().status_code, 201)

    def test_gems_skip_the_cooldown_and_mark_the_next_attempt(self):
        self.unlock()
        self.settle('daily', result(won=False), context={'day': '2026-10-19'})
        poor = self.client.post('/api/daily/refresh', json={})
        self.give_gems(25)
        refreshed = self.client.post('/api/daily/refresh', json={})
        again = self.client.post('/api/daily/refresh', json={})
        started = self.start_daily()

        async def gems(db):
            return (await db.get(EconomyAccount, self.user_id)).premium_balance
        self.assertEqual((poor.status_code, poor.json()['detail']), (409, 'You need 20 Gems to skip the cooldown'))
        self.assertEqual((refreshed.status_code, refreshed.json()['cooldown_until']), (200, None))
        self.assertEqual(again.json()['detail'], 'There is no cooldown to skip right now')
        self.assertEqual(started.status_code, 201)
        self.assertEqual(self.run_db(gems), 5)
        self.assertTrue(self.seeds()[0][1]['refresh_event_key'].startswith('daily-refresh:'))

    def test_first_win_each_day_pays_doubloons_and_xp_once(self):
        self.unlock()
        first = self.settle('daily', result(won=True), context={'day': '2026-10-19'}, game_id='win-1')
        second = self.settle('daily', result(won=True), context={'day': '2026-10-19'}, game_id='win-2')
        self.now += timedelta(days=1)
        tomorrow = self.settle('daily', result(won=True), context={'day': '2026-10-20'}, game_id='win-3')
        view = self.client.get('/api/daily').json()

        self.assertEqual((first['rewards']['stocks'], first['rewards']['xp']), (200, 30))
        self.assertEqual((second['rewards']['stocks'], second['rewards']['xp']), (0, 0))
        self.assertEqual(tomorrow['rewards']['stocks'], 200)
        self.assertEqual(view['week'], {'doubloons': 400, 'target': 1000, 'resets_at': '2026-10-26T00:00:00+00:00', 'wins_this_week': 2})
        self.assertTrue(view['won_today'])
