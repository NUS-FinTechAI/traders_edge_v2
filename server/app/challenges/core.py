from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal

from app.competition import portfolio_result, rank_entries
from app.challenges import profiles
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


def allocation_decision(state, strategy, policy):
    if policy.get('version') != profiles.OPPONENT_VERSION:
        raise engine.SimulationError('Unsupported pinned opponent policy')
    tick = state['tick']
    if tick % policy['interval'] or len(state['orders']) >= MAX_ORDERS:
        return
    value = engine.equity(state)
    target_weight = Decimal(policy['target_weight'])
    for symbol in engine.SYMBOLS:
        if any(engine.pending(order) and order['symbol'] == symbol for order in state['orders']):
            continue
        observed = [engine.amount(price) for price in state['prices'][symbol][:tick + 1]]
        current = observed[-1]
        earlier = observed[max(0, tick - policy['lookback'])]
        change = current / earlier - 1
        target = target_weight
        if strategy == 'trend':
            if tick < policy['lookback']:
                continue
            target = target_weight if change > Decimal(policy['signal_threshold']) else Decimal(0)
        elif strategy == 'defensive':
            if tick < policy['lookback']:
                continue
            drawdown = 1 - current / max(observed)
            target = target_weight if (change > Decimal(policy['signal_threshold'])
                and drawdown < Decimal(policy['drawdown_limit'])) else Decimal(0)
        elif strategy != 'allocation':
            raise engine.SimulationError('Unsupported allocation strategy')
        held = state['positions'].get(symbol, {}).get('quantity', 0)
        quote = engine.quote(state, symbol)
        # Match the engine's market-order reservation buffer, including fees.
        unit_budget = engine.amount(quote['ask']) * Decimal('1.05') * (1 + engine.FEE_RATE)
        desired = int(value * target / unit_budget)
        difference = desired - held
        # A buffer avoids churning near the target; fills still use the common engine.
        if not difference or (held and target and abs(difference) * current < value * Decimal('0.03')):
            continue
        side = 'buy' if difference > 0 else 'sell'
        quantity = min(1000, abs(difference))
        plan = {
            'reason': f'Apply the pinned {strategy} allocation rule to observed prices only.',
            'risk': 'The next observation can reverse, gap or provide insufficient liquidity.',
            'exit': 'Reassess the observed signal and allocation at the next policy checkpoint.',
            'size_reason': f'Target at most {target_weight * 100}% per asset with cash retained and no leverage.',
            'max_loss': engine.money(value * Decimal('0.02')),
        }
        try:
            engine.submit_order(state, {'symbol': symbol, 'side': side, 'type': 'market',
                                        'quantity': quantity, 'plan': plan})
        except engine.SimulationError:
            continue
        if len(state['orders']) >= MAX_ORDERS:
            return


def ai_decision(state, strategy, policy=None):
    """Decide using only the current and already observed market values."""
    if policy is not None:
        return allocation_decision(state, strategy, policy)
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
    opponent_policy = deepcopy((policy or {}).get('opponent_profile'))
    if opponent_policy is not None and (opponent_policy.get('version') != profiles.OPPONENT_VERSION
            or len(opponent_policy.get('strategies', [])) < opponents):
        raise engine.SimulationError('Unsupported opponent profile')
    agents = []
    for index in range(opponents):
        strategy = opponent_policy['strategies'][index] if opponent_policy else STRATEGIES[index]
        state = deepcopy(initial)
        ai_decision(state, strategy, opponent_policy)
        agent = {'id': f'ai-{index + 1}', 'strategy': strategy, 'state': state}
        if opponent_policy is not None:
            agent['strategy_policy'] = deepcopy(opponent_policy)
        agents.append(agent)
    public_policy = deepcopy(POLICY)
    for key in ('objective', 'difficulty', 'provenance', 'profile_version', 'context',
                'review_prompts', 'recorded_evidence', 'assessment_basis'):
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
                ai_decision(agent['state'], agent['strategy'], agent.get('strategy_policy'))


def leaderboard(snapshot):
    participants = [('human', 'Player', snapshot['human'])]
    participants.extend((agent['id'], f"Opponent {index + 1}", agent['state'])
                        for index, agent in enumerate(snapshot['agents']))
    entries = [{'participant_id': identifier, 'display_name': name,
                **portfolio_result(state)}
               for identifier, name, state in participants]
    return rank_entries(entries, identifier_key='participant_id')


def complete(snapshot, reflection):
    if snapshot['human']['tick'] != TICKS - 1:
        raise engine.SimulationError('Reach the common final observation before completing the challenge')
    engine.finish(snapshot['human'], reflection)
    for agent in snapshot['agents']:
        engine.finish(agent['state'], 'The pinned opponent strategy completed at the common final observation.')
    entries = leaderboard(snapshot)
    human = next(entry for entry in entries if entry['participant_id'] == 'human')
    win = all(Decimal(human['profit']) > Decimal(entry['profit']) for entry in entries if entry['participant_id'] != 'human')
    result = {'win': win, 'profit': human['profit'], 'leaderboard': entries,
              'final_tick': snapshot['human']['tick'], 'policy_version': VERSION}
    if snapshot['policy'].get('profile_version'):
        observed = engine.public_view(snapshot['human'])
        result['decision_review'] = {
            'basis': 'Observed actions and accounting only; no automatic judgment of plan quality or learning.',
            'cash_percent': engine.money(engine.amount(observed['cash']) / engine.amount(observed['equity']) * 100),
            'largest_position_percent': engine.money(max((engine.amount(position['weight_percent'])
                for position in observed['positions']), default=Decimal(0))),
            'max_drawdown_percent': observed['max_drawdown_percent'], 'fees': observed['fees'],
            'submitted_orders': len(observed['orders']),
            'filled_orders': len({fill['order_id'] for fill in observed['fills']}),
            'review_prompts': deepcopy(snapshot['policy']['review_prompts']),
        }
    return result


def record_event(snapshot, operation, payload, before):
    after = engine.public_view(snapshot['human'])
    snapshot['events'].append({'sequence': len(snapshot['events']) + 1,
                              'recorded_at': datetime.now(timezone.utc).isoformat(),
                              'operation': operation, 'payload': deepcopy(payload),
                              'before': before, 'after': after})
