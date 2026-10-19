from copy import deepcopy
from datetime import date
import json
import unittest
from unittest.mock import patch

from app.challenges import core, profiles
from app.challenges.models import ChallengeAttempt
from app.simulation import engine
import test_learning as fixtures
from test_simulation import order


def finish(snapshot):
    while snapshot['human']['tick'] < core.TICKS - 1:
        core.advance(snapshot, 5)
    return core.complete(snapshot, 'Compare the observed decisions, costs and final allocation with the original plan.')


class ChallengeProfileTests(unittest.TestCase):
    def test_each_later_chapter_increases_the_opponents_actual_opening_allocation(self):
        allocations = []
        for chapter in range(1, 11):
            snapshot = core.new_snapshot(1, 'rising', policy=profiles.chapter_policy(chapter))
            opponent = snapshot['agents'][0]['state']
            allocations.append(sum(order['quantity'] * engine.amount(engine.quote(opponent, order['symbol'])['mid'])
                                   for order in opponent['orders']))

        self.assertTrue(all(later > earlier for earlier, later in zip(allocations, allocations[1:])))

    def test_chapter_tiers_change_actual_allocation_and_checkpoint_frequency(self):
        early = core.new_snapshot(1, 'rising', 1, profiles.chapter_policy(2))
        late = core.new_snapshot(1, 'rising', 1, profiles.chapter_policy(10))

        for snapshot in (early, late):
            core.advance(snapshot, 5)

        self.assertGreater(engine.amount(early['agents'][0]['state']['cash']),
                           engine.amount(late['agents'][0]['state']['cash']))
        self.assertGreater(early['agents'][0]['strategy_policy']['interval'],
                           late['agents'][0]['strategy_policy']['interval'])
        self.assertEqual(early['human']['prices'], late['human']['prices'])

    def test_profiled_opponents_ignore_future_prices_and_liquidity(self):
        policy = profiles.opponent_profile(3, ('allocation', 'trend', 'defensive'))
        for strategy in policy['strategies']:
            with self.subTest(strategy=strategy):
                original = engine.new_session(2, 'volatile', ticks=30)
                original['tick'] = 6
                changed = deepcopy(original)
                for symbol in engine.SYMBOLS:
                    changed['prices'][symbol][7:] = ['999.00'] * 23
                    changed['liquidity'][symbol][7:] = [1000] * 23

                core.ai_decision(original, strategy, policy)
                core.ai_decision(changed, strategy, policy)

                self.assertEqual(original['orders'], changed['orders'])

    def test_defensive_opponent_rejects_positive_momentum_after_a_large_observed_drawdown(self):
        policy = profiles.opponent_profile(3, ('trend', 'defensive'))
        trend = engine.new_session(2, 'volatile', ticks=30)
        trend['tick'] = 4
        for symbol in engine.SYMBOLS:
            trend['prices'][symbol][:5] = ['100.00', '120.00', '110.00', '109.00', '110.00']
        defensive = deepcopy(trend)

        core.ai_decision(trend, 'trend', policy)
        core.ai_decision(defensive, 'defensive', policy)

        self.assertTrue(trend['orders'])
        self.assertEqual(defensive['orders'], [])

    def test_stronger_allocation_opponent_can_beat_the_fixed_opening_basket(self):
        snapshot = core.new_snapshot(2, 'rising', 3, profiles.chapter_policy(10))
        for symbol in engine.SYMBOLS:
            quote = engine.quote(snapshot['human'], symbol)
            quantity = min(30, int(2400 / engine.amount(quote['ask'])))
            engine.submit_order(snapshot['human'], order(symbol=symbol, quantity=quantity))

        result = finish(snapshot)

        self.assertFalse(result['win'])
        self.assertEqual(result['leaderboard'][0]['participant_id'], 'ai-1')
        self.assertGreater(engine.amount(result['profit']), 0)

    def test_json_restart_uses_saved_opponent_parameters_after_profile_defaults_change(self):
        original = core.new_snapshot(8, 'volatile', 3, profiles.chapter_policy(10))
        core.advance(original, 5)
        resumed = json.loads(json.dumps(original))
        different_defaults = tuple({**tier, 'target_weight': '0.01', 'interval': 20} for tier in profiles.TIERS)

        finish(original)
        with patch.object(profiles, 'TIERS', different_defaults):
            finish(resumed)

        self.assertEqual(original, resumed)

    def test_legacy_snapshot_without_strategy_policy_retains_original_result(self):
        snapshot = core.new_snapshot(12, 'volatile', 3)
        saved = json.loads(json.dumps(snapshot))

        result = finish(saved)

        self.assertTrue(all('strategy_policy' not in agent for agent in saved['agents']))
        self.assertEqual({entry['participant_id']: entry['profit'] for entry in result['leaderboard']},
                         {'human': '0.00', 'ai-1': '-330.46', 'ai-2': '-40.68', 'ai-3': '-88.10'})
        self.assertNotIn('decision_review', result)

    def test_daily_rotation_changes_pinned_strategy_and_allocation_rules(self):
        policies = [profiles.daily_policy(date(2026, 10, day)) for day in (19, 20, 21)]

        snapshots = [core.new_snapshot(2, 'rising', policy=policy) for policy in policies]
        for snapshot in snapshots:
            core.advance(snapshot, 5)

        self.assertEqual({snapshot['agents'][0]['strategy'] for snapshot in snapshots},
                         {'allocation', 'trend', 'defensive'})
        self.assertEqual(len({json.dumps(snapshot['agents'][0]['state']['orders'], sort_keys=True)
                              for snapshot in snapshots}), 3)

    def test_profiled_participants_share_market_and_friction_without_leaking_parameters(self):
        snapshot = core.new_snapshot(9, 'volatile', 3, profiles.chapter_policy(8))

        for agent in snapshot['agents']:
            for key in ('prices', 'liquidity', 'initial_cash'):
                self.assertEqual(agent['state'][key], snapshot['human'][key])
            self.assertEqual(engine.public_view(agent['state'])['rules'], engine.public_view(snapshot['human'])['rules'])
        for private in ('opponent_profile', 'seed', 'kind', 'prices'):
            self.assertNotIn(private, snapshot['policy'])
        self.assertEqual(snapshot['policy']['liquidity'], core.POLICY['liquidity'])
        self.assertEqual(len({profiles.chapter_policy(order)['objective'] for order in range(1, 11)}), 10)

    def test_decision_review_reports_actual_friction_and_allocation_without_a_learning_grade(self):
        snapshot = core.new_snapshot(2, 'rising', policy=profiles.chapter_policy(5))
        engine.submit_order(snapshot['human'], order(quantity=5))

        result = finish(snapshot)

        review = result['decision_review']
        self.assertEqual((review['submitted_orders'], review['filled_orders']), (1, 1))
        self.assertEqual(review['fees'], snapshot['human']['fees'])
        self.assertGreater(engine.amount(review['fees']), 0)
        self.assertGreater(engine.amount(review['largest_position_percent']), 0)
        self.assertEqual(review['review_prompts'], snapshot['policy']['review_prompts'])
        self.assertNotIn('grade', review)


