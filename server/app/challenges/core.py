from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal

from app.simulation import engine

VERSION = 'shared-ai-1'
TICKS = 30
MAX_ORDERS = 50
STRATEGIES = ('basket', 'momentum', 'cautious')
POLICY = {
    'version': VERSION, 'ticks': TICKS, 'starting_value': '10000.00',
    'profit': 'final_cash_plus_holdings_at_mid_minus_starting_value_net_of_paid_fees',
    'ties': 'joint_rank_human_must_strictly_outperform_every_opponent_to_win',
    'liquidity': 'equal_independent_capacity_per_participant_at_each_observation',
    'early_exit': 'abandoned_without_result_or_reward',
    'resume': 'saved_attempt_without_wall_clock_deadline',
    'objective': 'Apply a written execution plan and compare net portfolio outcomes',
    'provenance': 'Deterministic synthetic prices from simulation engine version 1',
    'difficulty': 'foundation',
}


def ai_decision(state, strategy):
    """Decide using only the current and already observed market values."""
    tick = state['tick']
    if tick not in (0, 5, 10, 15, 20):
        return
    for symbol in engine.SYMBOLS:
        held = state['positions'].get(symbol, {}).get('quantity', 0)
        if any(engine.pending(order) and order['symbol'] == symbol for order in state['orders']):
            continue
        current = engine.amount(state['prices'][symbol][tick])
        earlier = engine.amount(state['prices'][symbol][max(0, tick - 5)])
        side, quantity = 'buy', 4
        if strategy == 'basket':
            if tick != 0:
                continue
            quantity = 8
        elif strategy == 'momentum':
            if tick == 0 or current == earlier:
                continue
            if current < earlier:
                if not held:
                    continue
                side, quantity = 'sell', held
        elif strategy == 'cautious':
            if tick == 0 or current <= earlier:
                continue
            quantity = 2
        else:
            raise engine.SimulationError('Unsupported opponent strategy')
        plan = {
            'reason': f'Apply the pinned {strategy} rule using observed prices only.',
            'risk': 'Future prices may reverse and transaction costs reduce returns.',
            'exit': 'Reconsider at the next five-observation strategy checkpoint.',
            'size_reason': 'Use a small position within the common concentration cap.',
            'max_loss': '100.00',
        }
        try:
            engine.submit_order(state, {'symbol': symbol, 'side': side, 'type': 'market',
                                        'quantity': quantity, 'plan': plan})
        except engine.SimulationError:
            # The same cash, holdings and concentration restrictions apply to opponents.
            continue


def new_snapshot(seed, kind, opponents=1, policy=None):
    if isinstance(opponents, bool) or not isinstance(opponents, int) or not 1 <= opponents <= 3:
        raise engine.SimulationError('Choose one to three opponents')
    initial = engine.new_session(seed, kind, ticks=TICKS)
    agents = []
    for index in range(opponents):
        strategy = STRATEGIES[index]
        state = deepcopy(initial)
        ai_decision(state, strategy)
        agents.append({'id': f'ai-{index + 1}', 'strategy': strategy, 'state': state})
    public_policy = deepcopy(POLICY)
    for key in ('objective', 'difficulty', 'provenance'):
        if key in (policy or {}):
            public_policy[key] = deepcopy(policy[key])
    return {'version': VERSION, 'engine_version': engine.VERSION, 'policy': public_policy,
            'human': initial, 'agents': agents, 'events': []}


def advance(snapshot, steps):
    if isinstance(steps, bool) or not isinstance(steps, int) or not 1 <= steps <= 5:
        raise engine.SimulationError('Advance one to five observations at a time')
    human = snapshot['human']
    remaining = TICKS - 1 - human['tick']
    if remaining <= 0:
        raise engine.SimulationError('The common final observation has already been reached')
    for _ in range(min(steps, remaining)):
        engine.advance(human, 1)
        for agent in snapshot['agents']:
            engine.advance(agent['state'], 1)
            if human['tick'] < TICKS - 1:
                ai_decision(agent['state'], agent['strategy'])


def leaderboard(snapshot):
    participants = [('human', 'Player', snapshot['human'])]
    participants.extend((agent['id'], f"Opponent {index + 1}", agent['state'])
                        for index, agent in enumerate(snapshot['agents']))
    entries = [{'participant_id': identifier, 'display_name': name,
                'profit': engine.money(engine.equity(state) - engine.amount(state['initial_cash'])),
                'final_value': engine.money(engine.equity(state)), 'fees': state['fees']}
               for identifier, name, state in participants]
    entries.sort(key=lambda entry: (-Decimal(entry['profit']), entry['participant_id']))
    for entry in entries:
        entry['rank'] = 1 + sum(Decimal(other['profit']) > Decimal(entry['profit']) for other in entries)
    return entries


def complete(snapshot, reflection):
    if snapshot['human']['tick'] != TICKS - 1:
        raise engine.SimulationError('Reach the common final observation before completing the challenge')
    engine.finish(snapshot['human'], reflection)
    for agent in snapshot['agents']:
        engine.finish(agent['state'], 'The pinned opponent strategy completed at the common final observation.')
    entries = leaderboard(snapshot)
    human = next(entry for entry in entries if entry['participant_id'] == 'human')
    win = all(Decimal(human['profit']) > Decimal(entry['profit']) for entry in entries if entry['participant_id'] != 'human')
    return {'win': win, 'profit': human['profit'], 'leaderboard': entries,
            'final_tick': snapshot['human']['tick'], 'policy_version': VERSION}


def record_event(snapshot, operation, payload, before):
    after = engine.public_view(snapshot['human'])
    snapshot['events'].append({'sequence': len(snapshot['events']) + 1,
                              'recorded_at': datetime.now(timezone.utc).isoformat(),
                              'operation': operation, 'payload': deepcopy(payload),
                              'before': before, 'after': after})
