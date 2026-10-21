from datetime import timedelta
from types import SimpleNamespace
import unittest

from app.economy_models import EconomyAccount
from app.player import badges, ledger
from app.player.levels import level_for, rank_name
from progression_fixtures import AppCase, result


class LevelCurveTests(unittest.TestCase):
    def test_cumulative_totals_match_the_spec(self):
        self.assertEqual(level_for(0), (1, 0, 100))
        self.assertEqual(level_for(99), (1, 99, 100))
        self.assertEqual(level_for(100), (2, 0, 125))
        self.assertEqual(level_for(550)[0], 5)
        self.assertEqual(level_for(1800)[0], 10)
        self.assertEqual(level_for(6175)[0], 20)
        self.assertEqual(level_for(13050)[0], 30)

    def test_level_fifty_is_the_cap(self):
        self.assertEqual(level_for(34300), (50, 0, 0))
        self.assertEqual(level_for(10**7)[0], 50)

    def test_rank_names_follow_level_bands(self):
        self.assertEqual([rank_name(level) for level in (1, 4, 5, 10, 15, 20, 29, 30, 40, 50)],
                         ['Rookie Trader', 'Rookie Trader', 'Market Explorer', 'Chart Reader', 'Risk Manager', 'Strategist',
                          'Strategist', 'Seasoned Trader', 'Market Veteran', 'Captain of the Ledger'])