class ChallengeProfileAPITests(unittest.TestCase):
    setUp = fixtures.LearningTests.setUp
    tearDown = fixtures.LearningTests.tearDown

    def test_boss_form_pins_public_context_and_private_opponents_across_players_and_replays(self):
        body = {'mode': 'chapter_entry', 'module_id': 'm8', 'idempotency_key': 'profile-first-start'}
        with patch('app.gameplay.secrets.randbits', return_value=19):
            first = self.client.post('/api/challenges', json=body)
        self.assertEqual(first.status_code, 201, first.text)
        view = first.json()
        self.assertEqual(view['policy']['profile_version'], profiles.VERSION)
        self.assertTrue(view['policy']['context'])
        self.assertTrue(view['policy']['recorded_evidence'])
        for private in ('seed', 'kind', 'strategy_policy', 'opponent_profile'):
            self.assertNotIn(private, first.text)
        self.assertEqual(self.client.post('/api/challenges', json=body).json(), view)

        self.client.cookies.clear()
        self.client.post('/api/session')
        with patch('app.gameplay.profiles.chapter_policy', return_value={'objective': 'Changed defaults'}):
            second = self.client.post('/api/challenges', json={**body, 'idempotency_key': 'profile-other-player'})

        self.assertEqual(second.status_code, 201, second.text)
        self.assertEqual(second.json()['policy'], view['policy'])
        self.assertEqual(second.json()['player']['quotes'], view['player']['quotes'])

    def test_profiled_boss_completion_saves_and_replays_the_observed_decision_review(self):
        with patch('app.gameplay.secrets.randbits', return_value=1):
            started = self.client.post('/api/challenges', json={
                'mode': 'chapter_entry', 'module_id': 'm2', 'idempotency_key': 'profile-review-start'})
        self.assertEqual(started.status_code, 201, started.text)
        identifier = started.json()['id']
        for step in range(6):
            advanced = self.client.post(f'/api/challenges/{identifier}/advance', json={
                'steps': 5, 'idempotency_key': f'profile-review-step-{step}'})
            self.assertEqual(advanced.status_code, 200, advanced.text)
        body = {'idempotency_key': 'profile-review-complete',
                'reflection': 'I retained cash and compared the observed market outcomes and execution costs.'}

        completed = self.client.post(f'/api/challenges/{identifier}/complete', json=body)

        self.assertEqual(completed.status_code, 200, completed.text)
        review = completed.json()['result']['decision_review']
        self.assertEqual((review['cash_percent'], review['largest_position_percent'], review['fees']),
                         ('100.00', '0.00', '0.00'))
        self.assertEqual(self.client.post(f'/api/challenges/{identifier}/complete', json=body).json(), completed.json())
        self.assertEqual(self.client.get(f'/api/challenges/{identifier}').json()['result']['decision_review'], review)

        async def saved_policy():
            async with self.app.state.db.sessions() as db:
                return (await db.get(ChallengeAttempt, identifier)).snapshot_json['agents'][0]['strategy_policy']
        self.assertEqual(self.client.portal.call(saved_policy)['version'], profiles.OPPONENT_VERSION)
