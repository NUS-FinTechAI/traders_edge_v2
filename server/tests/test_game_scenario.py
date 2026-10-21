import copy
import unittest

from app.game.scenario import ScenarioError, load_bots, load_scenarios, validate_bots, validate_scenario
from game_fixtures import scenario

ROSTER = {'hodl-hannah-rookie', 'hodl-hannah', 'hodl-hannah-elite', 'momentum-max-rookie', 'momentum-max-pro', 'momentum-max-elite',
          'value-vera-rookie', 'value-vera-pro', 'value-vera-elite', 'panic-pete-rookie', 'panic-pete-pro', 'panic-pete-elite',
          'scalper-sam-rookie', 'scalper-sam-pro', 'breakout-bea-rookie', 'breakout-bea-pro', 'breakout-bea-elite',
          'newsy-nina-rookie', 'newsy-nina-pro', 'newsy-nina-elite', 'steady-stella-rookie', 'steady-stella-pro',
          'steady-stella-elite', 'ironhand-iris'}


def news(**overrides):
    item = {'id': 'n1', 'tick': 5, 'headline': 'Headline', 'body': 'Body', 'tone': 'positive', 'symbols': ['LEAF'],
            'effects': [{'symbol': 'LEAF', 'move': 0.05, 'ticks': 3, 'gap': False}]}
    item.update(overrides)
    return item


def mission(kind, params, mid='m2'):
    return {'basic': [{'id': 'm1', 'type': 'trades_min', 'params': {'n': 1}, 'text': 'Trade'},
                      {'id': mid, 'type': kind, 'params': params, 'text': 'Mission'}], 'bonus': []}


class ContentTests(unittest.TestCase):
    def test_shipped_scenarios_and_bots_validate(self):
        scenarios = load_scenarios()

        self.assertLessEqual({'practice-trend-rider', 'practice-earnings-gap', 'practice-choppy-range'}, set(scenarios))
        self.assertTrue(all(s.get('balance') != 'boss' for key, s in scenarios.items() if key.startswith('practice-')))

    def test_bot_catalog_matches_the_canonical_roster(self):
        bots = load_bots()

        self.assertEqual(set(bots), ROSTER)
        self.assertTrue(all(bot['tier'] in ('rookie', 'pro', 'elite') for bot in bots.values()))


