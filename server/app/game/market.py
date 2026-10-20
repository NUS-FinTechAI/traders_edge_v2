"""Seeded scenario price paths: a one-factor model plus authored news effects."""

from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
import random

CENT = Decimal('0.01')


@dataclass(frozen=True)
class Bar:
    t: int
    o: Decimal
    h: Decimal
    l: Decimal
    c: Decimal
    v: int


def cents(value):
    return max(CENT, Decimal(repr(value)).quantize(CENT, rounding=ROUND_HALF_UP))


def news_effects(scenario):
    """Return per-symbol return shares and opening gaps keyed by tick."""
    moves = defaultdict(lambda: defaultdict(float))
    gaps = defaultdict(lambda: defaultdict(float))
    for item in scenario['news']:
        for effect in item['effects']:
            days = effect['ticks']
            total = days * (days + 1) / 2
            for k in range(days):
                share = effect['move'] * (days - k) / total
                moves[effect['symbol']][item['tick'] + k] += share
                if effect['gap'] and k == 0:
                    gaps[effect['symbol']][item['tick']] += share
    return moves, gaps


def regime_at(scenario, t):
    for regime in scenario['regimes']:
        if regime['from'] <= t < regime['to']:
            return regime
    return scenario['regimes'][0]


def generate(scenario, seed):
    """Bars for ticks -history..ticks-1. `asset.price` is the close before the first bar."""
    rng = random.Random(seed)
    moves, gaps = news_effects(scenario)
    previous = {asset['symbol']: float(asset['price']) for asset in scenario['assets']}
    bars = {symbol: [] for symbol in previous}
    for t in range(-scenario['history'], scenario['ticks']):
        regime = regime_at(scenario, t)
        factor = regime['market_drift'] + scenario['market']['vol'] * regime['vol_mult'] * rng.gauss(0, 1)
        for asset in scenario['assets']:
            symbol, vol = asset['symbol'], asset['vol']
            noise, high_wick, low_wick = rng.gauss(0, 1), abs(rng.gauss(0, 1)), abs(rng.gauss(0, 1))
            volume_noise = rng.lognormvariate(0, 0.25)
            change = max(-0.9, asset['drift'] + asset['beta'] * factor + vol * regime['vol_mult'] * noise + moves[symbol][t])
            prior = previous[symbol]
            close = prior * (1 + change)
            opening = prior * (1 + gaps[symbol][t])
            high = max(opening, close) * (1 + high_wick * vol * 0.6)
            low = min(opening, close) * max(0.05, 1 - low_wick * vol * 0.6)
            volume = int(asset['base_volume'] * (1 + 4 * abs(change) / vol) * volume_noise)
            bars[symbol].append(Bar(t, cents(opening), cents(high), cents(low), cents(close), volume))
            previous[symbol] = close
    return bars
