from decimal import Decimal
import unittest

from app.game import engine
from game_fixtures import flat_match, order, participants, scenario, set_bar


class MarketExecutionTests(unittest.TestCase):
    def test_market_buy_fills_at_close_plus_half_spread_and_pays_minimum_fee(self):
        match = flat_match()

        match.advance(0, [order('b1', 'buy', 10)])

        fill = match.books['me'].fills[0]
        self.assertEqual((fill.t, fill.price, fill.fee), (0, Decimal('50.05'), Decimal('1.00')))
        self.assertEqual(match.books['me'].cash, Decimal('9498.50'))

    def test_market_sell_fills_at_close_minus_half_spread_and_records_realized_gain(self):
        match = flat_match()
        set_bar(match, 'LEAF', 1, '55', '55', '55', '55')

        match.advance(1, [order('b1', 'buy', 10), order('s1', 'sell', 10, tick=1)])

        fill = match.books['me'].fills[1]
        self.assertEqual((fill.price, fill.fee), (Decimal('54.95'), Decimal('1.00')))
        self.assertEqual(match.books['me'].realized, Decimal('49.00'))
        self.assertEqual(match.books['me'].qty('LEAF'), 0)

    def test_percentage_fee_applies_above_the_minimum(self):
        match = flat_match()

        match.advance(0, [order('b1', 'buy', 100)])

        self.assertEqual(match.books['me'].fills[0].fee, Decimal('5.01'))

    def test_profit_includes_fees_and_spread(self):
        match = flat_match()

        match.advance(0, [order('b1', 'buy', 10)])

        self.assertEqual(match.profit('me'), Decimal('-1.50'))


class RestingOrderTests(unittest.TestCase):
    def test_buy_limit_does_not_fill_on_the_bar_it_was_placed(self):
        match = flat_match()
        set_bar(match, 'LEAF', 0, '50', '50', '47', '50')

        match.advance(0, [order('l1', 'buy', 10, kind='limit', limit='48')])

        self.assertEqual(match.books['me'].orders['l1'].status, 'open')

    def test_buy_limit_fills_at_limit_when_the_next_low_touches_it(self):
        match = flat_match()
        set_bar(match, 'LEAF', 1, '49', '49.5', '47.5', '48.5')

        match.advance(1, [order('l1', 'buy', 10, kind='limit', limit='48')])

        self.assertEqual(match.books['me'].fills[0].price, Decimal('48'))
        self.assertEqual(match.books['me'].orders['l1'].status, 'filled')

    def test_buy_limit_fills_at_the_open_after_a_gap_down(self):
        match = flat_match()
        set_bar(match, 'LEAF', 1, '46', '47', '45', '46.5')

        match.advance(1, [order('l1', 'buy', 10, kind='limit', limit='48')])

        self.assertEqual(match.books['me'].fills[0].price, Decimal('46'))

    def test_sell_limit_fills_at_the_open_after_a_gap_up(self):
        match = flat_match()
        set_bar(match, 'LEAF', 1, '54', '55', '53.5', '54')

        match.advance(1, [order('b1', 'buy', 10), order('l1', 'sell', 10, kind='limit', limit='52')])

        self.assertEqual(match.books['me'].fills[1].price, Decimal('54'))

    def test_stop_loss_triggers_at_stop_minus_half_spread(self):
        match = flat_match()
        set_bar(match, 'LEAF', 1, '49', '49', '47.9', '48.5')

        match.advance(1, [order('b1', 'buy', 10), order('s1', 'sell', 10, kind='stop', stop='48')])

        self.assertEqual(match.books['me'].fills[1].price, Decimal('47.95'))

    def test_stop_loss_fills_at_the_gapped_open_below_the_stop(self):
        match = flat_match()
        set_bar(match, 'LEAF', 1, '45', '46', '44', '45.5')

        match.advance(1, [order('b1', 'buy', 10), order('s1', 'sell', 10, kind='stop', stop='48')])

        self.assertEqual(match.books['me'].fills[1].price, Decimal('44.96'))

    def test_order_cancelled_before_the_touching_bar_never_fills_and_releases_cash(self):
        match = flat_match()
        set_bar(match, 'LEAF', 3, '47', '47', '46', '46')

        match.advance(3, [order('l1', 'buy', 10, kind='limit', limit='48', cancelled=2)])

        self.assertEqual(match.books['me'].orders['l1'].status, 'cancelled')
        self.assertEqual(match.books['me'].available_cash(), Decimal('10000'))


