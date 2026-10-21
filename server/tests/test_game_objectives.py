import unittest

from app.game import objectives, review
from game_fixtures import flat_match, order, scenario, set_bar

PLAN = {'strategy': 'trend', 'max_loss_pct': 5}
NEWS = {'id': 'big-news', 'tick': 2, 'headline': 'Leafy Greens wins a contract', 'body': 'Body', 'tone': 'positive',
        'symbols': ['LEAF'], 'effects': []}


def check(match, kind, params=None, plan=None, pid='me'):
    return objectives.check({'type': kind, 'params': params or {}}, match, pid, plan)


def price(match, t, value, symbol='LEAF'):
    set_bar(match, symbol, t, value, value, value, value)


class CountMissionTests(unittest.TestCase):
    def test_trades_min_counts_fills(self):
        match = flat_match().advance(0, [order('b1', 'buy', 1)])

        self.assertEqual(check(match, 'trades_min', {'n': 1}), (True, '1/1'))
        self.assertEqual(check(match, 'trades_min', {'n': 2}), (False, '1/2'))

    def test_trades_max_fails_after_too_many_fills(self):
        match = flat_match().advance(0, [order('b1', 'buy', 1), order('b2', 'buy', 1), order('b3', 'buy', 1)])

        self.assertEqual(check(match, 'trades_max', {'n': 2}), (False, '3 of at most 2'))

    def test_use_order_counts_placed_orders_even_if_unfilled(self):
        match = flat_match().advance(0, [order('l1', 'buy', 1, kind='limit', limit='40')])

        self.assertTrue(check(match, 'use_order', {'type': 'limit', 'n': 1})[0])

    def test_stop_loss_set_needs_a_stop_order(self):
        match = flat_match().advance(0, [order('b1', 'buy', 5)])
        self.assertFalse(check(match, 'stop_loss_set')[0])

        protected = flat_match().advance(0, [order('b1', 'buy', 5), order('s1', 'sell', 5, kind='stop', stop='45')])
        self.assertTrue(check(protected, 'stop_loss_set')[0])

    def test_min_holdings_counts_distinct_symbols_held_at_once(self):
        match = flat_match().advance(1, [order('b1', 'buy', 1), order('b2', 'buy', 1, symbol='ROCK', tick=1)])

        self.assertEqual(check(match, 'min_holdings', {'n': 2}), (True, '2/2'))


class HoldingMissionTests(unittest.TestCase):
    def test_hold_at_end_checks_a_symbol_or_any_holding(self):
        match = flat_match().advance(0, [order('b1', 'buy', 1)])

        self.assertTrue(check(match, 'hold_at_end')[0])
        self.assertTrue(check(match, 'hold_at_end', {'symbol': 'LEAF'})[0])
        self.assertFalse(check(match, 'hold_at_end', {'symbol': 'ROCK'})[0])

    def test_end_in_cash_requires_no_positions(self):
        match = flat_match().advance(1, [order('b1', 'buy', 1), order('s1', 'sell', 1, tick=1)])

        self.assertEqual(check(match, 'end_in_cash'), (True, 'In cash'))

    def test_held_between_waits_for_the_window_then_passes(self):
        orders = [order('b1', 'buy', 5, tick=2)]

        self.assertEqual(check(flat_match().advance(4, orders), 'held_between', {'symbol': 'LEAF', 'from': 3, 'to': 5}), (False, 'Not yet'))
        self.assertEqual(check(flat_match().advance(6, orders), 'held_between', {'symbol': 'LEAF', 'from': 3, 'to': 5}), (True, 'Held'))

    def test_held_between_breaks_when_sold_inside_the_window(self):
        match = flat_match().advance(6, [order('b1', 'buy', 5, tick=2), order('s1', 'sell', 5, tick=4)])

        self.assertEqual(check(match, 'held_between', {'symbol': 'LEAF', 'from': 3, 'to': 5}), (False, 'Broken'))

    def test_exited_by_passes_when_out_from_the_tick_on(self):
        match = flat_match().advance(8, [order('b1', 'buy', 5), order('s1', 'sell', 5, tick=3)])

        self.assertEqual(check(match, 'exited_by', {'symbol': 'LEAF', 'tick': 4}), (True, 'Out'))
        self.assertEqual(check(match, 'exited_by', {'symbol': 'LEAF', 'tick': 9}), (False, 'Not yet'))

    def test_exited_by_fails_while_still_holding(self):
        match = flat_match().advance(8, [order('b1', 'buy', 5)])

        self.assertEqual(check(match, 'exited_by', {'symbol': 'LEAF', 'tick': 4}), (False, 'Still holding'))

    def test_max_position_before_only_counts_earlier_ticks(self):
        match = flat_match().advance(6, [order('b1', 'buy', 150, tick=5)])

        self.assertTrue(check(match, 'max_position_before', {'tick': 5, 'pct': 50})[0])
        self.assertFalse(check(match, 'max_position_before', {'tick': 6, 'pct': 50, 'symbol': 'LEAF'})[0])
        self.assertTrue(check(match, 'max_position_before', {'tick': 6, 'pct': 50, 'symbol': 'ROCK'})[0])

    def test_max_position_limits_the_largest_position(self):
        match = flat_match().advance(0, [order('b1', 'buy', 100)])

        self.assertTrue(check(match, 'max_position', {'pct': 60})[0])
        self.assertFalse(check(match, 'max_position', {'pct': 40})[0])


