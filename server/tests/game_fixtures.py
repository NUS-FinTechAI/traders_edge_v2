"""Shared builders for game engine tests."""

import copy
from decimal import Decimal

from app.game import engine
from app.game.market import Bar
from app.game.scenario import load_bots

BASE = {
    'id': 'test-market', 'version': 1, 'title': 'Test Market', 'briefing': 'A test market.', 'objective': 'Testing.',
    'debrief': 'It was a test.', 'difficulty': 1, 'ticks': 20, 'history': 5, 'tick_label': 'Day', 'starting_cash': 10000,
    'fee': {'rate': 0.001, 'min': 1}, 'spread': 0.002, 'allow': {'limit': True, 'stop': True}, 'max_position_pct': None,
    'tools': ['candles'], 'market': {'vol': 0.005},
    'regimes': [{'from': 0, 'to': 20, 'market_drift': 0.001, 'vol_mult': 1.0}],
    'assets': [
        {'symbol': 'LEAF', 'name': 'Leafy Greens Co.', 'sector': 'Consumer', 'blurb': 'Salad kits.', 'price': 50,
         'drift': 0.0005, 'beta': 1.0, 'vol': 0.01, 'base_volume': 10000},
        {'symbol': 'ROCK', 'name': 'Rock Supply', 'sector': 'Materials', 'blurb': 'Gravel.', 'price': 20,
         'drift': 0.0, 'beta': 0.8, 'vol': 0.01, 'base_volume': 8000},
    ],
    'news': [], 'bots': [],
    'missions': {'basic': [{'id': 'first-trade', 'type': 'trades_min', 'params': {'n': 1}, 'text': 'Make a trade'}], 'bonus': []},
}


def scenario(**overrides):
    data = copy.deepcopy(BASE)
    data.update(copy.deepcopy(overrides))
    return data


def participants(data, human_ids=('me',)):
    bots = load_bots()
    return [engine.Participant(pid, pid) for pid in human_ids] + [engine.Participant(b, bots[b]['name'], bots[b]) for b in data['bots']]


def flat_match(data=None, price='50.00', human_ids=('me',)):
    """A match whose bars are all flat at `price`; tests overwrite specific bars with `set_bar`."""
    data = data or scenario()
    match = engine.Match(data, 1, participants(data, human_ids))
    value = Decimal(price)
    for symbol in match.symbols:
        match.bars[symbol] = [Bar(t, value, value, value, value, 1000) for t in range(-data['history'], data['ticks'])]
    return match


def set_bar(match, symbol, t, o, h, l, c, v=1000):
    match.bars[symbol][t + match.offset] = Bar(t, Decimal(o), Decimal(h), Decimal(l), Decimal(c), v)


def order(oid, side, qty, tick=0, kind='market', symbol='LEAF', limit=None, stop=None, pid='me', cancelled=None):
    return engine.Order(oid, pid, symbol, side, kind, qty, tick, None if limit is None else Decimal(limit),
                        None if stop is None else Decimal(stop), cancelled, oid)
