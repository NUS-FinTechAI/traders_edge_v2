import unittest

from app.game import balance
from app.game.scenario import load_bots, load_scenarios, validate_scenario
from game_fixtures import scenario

SEEDS = range(50)
IDLE_LIMIT, RANDOM_LIMIT = 0.05, 0.10


def boss_fixture():
    """Test-only boss-like market: a steady climb against two elite opponents."""
    return validate_scenario(scenario(
        id='test-boss-climb', balance='boss', ticks=40, history=25, bots=['hodl-hannah-elite', 'momentum-max-elite'],
        regimes=[{'from': 0, 'to': 40, 'market_drift': 0.003, 'vol_mult': 1.0}],
        missions={'basic': [{'id': 'win', 'type': 'rank_max', 'params': {'rank': 1}, 'text': 'Finish first'}], 'bonus': []}), load_bots())


class BalanceTests(unittest.TestCase):
    def assertBossBalanced(self, data):
        idle = balance.simulate_policy(data, 'idle', SEEDS)
        clicker = balance.simulate_policy(data, 'random', SEEDS)

        self.assertLessEqual(idle['win_rate'], IDLE_LIMIT, data['id'])
        self.assertLessEqual(clicker['win_rate'], RANDOM_LIMIT, data['id'])

    def test_idle_and_random_players_lose_the_boss_fixture(self):
        self.assertBossBalanced(boss_fixture())

    def test_shipped_boss_scenarios_keep_idle_and_random_players_losing(self):
        for data in load_scenarios().values():
            if data.get('balance') == 'boss':
                with self.subTest(scenario=data['id']):
                    self.assertBossBalanced(data)

    def test_gauntlet_reports_every_policy(self):
        report = balance.gauntlet(boss_fixture(), range(3))

        self.assertEqual(set(report), set(balance.POLICIES))
        self.assertTrue(all(0 <= row['win_rate'] <= 1 for row in report.values()))

    def test_idle_policy_never_trades(self):
        self.assertEqual(balance.play(boss_fixture(), 'idle', 1)[1], 0)

    def test_simulation_is_deterministic(self):
        self.assertEqual(balance.simulate_policy(boss_fixture(), 'random', range(5)),
                         balance.simulate_policy(boss_fixture(), 'random', range(5)))


if __name__ == '__main__':
    unittest.main()
