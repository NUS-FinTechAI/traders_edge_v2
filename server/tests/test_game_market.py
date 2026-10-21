from decimal import Decimal
import unittest

from app.game import market
from game_fixtures import scenario

NEWS = {'id': 'big-contract', 'tick': 8, 'headline': 'Leafy Greens wins a contract', 'body': 'A large order.', 'tone': 'positive',
        'symbols': ['LEAF'], 'effects': [{'symbol': 'LEAF', 'move': 0.08, 'ticks': 4, 'gap': True}]}


def calm(**overrides):
    return scenario(market={'vol': 0.0005}, regimes=[{'from': 0, 'to': 20, 'market_drift': 0.0, 'vol_mult': 0.2}], **overrides)


class MarketTests(unittest.TestCase):
    def test_same_seed_produces_identical_bars(self):
        self.assertEqual(market.generate(scenario(), 42), market.generate(scenario(), 42))

    def test_different_seeds_produce_different_paths(self):
        self.assertNotEqual(market.generate(scenario(), 1)['LEAF'], market.generate(scenario(), 2)['LEAF'])

    def test_bars_cover_history_through_the_last_tick(self):
        bars = market.generate(scenario(), 5)['LEAF']

        self.assertEqual([bar.t for bar in bars], list(range(-5, 20)))

    def test_bars_are_consistent_cents(self):
        for bar in market.generate(scenario(), 9)['LEAF']:
            with self.subTest(t=bar.t):
                self.assertLessEqual(bar.l, min(bar.o, bar.c))
                self.assertGreaterEqual(bar.h, max(bar.o, bar.c))
                self.assertEqual(bar.c, bar.c.quantize(Decimal('0.01')))
                self.assertGreater(bar.v, 0)

    def test_news_effect_moves_price_by_the_authored_total(self):
        quiet = market.generate(calm(), 11)['LEAF']
        loud = market.generate(calm(news=[NEWS]), 11)['LEAF']

        ratio = (loud[5 + 11].c / loud[5 + 7].c) / (quiet[5 + 11].c / quiet[5 + 7].c)

        self.assertAlmostEqual(float(ratio), 1.08, delta=0.01)

    def test_news_effect_is_front_loaded_and_gaps_the_open(self):
        quiet = market.generate(calm(), 11)['LEAF']
        loud = market.generate(calm(news=[NEWS]), 11)['LEAF']
        day = 5 + 8

        first_share = 0.08 * 4 / 10
        self.assertAlmostEqual(float(loud[day].o / loud[day - 1].c), 1 + first_share, delta=0.001)
        self.assertEqual(quiet[day].o, quiet[day - 1].c)
        self.assertEqual(loud[:day], quiet[:day])

    def test_news_effects_do_not_change_other_symbols(self):
        quiet = market.generate(calm(), 11)['ROCK']

        self.assertEqual(market.generate(calm(news=[NEWS]), 11)['ROCK'], quiet)


if __name__ == '__main__':
    unittest.main()