class ScenarioValidationTests(unittest.TestCase):
    def assertRejected(self, data, message):
        with self.assertRaisesRegex(ScenarioError, message):
            validate_scenario(data, load_bots())

    def test_valid_fixture_passes(self):
        validate_scenario(scenario(news=[news(kind='rumor')], balance='lesson'), load_bots())

    def test_unknown_top_level_field_is_rejected(self):
        self.assertRejected(scenario(colour='green'), 'unknown field colour')

    def test_ticker_must_be_three_to_five_capitals(self):
        data = scenario()
        data['assets'][0]['symbol'] = 'leaf'

        self.assertRejected(data, r'assets\[0\]\.symbol: must be 3-5 capital letters')

    def test_duplicate_tickers_are_rejected(self):
        data = scenario()
        data['assets'][1]['symbol'] = 'LEAF'

        self.assertRejected(data, "repeats 'LEAF'")

    def test_ticks_outside_fifteen_to_one_fifty_are_rejected(self):
        self.assertRejected(scenario(ticks=14, regimes=[{'from': 0, 'to': 14, 'market_drift': 0, 'vol_mult': 1}]), 'ticks')

    def test_regimes_must_cover_every_tick(self):
        self.assertRejected(scenario(regimes=[{'from': 0, 'to': 10, 'market_drift': 0, 'vol_mult': 1}]), 'must cover ticks 0 to 20')

    def test_news_tick_must_be_inside_the_match(self):
        self.assertRejected(scenario(news=[news(tick=20)]), r'news\[0\]\.tick')

    def test_news_effect_must_reference_a_known_symbol(self):
        self.assertRejected(scenario(news=[news(effects=[{'symbol': 'NOPE', 'move': 0.1, 'ticks': 2, 'gap': False}])]),
                            "'NOPE' is not an asset")

    def test_news_effect_must_end_before_the_match_ends(self):
        self.assertRejected(scenario(news=[news(tick=18, effects=[{'symbol': 'LEAF', 'move': 0.1, 'ticks': 5, 'gap': False}])]),
                            r'effects\[0\]\.ticks')

    def test_news_kind_must_be_known(self):
        self.assertRejected(scenario(news=[news(kind='gossip')]), r'news\[0\]\.kind')

    def test_duplicate_news_ids_are_rejected(self):
        self.assertRejected(scenario(news=[news(), news(tick=7)]), "repeats 'n1'")

    def test_unknown_bot_is_rejected(self):
        self.assertRejected(scenario(bots=['nobody']), "'nobody' is not in bots.json")

    def test_boss_needs_a_bot(self):
        self.assertRejected(scenario(balance='boss'), 'needs at least one bot')

    def test_unknown_mission_type_is_rejected(self):
        self.assertRejected(scenario(missions=mission('get_rich', {})), "'get_rich' is not a known mission type")

    def test_mission_missing_parameter_is_rejected(self):
        self.assertRejected(scenario(missions=mission('held_between', {'symbol': 'LEAF', 'from': 2})), 'is missing to')

    def test_mission_unknown_parameter_is_rejected(self):
        self.assertRejected(scenario(missions=mission('end_in_cash', {'n': 1})), 'unknown field n')

    def test_mission_symbol_must_exist(self):
        self.assertRejected(scenario(missions=mission('exited_by', {'symbol': 'NOPE', 'tick': 3})), "'NOPE' is not an asset")

    def test_mission_tick_must_be_inside_the_match(self):
        self.assertRejected(scenario(missions=mission('max_position_before', {'tick': 25, 'pct': 30})), 'tick')

    def test_mission_order_type_must_be_enabled(self):
        data = scenario(allow={'limit': False, 'stop': True}, missions=mission('use_order', {'type': 'limit', 'n': 1}))

        self.assertRejected(data, 'limit orders are disabled')

    def test_mission_beat_bot_must_name_a_scenario_bot(self):
        self.assertRejected(scenario(missions=mission('beat_bot', {'bot_id': 'hodl-hannah'})), "not one of this scenario's bots")

    def test_duplicate_mission_ids_are_rejected(self):
        self.assertRejected(scenario(missions=mission('end_in_cash', {}, mid='m1')), "repeats 'm1'")


class BotValidationTests(unittest.TestCase):
    def roster(self, **changes):
        bots = copy.deepcopy(list(load_bots().values()))
        bots[0].update(changes)
        return bots

    def test_unknown_strategy_is_rejected(self):
        with self.assertRaisesRegex(ScenarioError, 'strategy'):
            validate_bots(self.roster(strategy='martingale'))

    def test_missing_strategy_parameter_is_rejected(self):
        with self.assertRaisesRegex(ScenarioError, 'is missing at'):
            validate_bots(self.roster(params={'weight': 0.5}))

    def test_unknown_tier_is_rejected(self):
        with self.assertRaisesRegex(ScenarioError, 'tier'):
            validate_bots(self.roster(tier='legend'))

    def test_rsi_entry_needs_rsi_parameters(self):
        params = {'entry': 'rsi', 'exit_sma': 10, 'take_profit': 0.05, 'trend_sma': 0, 'trail': 0, 'weight': 0.5}

        with self.assertRaisesRegex(ScenarioError, 'rsi entry needs rsi_below, rsi_window'):
            validate_bots(self.roster(strategy='mean_reversion', params=params))

    def test_duplicate_bot_ids_are_rejected(self):
        bots = self.roster()
        bots[1]['id'] = bots[0]['id']

        with self.assertRaisesRegex(ScenarioError, 'repeats'):
            validate_bots(bots)


if __name__ == '__main__':
    unittest.main()
