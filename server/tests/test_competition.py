from copy import deepcopy
import unittest

from app.challenges import core as ai
from app.competition import portfolio_result, rank_entries
from app.multiplayer import core as multiplayer
from app.simulation import engine


class PortfolioResultTests(unittest.TestCase):
    def test_remaining_holdings_use_current_mid_and_paid_fees_are_not_subtracted_twice(self):
        state = engine.new_session(12, 'sideways', ticks=30)
        state.update(tick=29, cash='9900.00', fees='2.00')
        state['positions'] = {'NORTH': {'quantity': 3}}
        state['prices']['NORTH'][29] = '40.25'

        result = portfolio_result(state)

        self.assertEqual(result, {'profit': '20.75', 'final_value': '10020.75', 'fees': '2.00'})

    def test_profit_uses_saved_starting_value_instead_of_foundation_default(self):
        state = engine.new_session(12, 'falling', ticks=30)
        state.update(initial_cash='5000.00', cash='4998.75')

        result = portfolio_result(state)

        self.assertEqual(result, {'profit': '-1.25', 'final_value': '4998.75', 'fees': '0.00'})


class CompetitionRankingTests(unittest.TestCase):
    def test_profit_is_sorted_numerically_including_losses(self):
        entries = [{'id': identifier, 'profit': profit} for identifier, profit in
                   [('a', '-2.00'), ('b', '9.00'), ('c', '100.00'), ('d', '-10.00')]]

        result = rank_entries(entries, identifier_key='id')

        self.assertEqual([(entry['id'], entry['rank']) for entry in result],
                         [('c', 1), ('b', 2), ('a', 3), ('d', 4)])

    def test_equal_profits_share_rank_with_identifier_order_and_rank_gaps(self):
        entries = [{'id': identifier, 'profit': profit} for identifier, profit in
                   [('z', '10.00'), ('b', '0.00'), ('a', '10.0')]]

        result = rank_entries(entries, identifier_key='id')

        self.assertEqual([(entry['id'], entry['rank']) for entry in result],
                         [('a', 1), ('z', 1), ('b', 3)])

    def test_forfeits_rank_below_all_finishers_and_share_ranks_within_their_group(self):
        entries = [{'id': identifier, 'profit': profit, 'forfeit': forfeit}
                   for identifier, profit, forfeit in [('z', '100.00', True), ('b', '-5.00', False),
                       ('a', '-5.00', False), ('c', '100.00', True), ('d', '0.00', True)]]

        result = rank_entries(entries, identifier_key='id', forfeit_key='forfeit')

        self.assertEqual([(entry['id'], entry['rank']) for entry in result],
                         [('a', 1), ('b', 1), ('c', 3), ('z', 3), ('d', 5)])

    def test_ranking_leaves_input_order_and_entries_unchanged(self):
        entries = [{'id': 'b', 'profit': '0.00'}, {'id': 'a', 'profit': '1.00'}]
        before = deepcopy(entries)

        result = rank_entries(entries, identifier_key='id')
        result[0]['rank'] = 99

        self.assertEqual(entries, before)

    def test_no_participants_produces_an_empty_leaderboard(self):
        self.assertEqual(rank_entries([], identifier_key='id'), [])


class CompetitionModeTests(unittest.TestCase):
    def test_ai_and_multiplayer_preserve_their_result_fields_for_the_same_portfolios(self):
        snapshot = ai.new_snapshot(12, 'sideways', 2)
        states = [snapshot['human'], *[agent['state'] for agent in snapshot['agents']]]
        for state, cash in zip(states, ['9995.00', '10010.00', '10010.00']):
            state.update(tick=29, cash=cash, fees='2.00', orders=[])
        human_snapshot = {'participants': {identifier: {
            'name': name, 'state': deepcopy(state), 'forfeit': False}
            for identifier, name, state in zip(['human', 'ai-1', 'ai-2'],
                ['Player', 'Opponent 1', 'Opponent 2'], states)}}

        ai_result = ai.complete(snapshot, 'I kept the written plan and compared final outcomes after costs.')
        human_result = multiplayer.result(human_snapshot)

        expected = [
            {'participant_id': 'ai-1', 'display_name': 'Opponent 1', 'profit': '10.00',
             'final_value': '10010.00', 'fees': '2.00', 'rank': 1},
            {'participant_id': 'ai-2', 'display_name': 'Opponent 2', 'profit': '10.00',
             'final_value': '10010.00', 'fees': '2.00', 'rank': 1},
            {'participant_id': 'human', 'display_name': 'Player', 'profit': '-5.00',
             'final_value': '9995.00', 'fees': '2.00', 'rank': 3},
        ]
        self.assertEqual(ai_result, {'win': False, 'profit': '-5.00', 'leaderboard': expected,
                                    'final_tick': 29, 'policy_version': 'shared-ai-1'})
        self.assertEqual(human_result, {'leaderboard': [
            {'user_id': entry['participant_id'], 'display_name': entry['display_name'],
             'forfeit': False, 'profit': entry['profit'], 'final_value': entry['final_value'],
             'fees': entry['fees'], 'rank': entry['rank'], 'win': False} for entry in expected],
            'final_tick': 29, 'policy_version': 'shared-multiplayer-1'})

    def test_all_multiplayer_forfeits_produce_no_winner(self):
        snapshot = {'participants': {'a': multiplayer.waiting_participant('A', 1),
                                     'b': multiplayer.waiting_participant('B', 1)}}
        multiplayer.start(snapshot, 12, 'sideways')
        for participant in snapshot['participants'].values():
            participant['forfeit'] = True
        snapshot['participants']['b']['state']['cash'] = '10020.00'

        result = multiplayer.result(snapshot)

        self.assertEqual([(entry['user_id'], entry['rank'], entry['win'])
                          for entry in result['leaderboard']], [('b', 1, False), ('a', 2, False)])

    def test_unstarted_departed_multiplayer_participants_do_not_appear_in_results(self):
        snapshot = {'participants': {'a': multiplayer.waiting_participant('A', 1),
                                     'b': multiplayer.waiting_participant('B', 1)}}
        snapshot['participants']['b']['departed'] = True
        multiplayer.start(snapshot, 12, 'sideways')

        result = multiplayer.result(snapshot)

        self.assertEqual([entry['user_id'] for entry in result['leaderboard']], ['a'])
        self.assertTrue(result['leaderboard'][0]['win'])