class PlayerTests(AppCase):
    def wallet(self, stocks=None, gems=None, week=None):
        async def change(db):
            account = await ledger.account(db, self.user_id, self.now)
            if stocks is not None:
                account.stocks_balance = stocks
            if gems is not None:
                account.premium_balance = gems
            if week is not None:
                account.stocks_week = week
        self.run_db(change)

    def claim(self):
        response = self.client.post('/api/me/daily-login', json={})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_new_player_profile_has_defaults_and_locked_modes(self):
        me = self.client.get('/api/me').json()

        self.assertEqual(me['avatar_id'], 'avatar-starter-1')
        self.assertEqual((me['level'], me['xp'], me['xp_into_level'], me['xp_for_next_level']), (1, 0, 0, 100))
        self.assertEqual((me['title'], me['title_id'], me['rank_name']), ('Rookie Trader', None, 'Rookie Trader'))
        self.assertEqual(me['wallet'], {'doubloons': 0, 'doubloons_week_ends_at': '2026-10-26T00:00:00+00:00', 'gems': 0})
        self.assertEqual(me['streak'], {'days': 0, 'claimed_today': False, 'cycle_day': 1})
        self.assertEqual(me['unlocks'], {'daily': False, 'ranked': False})

    def test_profile_requires_a_valid_session(self):
        self.client.cookies.clear()
        self.client.cookies.set('traders_edge_session', 'expired')

        self.assertEqual(self.client.get('/api/me').status_code, 401)

    def test_boss_wins_unlock_daily_and_ranked_flags(self):
        self.win_boss('ch1')
        self.win_boss('ch3')

        self.assertEqual(self.client.get('/api/me').json()['unlocks'], {'daily': True, 'ranked': True})

    def test_profile_update_checks_ownership(self):
        renamed = self.client.patch('/api/me', json={'display_name': 'Captain', 'avatar_id': 'avatar-starter-3', 'leaderboard_opt_in': True})
        not_owned = self.client.patch('/api/me', json={'avatar_id': 'avatar-bull'})
        unknown = self.client.patch('/api/me', json={'title_id': 'avatar-starter-2'})
        rank_title = self.client.patch('/api/me', json={'title_id': 'title-rank-rookie-trader'})
        cleared = self.client.patch('/api/me', json={'title_id': None})
        blank = self.client.patch('/api/me', json={'display_name': ''})

        self.assertEqual(renamed.status_code, 200, renamed.text)
        self.assertEqual((renamed.json()['display_name'], renamed.json()['avatar_id'], renamed.json()['leaderboard_opt_in']),
                         ('Captain', 'avatar-starter-3', True))
        self.assertEqual((not_owned.status_code, not_owned.json()['detail']), (403, 'You have not unlocked this avatar yet'))
        self.assertEqual(unknown.status_code, 422)
        self.assertEqual(rank_title.json()['title'], 'Rookie Trader')
        self.assertIsNone(cleared.json()['title_id'])
        self.assertEqual(blank.status_code, 422)

    def test_login_streak_cycles_through_seven_days_then_repeats(self):
        claims = []
        for _ in range(8):
            claims.append(self.claim())
            self.now += timedelta(days=1)

        self.assertEqual([claim['day'] for claim in claims], [1, 2, 3, 4, 5, 6, 7, 1])
        self.assertEqual([claim['doubloons'] for claim in claims], [20, 20, 20, 30, 30, 30, 50, 20])
        self.assertEqual([claim['xp'] for claim in claims], [10, 10, 10, 10, 20, 20, 20, 10])
        self.assertEqual(claims[-1]['player']['streak'], {'days': 8, 'claimed_today': True, 'cycle_day': 1})

    def test_login_reward_is_claimed_once_per_utc_day(self):
        first = self.claim()
        repeat = self.claim()

        self.assertFalse(first['already_claimed'])
        self.assertEqual((repeat['already_claimed'], repeat['day'], repeat['doubloons'], repeat['xp']), (True, 1, 20, 10))
        self.assertEqual(repeat['player']['wallet']['doubloons'], 20)
        self.assertEqual(repeat['player']['xp'], 10)

    def test_missing_a_day_resets_the_streak(self):
        self.claim()
        self.now += timedelta(days=1)
        self.claim()
        self.now += timedelta(days=2)
        missed = self.client.get('/api/me').json()['streak']
        claim = self.claim()

        self.assertEqual(missed, {'days': 0, 'claimed_today': False, 'cycle_day': 1})
        self.assertEqual(claim['day'], 1)

    def test_activity_lists_days_and_the_current_cycle(self):
        self.claim()
        self.now += timedelta(days=1)
        self.claim()

        activity = self.client.get('/api/me/activity').json()

        self.assertEqual(activity['days'], [{'date': '2026-10-19', 'count': 1}, {'date': '2026-10-20', 'count': 1}])
        self.assertEqual(activity['streak_days'], 2)
        self.assertEqual([(day['date'], day['claimed']) for day in activity['week'][:3]],
                         [('2026-10-19', True), ('2026-10-20', True), ('2026-10-21', False)])
        self.assertEqual([day['doubloons'] for day in activity['week']], [20, 20, 20, 30, 30, 30, 50])

    def test_doubloons_expire_at_monday_midnight_utc(self):
        self.claim()
        self.now = self.now + timedelta(days=6, hours=11, minutes=59)
        sunday = self.client.get('/api/me').json()['wallet']['doubloons']
        self.now += timedelta(minutes=2)
        monday = self.client.get('/api/me').json()['wallet']['doubloons']
        claim = self.claim()

        async def account(db):
            return (await db.get(EconomyAccount, self.user_id)).stocks_balance
        self.assertEqual((sunday, monday), (20, 0))
        self.assertEqual(claim['player']['wallet']['doubloons'], 20)
        self.assertEqual(self.run_db(account), 20)

    def test_shop_purchase_spends_currency_and_grants_the_item(self):
        self.wallet(gems=130)
        bought = self.client.post('/api/shop/purchase', json={'item_id': 'avatar-bull'})
        again = self.client.post('/api/shop/purchase', json={'item_id': 'avatar-bull'})
        equipped = self.client.patch('/api/me', json={'avatar_id': 'avatar-bull'})
        shop = {item['id']: item for item in self.client.get('/api/shop').json()['items']}

        self.assertEqual(bought.status_code, 200, bought.text)
        self.assertEqual(bought.json()['player']['wallet']['gems'], 10)
        self.assertEqual((again.status_code, again.json()['detail']), (409, 'You already own this item'))
        self.assertEqual(equipped.json()['avatar_id'], 'avatar-bull')
        self.assertTrue(shop['avatar-bull']['owned'])
        self.assertEqual((shop['title-colossal-challenger']['currency'], shop['title-colossal-challenger']['price'],
                          shop['title-colossal-challenger']['weekly']), ('stocks', 1000, True))

    def test_shop_rejects_insufficient_funds_and_unknown_items(self):
        self.wallet(stocks=900)
        poor = self.client.post('/api/shop/purchase', json={'item_id': 'title-colossal-challenger'})
        unknown = self.client.post('/api/shop/purchase', json={'item_id': 'avatar-guide-1'})

        self.assertEqual((poor.status_code, poor.json()['detail']), (409, 'You need 100 more Doubloons for this item'))
        self.assertEqual(unknown.status_code, 404)
        self.assertEqual(self.client.get('/api/me').json()['wallet']['doubloons'], 900)

    def test_collection_shows_owned_items_badges_and_stats(self):
        self.complete_chapter('ch1')
        collection = self.client.get('/api/me/collection').json()
        badges = {badge['id']: badge for badge in collection['badges']}
        avatars = {item['id']: item for item in collection['avatars']}

        self.assertTrue(badges['badge-first-steps']['earned'])
        self.assertIsNotNone(badges['badge-first-steps']['earned_at'])
        self.assertEqual(badges['badge-boss-slayer']['progress'], '1/3')
        self.assertEqual(badges['badge-streak-master']['progress'], '0/30')
        self.assertEqual(len(badges), 16)
        self.assertTrue(avatars['avatar-guide-1']['owned'])
        self.assertTrue(avatars['avatar-ch1-explorer']['owned'])
        self.assertTrue(avatars['avatar-starter-1']['equipped'])
        self.assertFalse(avatars['avatar-bull']['owned'])
        self.assertEqual(collection['stats'], {'levels_done': 5, 'stars': 6, 'bosses_won': 1, 'quizzes_passed': 0, 'matches_played': 0,
                                               'best_profit': 100.0})

    def test_fee_fighter_needs_three_trades_and_low_fees_but_no_win(self):
        settled = self.settle('practice', result(won=False, trades=3, fees=12.5), scenario_id='practice-choppy-range', plan={'strategy': 'dip'})

        self.assertEqual({badge['id'] for badge in settled['rewards']['badges']}, {'badge-first-plan', 'badge-fee-fighter'})

    def test_fee_fighter_is_not_earned_with_fewer_than_three_trades(self):
        settled = self.settle('practice', result(won=True, trades=2, fees=2.0), scenario_id='practice-choppy-range')

        self.assertNotIn('badge-fee-fighter', {badge['id'] for badge in settled['rewards']['badges']})

    def test_leaderboards_list_only_opted_in_players(self):
        self.claim()
        hidden = self.client.get('/api/leaderboards/xp').json()
        self.client.patch('/api/me', json={'leaderboard_opt_in': True, 'display_name': 'Visible'})
        visible = self.client.get('/api/leaderboards/xp').json()
        ranked = self.client.get('/api/leaderboards/ranked').json()

        self.assertEqual(hidden, {'entries': [], 'me': {'rank': None, 'value': 10}})
        self.assertEqual(visible['entries'], [{'rank': 1, 'name': 'Visible', 'avatar_id': 'avatar-starter-1', 'level': 1, 'value': 10,
                                               'tier': None, 'is_me': True}])
        self.assertEqual(ranked, {'entries': [], 'me': {'rank': None, 'value': 1000}})