class ResultMissionTests(unittest.TestCase):
    def test_profit_min_and_profit_pct_min_use_current_profit(self):
        match = flat_match()
        price(match, 1, '60')

        match.advance(1, [order('b1', 'buy', 100)])

        self.assertTrue(check(match, 'profit_min', {'amount': 900})[0])
        self.assertTrue(check(match, 'profit_pct_min', {'pct': 9})[0])
        self.assertFalse(check(match, 'profit_pct_min', {'pct': 10})[0])

    def test_rank_max_one_requires_strictly_beating_everyone(self):
        tied = flat_match(human_ids=('me', 'rival')).advance(0)
        self.assertFalse(check(tied, 'rank_max', {'rank': 1})[0])

        ahead = flat_match(human_ids=('me', 'rival')).advance(1, [order('b1', 'buy', 1, pid='rival')])
        self.assertEqual(check(ahead, 'rank_max', {'rank': 1}), (True, 'Rank 1 of 2'))

    def test_beat_bot_compares_profit_with_the_named_bot(self):
        match = flat_match(scenario(bots=['hodl-hannah'])).advance(1)

        self.assertTrue(check(match, 'beat_bot', {'bot_id': 'hodl-hannah'})[0])
        self.assertEqual(check(match, 'beat_bot', {'bot_id': 'momentum-max-pro'}), (False, 'Not in this match'))

    def test_beat_buy_hold_fails_when_idle_in_a_rising_market(self):
        match = flat_match()
        price(match, 1, '60')

        self.assertFalse(check(match.advance(1), 'beat_buy_hold', {'symbol': 'LEAF'})[0])

    def test_max_drawdown_and_kept_plan_use_the_worst_drop(self):
        match = flat_match()
        price(match, 1, '40')

        match.advance(1, [order('b1', 'buy', 100)])

        self.assertFalse(check(match, 'max_drawdown', {'pct': 5})[0])
        self.assertTrue(check(match, 'max_drawdown', {'pct': 15})[0])
        self.assertFalse(check(match, 'kept_plan', plan=PLAN)[0])
        self.assertEqual(check(match, 'kept_plan'), (False, 'No plan'))

    def test_news_reaction_missions_respect_the_window(self):
        match = flat_match(scenario(news=[NEWS])).advance(5, [order('b1', 'buy', 5, tick=3), order('s1', 'sell', 5, tick=5)])

        self.assertTrue(check(match, 'bought_after_news', {'news_id': 'big-news', 'within': 1})[0])
        self.assertTrue(check(match, 'sold_after_news', {'news_id': 'big-news', 'within': 3})[0])
        self.assertFalse(check(match, 'sold_after_news', {'news_id': 'big-news', 'within': 2})[0])

    def test_no_buy_between_breaks_on_a_buy_inside_the_window(self):
        match = flat_match().advance(4, [order('b1', 'buy', 5, tick=3)])

        self.assertEqual(check(match, 'no_buy_between', {'from': 2, 'to': 4}), (False, 'Broken'))
        self.assertEqual(check(match, 'no_buy_between', {'from': 4, 'to': 6}), (True, 'Kept'))

    def test_forfeit_marks_every_mission_not_done(self):
        match = flat_match().advance(0, [order('b1', 'buy', 1)])
        match.participants['me'].forfeited = True

        missions = objectives.evaluate(match, 'me', PLAN)

        self.assertEqual([(m['done'], m['progress']) for m in missions], [(False, 'Forfeited')])


