"""Monte-Carlo balance harness: synthetic players against a scenario's bots.

Content authors call `gauntlet(scenario, range(50))` to tune a scenario; boss scenarios must keep
idle and random players losing.
"""

import math
import random
from decimal import Decimal, ROUND_FLOOR

from app.game import engine
from app.game.bots import sma
from app.game.scenario import load_bots

POLICIES = ('idle', 'random', 'buy_hold_all', 'sensible')
PLAYER = 'player'


def _qty(value, price):
    return int((value / price).to_integral_value(ROUND_FLOOR))


def _random(match, t, rng):
    """Trades on about 30% of days with a random side, symbol and size."""
    if rng.random() >= 0.3:
        return []
    book = match.books[PLAYER]
    symbol, side, size = rng.choice(match.symbols), rng.choice(('buy', 'sell')), Decimal(str(rng.uniform(0.1, 0.6)))
    if side == 'buy':
        return [(symbol, 'buy', _qty(size * book.available_cash(), match.rules.ask(match.bar(symbol, t).c)))]
    return [(symbol, 'sell', math.ceil(size * book.available_qty(symbol)))]


def _buy_hold_all(match, t, rng):
    if t:
        return []
    budget = match.rules.starting_cash * Decimal('0.99') / len(match.symbols)
    return [(s, 'buy', _qty(budget, match.rules.ask(match.bar(s, t).c))) for s in match.symbols]


def _sensible(match, t, rng):
    """Reference trend follower: buy above a rising 10-day average, exit below it or 5% under cost."""
    book, orders = match.books[PLAYER], []
    equity = book.equity(match.closes())
    for symbol in match.symbols:
        closes = [bar.c for bar in match.bars[symbol][:t + match.offset + 1]]
        average, previous = sma(closes, 10), sma(closes[:-1], 10)
        close = closes[-1]
        if book.qty(symbol):
            if close < average or close < book.avg_price(symbol) * Decimal('0.95'):
                orders.append((symbol, 'sell', book.qty(symbol)))
        elif previous is not None and close > average > previous:
            orders.append((symbol, 'buy', _qty(equity * Decimal('0.9') / len(match.symbols), match.rules.ask(close))))
    return orders


DECIDE = {'idle': lambda match, t, rng: [], 'random': _random, 'buy_hold_all': _buy_hold_all, 'sensible': _sensible}


def play(scenario, policy, seed):
    """Run one match for `policy`; return (won, profit)."""
    bots = load_bots()
    participants = [engine.Participant(PLAYER, 'Player')] + [engine.Participant(b, bots[b]['name'], bots[b]) for b in scenario['bots']]
    match = engine.Match(scenario, seed, participants)
    rng = random.Random(f'{seed}:{policy}')
    for t in range(scenario['ticks']):
        match.open(t)
        for index, (symbol, side, qty) in enumerate(DECIDE[policy](match, t, rng)):
            if qty <= 0:
                continue
            try:
                match.place(engine.Order(f'{t}-{index}', PLAYER, symbol, side, 'market', qty, t))
            except engine.OrderRejected:
                pass
        match.close(t)
    board = match.leaderboard()
    mine = next(entry for entry in board if entry['participant_id'] == PLAYER)
    won = mine['rank'] == 1 and sum(entry['rank'] == 1 for entry in board) == 1
    return won, mine['profit']


def simulate_policy(scenario, policy, seeds):
    results = [play(scenario, policy, seed) for seed in seeds]
    return {'policy': policy, 'win_rate': sum(won for won, _ in results) / len(results),
            'mean_profit': float(sum(profit for _, profit in results) / len(results))}


def gauntlet(scenario, seeds):
    seeds = list(seeds)
    return {policy: simulate_policy(scenario, policy, seeds) for policy in POLICIES}
