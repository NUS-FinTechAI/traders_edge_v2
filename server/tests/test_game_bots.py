from decimal import Decimal
import unittest

from app.game import engine
from app.game.scenario import load_bots, load_scenarios
from game_fixtures import flat_match, scenario, set_bar

UPTREND = [{'from': 0, 'to': 40, 'market_drift': 0.003, 'vol_mult': 1.0}]


def headline(tick, tone, kind, symbol='LEAF'):
    return {'id': f'n{tick}', 'tick': tick, 'headline': 'Headline', 'body': 'Body', 'tone': tone, 'kind': kind,
            'symbols': [symbol], 'effects': []}


def all_bots_match(data, seed):
    bots = load_bots()
    return engine.Match(data, seed, [engine.Participant(b, b, bot) for b, bot in bots.items()])


def bot_fills(match, upto=None):
    return {pid: [(f.t, f.symbol, f.side, f.qty, f.price) for f in book.fills if upto is None or f.t <= upto]
            for pid, book in match.books.items()}


def trades(match, bot_id):
    return [(f.t, f.symbol, f.side) for f in match.books[bot_id].fills]


class BotDeterminismTests(unittest.TestCase):
    def test_same_seed_gives_identical_bot_trades(self):
        data = scenario(ticks=40, regimes=UPTREND, history=30)

        first = all_bots_match(data, 5).advance(39)
        second = all_bots_match(data, 5).advance(39)

        self.assertEqual(bot_fills(first), bot_fills(second))
        self.assertTrue(any(bot_fills(first).values()))

    def test_future_bars_and_news_do_not_change_earlier_bot_trades(self):
        known = scenario(ticks=40, regimes=UPTREND, history=30)
        surprise = scenario(ticks=40, regimes=UPTREND, history=30, news=[
            {'id': 'shock', 'tick': 21, 'headline': 'Shock', 'body': 'Body', 'tone': 'negative', 'kind': 'macro',
             'symbols': ['LEAF', 'ROCK'], 'effects': [{'symbol': 'LEAF', 'move': -0.3, 'ticks': 5, 'gap': True}]}])

        before = all_bots_match(known, 8).advance(39)
        after = all_bots_match(surprise, 8).advance(39)

        self.assertEqual(bot_fills(before, upto=20), bot_fills(after, upto=20))
        self.assertNotEqual(bot_fills(before), bot_fills(after))

    def test_every_roster_bot_keeps_a_valid_book_on_shipped_scenarios(self):
        for scenario_id, data in load_scenarios().items():
            for seed in range(5):
                match = all_bots_match(data, seed).advance(data['ticks'])
                for bot_id, book in match.books.items():
                    with self.subTest(scenario=scenario_id, seed=seed, bot=bot_id):
                        self.assertGreaterEqual(book.cash, 0)
                        self.assertTrue(all(qty >= 0 for qty in book.shares.values()))


class PersonalityTests(unittest.TestCase):
    def test_hodl_hannah_buys_on_day_one_and_never_sells(self):
        data = scenario(ticks=40, regimes=UPTREND, history=30, bots=['hodl-hannah'])

        match = engine.Match(data, 2, [engine.Participant('hodl-hannah', 'H', load_bots()['hodl-hannah'])]).advance(39)

        self.assertEqual(trades(match, 'hodl-hannah'), [(0, 'LEAF', 'buy'), (0, 'ROCK', 'buy')])

    def test_scalper_sells_the_tick_after_a_green_close(self):
        match = flat_match(scenario(bots=['scalper-sam-rookie']))
        set_bar(match, 'LEAF', 1, '50', '51', '50', '51')
        for t in range(2, 20):
            set_bar(match, 'LEAF', t, '51', '51', '51', '51')

        match.advance(3)

        self.assertEqual(trades(match, 'scalper-sam-rookie'), [(1, 'LEAF', 'buy'), (2, 'LEAF', 'sell')])

    def test_panic_pete_chases_a_green_streak_then_sells_on_a_negative_headline(self):
        match = flat_match(scenario(bots=['panic-pete-elite'], news=[headline(5, 'negative', 'macro', 'ROCK')]))
        for t, price in ((1, '51'), (2, '52'), (3, '53')):
            set_bar(match, 'LEAF', t, price, price, price, price)
        for t in range(4, 20):
            set_bar(match, 'LEAF', t, '53', '53', '53', '53')

        match.advance(6)

        self.assertEqual(trades(match, 'panic-pete-elite'), [(3, 'LEAF', 'buy'), (5, 'LEAF', 'sell')])

    def test_newsy_nina_pro_ignores_rumors_while_rookie_reacts_after_her_delay(self):
        match = flat_match(scenario(bots=['newsy-nina-pro', 'newsy-nina-rookie'], news=[headline(3, 'positive', 'rumor')]))

        match.advance(8)

        self.assertEqual(trades(match, 'newsy-nina-pro'), [])
        self.assertEqual(trades(match, 'newsy-nina-rookie'), [(5, 'LEAF', 'buy')])

    def test_newsy_nina_elite_fades_a_large_hype_gap_down(self):
        match = flat_match(scenario(bots=['newsy-nina-elite'], news=[headline(3, 'negative', 'hype')]))
        set_bar(match, 'LEAF', 3, '45', '46', '44', '45')

        match.advance(4)

        self.assertEqual(trades(match, 'newsy-nina-elite'), [(3, 'LEAF', 'buy')])

    def test_steady_stella_risks_about_one_percent_on_entry(self):
        data = scenario(ticks=40, regimes=UPTREND, history=30, bots=['steady-stella-elite'])
        match = engine.Match(data, 4, [engine.Participant('steady-stella-elite', 'S', load_bots()['steady-stella-elite'])])

        match.advance(39)

        first = match.books['steady-stella-elite'].fills[0]
        stop = min(bar.l for bar in match.bars[first.symbol][first.t + match.offset - 9:first.t + match.offset + 1])
        risk = first.qty * (match.bar(first.symbol, first.t).c - stop)
        self.assertLessEqual(risk, Decimal('101'))


if __name__ == '__main__':
    unittest.main()
