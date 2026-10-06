from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import datetime, timedelta, timezone
import tempfile
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import func, inspect, select, text

from app.config import Settings
from app.db import LearningActivity, Profile, RewardGrant, XPLedger
from app.economy import ServerChallengeResult, consume_daily_refresh, daily_can_start, settle_challenge
from app.economy_models import EconomyAccount, EconomyCommand, EconomyEvent
from app.main import create_app
from app.migration_v6 import upgrade
from test_learning import fixture_catalog

MONDAY = datetime(2026, 10, 5, 12, tzinfo=timezone.utc)


class EconomyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.settings = Settings(database_url=f'sqlite+aiosqlite:///{self.temp.name}/economy.db')
        self.app = create_app(self.settings, fixture_catalog())
        self.client = TestClient(self.app, headers={'Origin': 'http://localhost:5173'})
        self.client.__enter__()

        self.user_id = self.client.post('/api/session').json()['profile_id']
        self.clock = patch('app.economy.now', return_value=MONDAY)
        self.clock.start()

    def tearDown(self):
        self.clock.stop()
        self.client.__exit__(None, None, None)
        self.temp.cleanup()

    def post(self, route, key='command-key-001', **payload):
        return self.client.post('/api/me/economy/' + route, json={'idempotency_key': key, **payload})

    def wallet(self):
        response = self.client.get('/api/me/economy')
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def counts(self):
        async def read():
            async with self.app.state.db.sessions() as db:
                return tuple([await db.scalar(select(func.count()).select_from(model))
                              for model in (EconomyAccount, EconomyEvent, EconomyCommand, XPLedger, LearningActivity, RewardGrant)])
        return self.client.portal.call(read)

    def settle(self, mode='daily', won=True, attempt='attempt-one', at=MONDAY, **extra):
        result = ServerChallengeResult(attempt, mode, won, at, **extra)

        async def apply():
            async with self.app.state.db.sessions.begin() as db:
                await db.execute(text('BEGIN IMMEDIATE'))
                profile = await db.get(Profile, self.user_id)
                return await settle_challenge(db, profile, result)
        return self.client.portal.call(apply)

    def seed_premium(self, amount):
        self.post('login-claims')

        async def seed():
            async with self.app.state.db.sessions.begin() as db:
                account = await db.get(EconomyAccount, self.user_id)
                account.premium_balance = amount
        self.client.portal.call(seed)

    def test_read_is_pure_and_client_cannot_claim_results_or_balances(self):
        self.assertEqual(self.wallet()['stocks_balance'], 0)
        self.client.get('/api/me/economy/shop')
        self.assertEqual(self.counts(), (0, 0, 0, 0, 0, 0))
        for extra in ({'stocks': 10000}, {'premium_balance': 10000}, {'won': True}, {'policy_version': '2'}):
            self.assertEqual(self.post('login-claims', **extra).status_code, 422)
        self.assertEqual(self.client.post('/api/me/economy/settle', json={'won': True}).status_code, 404)
        self.assertEqual(self.counts(), (0, 0, 0, 0, 0, 0))

    def test_login_exact_replay_daily_cap_streak_gap_and_learning_separation(self):
        first = self.post('login-claims')
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(first.json()['awarded'], {'stocks': 20, 'premium': 0, 'xp': 5})
        self.assertEqual(first.json(), self.post('login-claims').json())
        self.assertEqual(first.json(), self.post('login-claims', key='different-key-001').json())
        self.assertEqual(self.counts(), (1, 1, 2, 1, 0, 0))
        with patch('app.economy.now', return_value=MONDAY + timedelta(days=1)):
            second = self.post('login-claims', key='tomorrow-key-001').json()
            self.assertEqual(second['wallet']['login_streak_days'], 2)
            self.assertEqual(second['wallet']['stocks_balance'], 40)
            self.assertEqual(first.json(), self.post('login-claims').json())
        with patch('app.economy.now', return_value=MONDAY + timedelta(days=3)):
            self.assertEqual(self.wallet()['login_streak_days'], 0)
            self.assertEqual(self.post('login-claims', key='after-gap-key-001').json()['wallet']['login_streak_days'], 1)
        self.assertEqual(self.client.get('/api/me/activity').json()['current_streak_days'], 0)
        self.assertEqual(self.post('daily-refresh').status_code, 409)

    def test_daily_first_win_each_day_and_game_xp_caps(self):
        first = self.settle()
        self.assertEqual(first['awarded'], {'stocks': 200, 'premium': 0, 'xp': 20})
        self.assertEqual(first, self.settle())
        second = self.settle(attempt='second-attempt')
        self.assertEqual(second['awarded'], {'stocks': 0, 'premium': 0, 'xp': 0})
        self.assertEqual(self.wallet()['stocks_balance'], 200)
        self.assertEqual(self.counts()[4], 0)
        with self.assertRaises(HTTPException) as raised:
            self.settle(won=False)
        self.assertEqual(raised.exception.status_code, 409)
        with patch('app.economy.now', return_value=MONDAY + timedelta(days=1)):
            third = self.settle(attempt='tomorrow-attempt', at=MONDAY + timedelta(days=1))
            self.assertEqual(third['awarded']['stocks'], 200)
        self.assertEqual(self.wallet()['stocks_balance'], 400)

    def test_loss_cooldown_crosses_midnight_and_abandonment_has_no_xp(self):
        late = MONDAY.replace(hour=23, minute=30)
        with patch('app.economy.now', return_value=late):
            outcome = self.settle(won=False, at=late, abandoned=True)
            self.assertEqual(outcome['awarded'], {'stocks': 0, 'premium': 0, 'xp': 0})

        async def check(at):
            async with self.app.state.db.sessions() as db:
                await daily_can_start(db, await db.get(Profile, self.user_id), at)
        with self.assertRaises(HTTPException) as raised:
            self.client.portal.call(check, late + timedelta(hours=1))
        self.assertEqual(raised.exception.status_code, 409)
        self.client.portal.call(check, late + timedelta(hours=2))
        self.assertEqual(self.counts()[3], 0)

    def test_premium_only_ranked_private_and_abandoned_do_not_reward(self):
        for mode, abandoned in (('private', False), ('public_ranked', True)):
            outcome = self.settle(mode, False, attempt=mode, abandoned=abandoned)
            self.assertEqual(outcome['awarded'], {'stocks': 0, 'premium': 0, 'xp': 0})
        self.assertEqual(self.settle('public_ranked', attempt='ranked-win')['awarded'], {'stocks': 0, 'premium': 10, 'xp': 10})
        self.assertEqual(self.settle('public_ranked', False, attempt='ranked-loss')['awarded'], {'stocks': 0, 'premium': 5, 'xp': 10})
        self.assertEqual(self.settle('practice', attempt='practice')['awarded']['xp'], 20)
        for attempt in ('boss-first', 'boss-retry'):
            boss = self.settle('chapter_entry', False, attempt=attempt, chapter_id='m02-how-markets-work')
            self.assertEqual(boss['awarded']['xp'], 20 if attempt == 'boss-first' else 0)
        self.assertEqual(self.wallet()['premium_balance'], 15)

    def test_refresh_exact_replay_cannot_clear_a_new_loss(self):
        self.seed_premium(20)
        self.settle(won=False)
        refreshed = self.post('daily-refresh', key='refresh-key-0001')
        self.assertEqual(refreshed.status_code, 200, refreshed.text)
        self.assertEqual(refreshed.json()['wallet']['premium_balance'], 10)
        self.assertIsNone(refreshed.json()['wallet']['daily_cooldown_until'])
        self.settle(won=False, attempt='second-loss')
        self.assertEqual(refreshed.json(), self.post('daily-refresh', key='refresh-key-0001').json())
        self.assertIsNotNone(self.wallet()['daily_cooldown_until'])
        self.assertEqual(self.wallet()['premium_balance'], 10)
        self.assertEqual(self.post('shop/purchases', key='refresh-key-0001', item_id='avatar-market-observer').status_code, 409)

    def test_paid_retry_correlation_rolls_back_consumes_once_and_cannot_steal_new_receipt(self):
        self.seed_premium(30)
        self.settle(won=False)
        self.assertEqual(self.post('daily-refresh', key='receipt-refresh-1').status_code, 200)

        async def consume(attempt, fail=False):
            async with self.app.state.db.sessions.begin() as db:
                await db.execute(text('BEGIN IMMEDIATE'))
                receipt = await consume_daily_refresh(db, await db.get(Profile, self.user_id), attempt)
                if fail:
                    raise RuntimeError('new attempt could not be stored')
                return receipt
        with self.assertRaisesRegex(RuntimeError, 'could not be stored'):
            self.client.portal.call(consume, 'retry-attempt', True)
        self.assertEqual(self.client.portal.call(consume, 'retry-attempt'), 'refresh:receipt-refresh-1')
        self.assertIsNone(self.client.portal.call(consume, 'unpaid-attempt'))
        self.settle(won=False, attempt='next-loss')
        self.assertEqual(self.post('daily-refresh', key='receipt-refresh-2').status_code, 200)
        self.assertEqual(self.client.portal.call(consume, 'retry-attempt'), 'refresh:receipt-refresh-1')
        self.assertIsNone(self.client.portal.call(consume, 'unpaid-attempt'))
        self.assertEqual(self.client.portal.call(consume, 'next-retry'), 'refresh:receipt-refresh-2')
        self.assertEqual(self.wallet()['premium_balance'], 10)

    def test_week_expiry_read_pure_replay_does_not_mint_and_new_claim_resets(self):
        first = self.post('login-claims').json()
        before = self.counts()
        with patch('app.economy.now', return_value=MONDAY + timedelta(days=7)):
            self.assertEqual(self.wallet()['stocks_balance'], 0)
            self.assertEqual(self.counts(), before)
            self.assertEqual(first, self.post('login-claims').json())
            self.assertEqual(self.counts(), before)
            new = self.post('login-claims', key='new-week-login').json()
            self.assertEqual(new['wallet']['stocks_balance'], 20)
            self.assertEqual(new['wallet']['stocks_week'], '2026-10-12')
            self.assertEqual(new['wallet']['login_streak_days'], 1)
        self.assertEqual(self.counts()[1], 3)

    def test_weekly_title_purchase_five_days_and_owned_inventory_equipment(self):
        for day in range(5):
            instant = MONDAY + timedelta(days=day)
            with patch('app.economy.now', return_value=instant):
                self.settle(attempt='daily-' + str(day), at=instant)
        purchased = self.post('shop/purchases', item_id='title-colossal-challenger')
        self.assertEqual(purchased.status_code, 200, purchased.text)
        item = purchased.json()['item']
        self.assertEqual(item['id'], 'title-colossal-challenger-2026-10-05')
        self.assertEqual(purchased.json()['wallet']['stocks_balance'], 0)
        self.assertEqual(purchased.json(), self.post('shop/purchases', item_id='title-colossal-challenger').json())
        repeated = self.post('shop/purchases', key='same-owned-title', item_id='title-colossal-challenger')
        self.assertEqual(repeated.json()['spent'], {'stocks': 0})
        self.assertIn(item['id'], [entry['id'] for entry in self.client.get('/api/me/rewards').json()['items']])
        equipped = self.client.patch('/api/me/rewards/equipment', json={'idempotency_key': 'equip-shop-title', 'title_id': item['id']})
        self.assertEqual(equipped.status_code, 200, equipped.text)
        with patch('app.economy.now', return_value=MONDAY + timedelta(days=7)):
            self.assertEqual(purchased.json(), self.post('shop/purchases', item_id='title-colossal-challenger').json())
            new_title = self.post('shop/purchases', key='next-week-title', item_id='title-colossal-challenger')
            self.assertEqual(new_title.status_code, 409)
            self.assertIn(item['id'], [entry['id'] for entry in self.client.get('/api/me/rewards').json()['items']])

    def test_insufficient_unknown_and_foreign_owned_shop_no_debit(self):
        self.assertEqual(self.post('shop/purchases', item_id='avatar-market-observer').status_code, 409)
        self.assertEqual(self.post('shop/purchases', item_id='unknown').status_code, 404)
        self.assertEqual(self.counts(), (0, 0, 0, 0, 0, 0))
        self.seed_premium(100)
        bought = self.post('shop/purchases', key='premium-purchase', item_id='avatar-market-observer')
        self.assertEqual(bought.status_code, 200, bought.text)
        self.assertEqual(self.wallet()['premium_balance'], 0)
        with TestClient(self.app, headers={'Origin': 'http://localhost:5173'}) as other:
            other.post('/api/session')
            denied = other.patch('/api/me/rewards/equipment', json={'idempotency_key': 'equip-other-item', 'avatar_id': 'avatar-market-observer'})
            self.assertEqual(denied.status_code, 403)

    def test_cross_worker_spend_cannot_overdraw(self):
        self.seed_premium(100)
        self.settle(won=False)
        second_app = create_app(self.settings, fixture_catalog())
        with TestClient(second_app, headers={'Origin': 'http://localhost:5173'}) as second:
            second.cookies.update(self.client.cookies)
            with ThreadPoolExecutor(max_workers=2) as pool:
                calls = [pool.submit(self.post, 'daily-refresh', 'race-refresh-key'),
                         pool.submit(second.post, '/api/me/economy/shop/purchases',
                                     json={'idempotency_key': 'race-purchase-key', 'item_id': 'avatar-market-observer'})]
                responses = [call.result() for call in calls]
            self.assertEqual(sorted(response.status_code for response in responses), [200, 409])
            self.assertIn(self.wallet()['premium_balance'], (0, 90))

    def test_cross_worker_login_is_one_grant_with_exact_receipts(self):
        second_app = create_app(self.settings, fixture_catalog())
        with TestClient(second_app, headers={'Origin': 'http://localhost:5173'}) as second:
            second.cookies.update(self.client.cookies)
            with ThreadPoolExecutor(max_workers=2) as pool:
                calls = [pool.submit(self.post, 'login-claims', 'worker-one-login'),
                         pool.submit(second.post, '/api/me/economy/login-claims',
                                     json={'idempotency_key': 'worker-two-login'})]
                results = [call.result() for call in calls]
            self.assertEqual([result.status_code for result in results], [200, 200])
            self.assertEqual(results[0].json(), results[1].json())
        self.assertEqual(self.counts(), (1, 1, 2, 1, 0, 0))

    def test_migration_reapply_preserves_all_populated_tables(self):
        self.post('login-claims')
        self.settle()

        async def verify():
            async with self.app.state.db.engine.begin() as connection:
                tables = await connection.run_sync(lambda sync: inspect(sync).get_table_names())
                before = {table: (await connection.execute(text('SELECT * FROM "' + table + '"'))).all() for table in tables}
                await upgrade(connection)
                await upgrade(connection)
                after = {table: (await connection.execute(text('SELECT * FROM "' + table + '"'))).all() for table in tables}
                self.assertEqual(before, after)
        self.client.portal.call(verify)

    def test_settlement_rolls_back_with_challenge_transaction(self):
        result = ServerChallengeResult('rollback-attempt', 'daily', True, MONDAY)

        async def apply():
            async with self.app.state.db.sessions.begin() as db:
                await settle_challenge(db, await db.get(Profile, self.user_id), result)
                raise RuntimeError('challenge finalization failed')
        with self.assertRaisesRegex(RuntimeError, 'finalization failed'):
            self.client.portal.call(apply)
        self.assertEqual(self.counts(), (0, 0, 0, 0, 0, 0))
        self.assertEqual(self.settle(attempt='rollback-attempt')['awarded']['stocks'], 200)

    def test_delayed_old_week_result_cannot_revive_expired_stocks(self):
        with patch('app.economy.now', return_value=MONDAY + timedelta(days=7)):
            result = self.settle(attempt='old-result')
            self.assertEqual(result['awarded'], {'stocks': 0, 'premium': 0, 'xp': 20})
            self.assertEqual(self.wallet()['stocks_balance'], 0)
            before = self.counts()
        with patch('app.economy.now', return_value=MONDAY + timedelta(days=14)):
            self.assertEqual(result, self.settle(attempt='old-result'))
            self.assertEqual(self.counts(), before)

    def test_yesterdays_form_completed_today_does_not_consume_todays_victory(self):
        tomorrow = MONDAY + timedelta(days=1)
        with patch('app.economy.now', return_value=tomorrow):
            old_form = self.settle(attempt='yesterday-form', at=tomorrow, challenge_day=MONDAY.date().isoformat())
            self.assertEqual(old_form['awarded'], {'stocks': 0, 'premium': 0, 'xp': 20})
            current_form = self.settle(attempt='today-form', at=tomorrow, challenge_day=tomorrow.date().isoformat())
            self.assertEqual(current_form['awarded'], {'stocks': 200, 'premium': 0, 'xp': 0})
            self.assertEqual(self.wallet()['stocks_balance'], 200)


if __name__ == '__main__':
    unittest.main()