def badge_result(kept=True, forfeited=False):
    outcome = result(forfeited=forfeited)
    outcome['plan_review'] = {'strategy': 'hold', 'max_loss_pct': 5, 'worst_drawdown_pct': 1, 'kept_loss_limit': kept}
    return outcome


def badge_order(tick, kind='market', side='buy', cancelled=None):
    return SimpleNamespace(tick=tick, type=kind, side=side, symbol='SUNR', qty=1, cancelled_tick=cancelled)


class MatchBadgeTests(unittest.TestCase):
    game = SimpleNamespace(scenario_id='practice-trend-rider')
    participant = SimpleNamespace(plan={'strategy': 'hold'})

    def earned(self, outcome, orders, ticks=10):
        return badges.match_badges(self.game, self.participant, outcome, orders, ticks)

    def test_patient_trader_needs_a_late_order_and_a_kept_plan_without_a_win(self):
        self.assertIn('patient-trader', self.earned(badge_result(), [badge_order(4)]))

    def test_patient_trader_is_not_earned_without_orders_early_orders_or_a_broken_plan(self):
        self.assertNotIn('patient-trader', self.earned(badge_result(), []))
        self.assertNotIn('patient-trader', self.earned(badge_result(), [badge_order(3), badge_order(6)]))
        self.assertNotIn('patient-trader', self.earned(badge_result(kept=False), [badge_order(6)]))

    def test_risk_manager_ignores_a_stop_cancelled_on_the_day_it_was_placed(self):
        stopped = [badge_order(1), badge_order(1, kind='stop', side='sell')]
        withdrawn = [badge_order(1), badge_order(1, kind='stop', side='sell', cancelled=1)]

        self.assertIn('risk-manager', self.earned(badge_result(), stopped))
        self.assertNotIn('risk-manager', self.earned(badge_result(), withdrawn))