class LiveStateTests(unittest.TestCase):
    def states(self, missions, final, trades):
        data = scenario(missions={'basic': missions, 'bonus': []})
        match = flat_match(data).advance(trades, [order(f'b{t}', 'buy', 1, tick=t) for t in range(trades)])
        return [m['state'] for m in objectives.evaluate(match, 'me', PLAN, final=final)]

    def test_end_of_match_missions_are_only_on_track_during_play(self):
        hold = {'id': 'h', 'type': 'hold_at_end', 'params': {}, 'text': 'Hold'}

        self.assertEqual(self.states([hold], final=False, trades=1), ['on_track'])
        self.assertEqual(self.states([hold], final=True, trades=1), ['done'])

    def test_milestones_complete_during_play(self):
        trade = {'id': 't', 'type': 'trades_min', 'params': {'n': 1}, 'text': 'Trade'}

        self.assertEqual(self.states([trade], final=False, trades=0), ['pending'])
        self.assertEqual(self.states([trade], final=False, trades=1), ['done'])

    def test_broken_rules_fail_before_the_end(self):
        cap = {'id': 'c', 'type': 'trades_max', 'params': {'n': 1}, 'text': 'Few trades'}

        self.assertEqual(self.states([cap], final=False, trades=3), ['failed'])


class ReviewTests(unittest.TestCase):
    def test_stop_protected_buys_raise_the_decision_score(self):
        bare = flat_match().advance(1, [order('b1', 'buy', 5)])
        protected = flat_match().advance(1, [order('b1', 'buy', 5), order('s1', 'sell', 5, kind='stop', stop='45', tick=1)])
        missions = [{'tier': 'basic', 'done': True}]

        self.assertEqual(review.decision_breakdown(protected, 'me', PLAN, missions)['risk']
                         - review.decision_breakdown(bare, 'me', PLAN, missions)['risk'], 25)

    def test_idle_player_scores_plan_and_overtrading_only(self):
        match = flat_match().advance(3)

        self.assertEqual(review.decision_breakdown(match, 'me', PLAN, [{'tier': 'bonus', 'done': False}]),
                         {'missions': 0, 'plan': 25, 'risk': 0, 'overtrading': 10})

    def test_key_moments_describe_news_with_the_players_holding(self):
        match = flat_match(scenario(news=[NEWS]))
        for t in range(2, 20):
            price(match, t, '55')

        match.advance(5, [order('b1', 'buy', 10)])

        moments = review.key_moments(match, 'me')
        self.assertIn('Day 3: Leafy Greens wins a contract (+10.0%). You held 10 LEAF and gained $50.00.', moments)
        self.assertLessEqual(len(moments), 5)

    def test_key_moments_note_a_match_without_trades(self):
        match = flat_match().advance(3)

        self.assertEqual(review.key_moments(match, 'me'), ['You made no trades, so your money stayed in cash all match.'])


if __name__ == '__main__':
    unittest.main()