class ReservationAndRejectionTests(unittest.TestCase):
    def rejection(self, match, new_order):
        with self.assertRaises(engine.OrderRejected) as caught:
            match.validate(new_order)
        return str(caught.exception)

    def test_buy_limit_reserves_cash_so_a_market_buy_is_rejected_with_amounts(self):
        match = flat_match().advance(0, [order('l1', 'buy', 190, kind='limit', limit='50')])

        reason = self.rejection(match, order('b1', 'buy', 10))

        self.assertEqual(reason, 'Not enough cash: this order needs $501.50 and you have $490.50.')

    def test_stop_reserves_shares_so_a_second_sell_is_rejected(self):
        match = flat_match().advance(0, [order('b1', 'buy', 10), order('s1', 'sell', 10, kind='stop', stop='45')])

        reason = self.rejection(match, order('s2', 'sell', 1))

        self.assertEqual(reason, 'All your LEAF shares are already reserved by open sell orders.')

    def test_selling_more_than_held_is_rejected(self):
        match = flat_match().advance(0, [order('b1', 'buy', 10)])

        self.assertEqual(self.rejection(match, order('s1', 'sell', 11)), 'Not enough shares: you can sell up to 10 LEAF.')

    def test_selling_without_shares_is_rejected(self):
        match = flat_match().advance(0)

        self.assertEqual(self.rejection(match, order('s1', 'sell', 1)), 'You do not own any LEAF shares to sell.')

    def test_disabled_order_type_is_rejected(self):
        match = flat_match(scenario(allow={'limit': False, 'stop': False})).advance(0)

        reason = self.rejection(match, order('l1', 'buy', 1, kind='limit', limit='40'))

        self.assertEqual(reason, 'Limit orders are not available in this match.')

    def test_stop_at_or_above_the_price_is_rejected(self):
        match = flat_match().advance(0, [order('b1', 'buy', 10)])

        reason = self.rejection(match, order('s1', 'sell', 10, kind='stop', stop='50'))

        self.assertEqual(reason, 'A stop-loss price must be below the current price of $50.00.')

    def test_max_position_pct_rejects_an_oversized_buy(self):
        match = flat_match(scenario(max_position_pct=50)).advance(0)

        reason = self.rejection(match, order('b1', 'buy', 150))

        self.assertEqual(reason, 'This order would put 75.0% of your portfolio in LEAF; this match allows at most 50%.')

    def test_max_position_pct_allows_a_buy_within_the_cap(self):
        match = flat_match(scenario(max_position_pct=50)).advance(0)

        match.validate(order('b1', 'buy', 90))

    def test_unknown_symbol_is_rejected(self):
        match = flat_match().advance(0)

        self.assertEqual(self.rejection(match, order('b1', 'buy', 1, symbol='ZZZZ')), 'ZZZZ is not traded in this match.')

    def test_cancel_of_a_filled_order_is_rejected(self):
        match = flat_match().advance(0, [order('b1', 'buy', 1)])

        with self.assertRaisesRegex(engine.OrderRejected, 'already filled'):
            match.cancel('me', 'b1', 0)


class ReplayTests(unittest.TestCase):
    def test_stored_orders_replay_to_the_state_seen_at_placement(self):
        data = scenario()
        live = engine.replay(data, 7, participants(data), [], 4)
        placed = order('b1', 'buy', 20, tick=4)
        live.place(placed)

        replayed = engine.replay(data, 7, participants(data), [order('b1', 'buy', 20, tick=4)], 4)

        self.assertEqual(replayed.books['me'].cash, live.books['me'].cash)
        self.assertEqual(replayed.books['me'].fills, live.books['me'].fills)

    def test_match_end_values_equity_at_the_last_close(self):
        data = scenario()

        match = engine.replay(data, 3, participants(data), [order('b1', 'buy', 10)], data['ticks'])

        last = match.bar('LEAF', data['ticks'] - 1).c
        self.assertEqual(match.processed, data['ticks'] - 1)
        self.assertEqual(match.equity('me'), match.books['me'].cash + 10 * last)

    def test_briefing_tick_processes_no_bars(self):
        data = scenario(bots=['hodl-hannah'])

        match = engine.replay(data, 3, participants(data), [], -1)

        self.assertEqual(match.processed, -1)
        self.assertEqual([entry['profit'] for entry in match.leaderboard()], [Decimal('0.00'), Decimal('0.00')])

    def test_invalid_stored_order_raises_a_replay_error(self):
        data = scenario()

        with self.assertRaises(engine.ReplayError):
            engine.replay(data, 3, participants(data), [order('s1', 'sell', 5)], 0)


class LeaderboardTests(unittest.TestCase):
    def test_equal_profits_share_a_rank(self):
        match = flat_match(human_ids=('a', 'b')).advance(0)

        self.assertEqual([entry['rank'] for entry in match.leaderboard()], [1, 1])

    def test_forfeit_ranks_last_even_with_higher_profit(self):
        match = flat_match(human_ids=('a', 'b'))
        set_bar(match, 'LEAF', 1, '60', '60', '60', '60')
        match.advance(1, [order('b1', 'buy', 10, pid='a')])
        match.participants['a'].forfeited = True

        board = match.leaderboard()

        self.assertEqual([(e['participant_id'], e['rank']) for e in board], [('b', 1), ('a', 2)])

    def test_buy_hold_profit_values_an_equal_weight_portfolio_from_tick_zero(self):
        match = flat_match()
        set_bar(match, 'LEAF', 1, '55', '55', '55', '55')
        match.advance(1)

        profit = match.buy_hold_profit(['LEAF'])

        self.assertEqual(profit, Decimal(199) * (Decimal('55') - Decimal('50.05')) - Decimal('9.96'))


if __name__ == '__main__':
    unittest.main()
