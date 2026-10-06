from copy import deepcopy
from decimal import Decimal, ROUND_HALF_UP

from app.db import now
from app.simulation import engine

VERSION = 'shared-multiplayer-1'
TICKS = 30
MAX_PLAYERS = 8
POLICY = {
    'version': VERSION, 'ticks': TICKS, 'starting_value': '10000.00',
    'profit': 'final_cash_plus_holdings_at_mid_minus_starting_value_net_of_paid_fees',
    'ties': 'joint_rank_and_draw_for_rating',
    'liquidity': 'equal_independent_capacity_per_participant_at_each_observation',
    'advance': 'one_observation_when_every_nonforfeit_participant_is_ready',
    'disconnect': 'resume_without_deadline_or_explicitly_abandon_and_forfeit',
    'forfeit': 'below_every_finisher_regardless_of_profit_all_forfeit_no_contest',
    'rating': 'public_pairs_only_initial_1000_elo_k32_half_up_opposite_integer_deltas',
    'provenance': 'Deterministic synthetic simulation engine version 1',
}


def waiting_participant(name, attempt_number):
    return {'name': name, 'attempt_number': attempt_number, 'state': None, 'ready': False,
            'forfeit': False, 'departed': False, 'completed': False, 'awards': None, 'events': []}


def start(snapshot, seed, kind):
    initial = engine.new_session(seed, kind, ticks=TICKS)
    for participant in snapshot['participants'].values():
        if not participant['departed']:
            participant['state'] = deepcopy(initial)
    snapshot['engine_version'] = engine.VERSION


def event(participant, operation, payload, before):
    participant['events'].append({'sequence': len(participant['events']) + 1,
        'recorded_at': now().isoformat(), 'attempt_number': participant['attempt_number'],
        'operation': operation, 'payload': deepcopy(payload), 'before': before,
        'after': engine.public_view(participant['state']) if participant['state'] else None})


def advance_if_ready(snapshot):
    live = [p for p in snapshot['participants'].values() if p['state'] and not p['forfeit']]
    if not live or not all(p['ready'] for p in live):
        return False
    for participant in snapshot['participants'].values():
        if participant['state']:
            before = engine.public_view(participant['state'])
            engine.advance(participant['state'], 1)
            participant['ready'] = False
            event(participant, 'observation', {}, before)
    return True


def result(snapshot):
    participants = [(identifier, p) for identifier, p in snapshot['participants'].items() if p['state']]
    entries = [{'user_id': identifier, 'display_name': participant['name'],
        'forfeit': participant['forfeit'],
        'profit': engine.money(engine.equity(participant['state']) - engine.amount(participant['state']['initial_cash'])),
        'final_value': engine.money(engine.equity(participant['state'])), 'fees': participant['state']['fees']}
        for identifier, participant in participants]
    entries.sort(key=lambda entry: (entry['forfeit'], -Decimal(entry['profit']), entry['user_id']))
    for entry in entries:
        entry['rank'] = 1 + sum((not other['forfeit'] and entry['forfeit'])
            or (other['forfeit'] == entry['forfeit'] and Decimal(other['profit']) > Decimal(entry['profit']))
            for other in entries)
    # Joint first place is a draw, not two wins.
    winners = [entry for entry in entries if not entry['forfeit'] and entry['rank'] == 1]
    for entry in entries:
        entry['win'] = len(winners) == 1 and entry in winners
    return {'leaderboard': entries, 'final_tick': TICKS - 1, 'policy_version': VERSION}


def elo_delta(first_rating, second_rating, score):
    expected = Decimal(1) / (Decimal(1) + Decimal(10) ** (Decimal(second_rating - first_rating) / 400))
    return int((Decimal(32) * (Decimal(str(score)) - expected)).quantize(Decimal(1), rounding=ROUND_HALF_UP))
