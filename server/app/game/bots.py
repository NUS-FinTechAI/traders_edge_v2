"""Deterministic AI personalities. A bot sees only bars and news up to its observed tick and its own book.

A bot with `delay: d` decides at tick t from the market as it was at tick t - d (its reaction
delay) and trades at tick t's price.
"""

from dataclasses import dataclass
from decimal import Decimal, ROUND_FLOOR

HYPE = ('rumor', 'hype')


@dataclass(frozen=True)
class Observation:
    t: int
    bars: dict
    news: tuple
    half_spread: Decimal

    def closes(self, symbol):
        return [bar.c for bar in self.bars[symbol]]

    def close(self, symbol):
        return self.bars[symbol][-1].c

    def change(self, symbol):
        bars = self.bars[symbol]
        return bars[-1].c / bars[-2].c - 1

    def ask(self, symbol):
        return self.close(symbol) * (1 + self.half_spread)

    def closes_now(self):
        return {symbol: bars[-1].c for symbol, bars in self.bars.items()}

    def headlines(self, since=None):
        start = self.t if since is None else since
        return [item for item in self.news if item['tick'] >= start]


def sma(values, window):
    return sum(values[-window:]) / window if len(values) >= window else None


def rsi(closes, window):
    if len(closes) <= window:
        return None
    changes = [later - earlier for earlier, later in zip(closes[-window - 1:-1], closes[-window:])]
    gains = sum(change for change in changes if change > 0)
    losses = -sum(change for change in changes if change < 0)
    return Decimal(100) if not losses else 100 - 100 / (1 + gains / losses)


def floor(value):
    return int(value.to_integral_value(ROUND_FLOOR))


class Strategy:
    def __init__(self, bot, symbols):
        self.params = bot['params']
        self.delay = self.params.get('delay', 0)
        allowed = self.params.get('symbols')
        self.symbols = [symbol for symbol in symbols if not allowed or symbol in allowed]

    def buy(self, view, book, symbol, fraction):
        return ('buy', symbol, floor(Decimal(str(fraction)) * book.equity(view.closes_now()) / view.ask(symbol)))

    def sell(self, book, symbol):
        return ('sell', symbol, book.qty(symbol))

    def share(self):
        return self.params['weight'] / len(self.symbols)

    def decide(self, view, book):
        raise NotImplementedError


class BuyHold(Strategy):
    """Equal-weight buy of `weight` of equity at tick `at`; never sells."""
    done = False

    def decide(self, view, book):
        if self.done or view.t < self.params['at']:
            return []
        self.done = True
        return [self.buy(view, book, symbol, self.share()) for symbol in self.symbols]


class Momentum(Strategy):
    """Buy when close > SMA (optionally rising, optionally at a new high); exit below the exit SMA."""

    def decide(self, view, book):
        p, orders = self.params, []
        for symbol in self.symbols:
            closes = view.closes(symbol)
            average, close = sma(closes, p['sma']), closes[-1]
            if book.qty(symbol):
                exit_average = sma(closes, p['exit_sma'])
                if exit_average is not None and close < exit_average:
                    orders.append(self.sell(book, symbol))
                continue
            if average is None or len(closes) <= p['sma'] or close <= average:
                continue
            rising = not p['rising'] or average > sma(closes[:-1], p['sma'])
            at_high = not p['high_window'] or close >= max(closes[-p['high_window']:])
            if rising and at_high:
                orders.append(self.buy(view, book, symbol, self.share()))
        return orders


class MeanReversion(Strategy):
    """Buy red streaks or oversold RSI; sell at the exit SMA, the profit target or a trailing stop."""

    def __init__(self, bot, symbols):
        super().__init__(bot, symbols)
        self.peak = {}

    def oversold(self, view, symbol):
        p, bars = self.params, view.bars[symbol]
        if p['entry'] == 'red_candles':
            recent = bars[-p['red_candles']:]
            return len(recent) == p['red_candles'] and all(bar.c < bar.o for bar in recent)
        value = rsi(view.closes(symbol), p['rsi_window'])
        return value is not None and value < p['rsi_below']

    def decide(self, view, book):
        p, orders = self.params, []
        for symbol in self.symbols:
            closes = view.closes(symbol)
            close = closes[-1]
            if book.qty(symbol):
                self.peak[symbol] = max(self.peak[symbol], close)
                average = sma(closes, p['exit_sma'])
                target = book.avg_price(symbol) * Decimal(str(1 + p['take_profit']))
                trailed = p['trail'] and close < self.peak[symbol] * Decimal(str(1 - p['trail']))
                if (average is not None and close >= average) or close >= target or trailed:
                    orders.append(self.sell(book, symbol))
                continue
            trend = sma(closes, p['trend_sma']) if p['trend_sma'] else None
            if p['trend_sma'] and (trend is None or close <= trend):
                continue
            if self.oversold(view, symbol):
                self.peak[symbol] = close
                orders.append(self.buy(view, book, symbol, self.share()))
        return orders


class Emotional(Strategy):
    """Buys after a green streak or good news; sells everything on bad news or a sharp down day."""

    def decide(self, view, book):
        p = self.params
        today = view.headlines()
        held = [symbol for symbol in self.symbols if book.qty(symbol)]
        scared = any(item['tone'] == 'negative' for item in today) or any(view.change(s) <= -p['drop'] for s in held)
        if held and scared:
            return [self.sell(book, symbol) for symbol in held]
        orders = []
        for symbol in self.symbols:
            if book.qty(symbol) or scared:
                continue
            closes = view.closes(symbol)
            streak = len(closes) > p['streak'] and all(closes[-i] > closes[-i - 1] for i in range(1, p['streak'] + 1))
            cheered = any(item['tone'] == 'positive' and symbol in item['symbols'] for item in today)
            if streak or cheered:
                orders.append(self.buy(view, book, symbol, self.share()))
        return orders


class Scalper(Strategy):
    """Buys a green close above `min_move` and sells it at the next tick."""

    def decide(self, view, book):
        orders = []
        for symbol in self.symbols:
            if book.qty(symbol):
                orders.append(self.sell(book, symbol))
            elif view.change(symbol) > max(0, self.params['min_move']):
                orders.append(self.buy(view, book, symbol, self.share()))
        return orders


class Breakout(Strategy):
    """Buys a close above the prior `window` high (optionally on high volume); stops just under that level."""

    def __init__(self, bot, symbols):
        super().__init__(bot, symbols)
        self.level = {}

    def decide(self, view, book):
        p, orders = self.params, []
        for symbol in self.symbols:
            bars, close = view.bars[symbol], view.close(symbol)
            if book.qty(symbol):
                if close < self.level[symbol] * Decimal(str(1 - p['buffer'])):
                    orders.append(self.sell(book, symbol))
                continue
            if len(bars) <= max(p['window'], p['volume_window']):
                continue
            level = max(bar.h for bar in bars[-p['window'] - 1:-1])
            average_volume = sum(bar.v for bar in bars[-p['volume_window'] - 1:-1]) / p['volume_window']
            if close > level and bars[-1].v >= p['volume_mult'] * average_volume:
                self.level[symbol] = level
                orders.append(self.buy(view, book, symbol, self.share()))
        return orders


class NewsReactor(Strategy):
    """Buys after positive headlines and sells after negative ones, skipping ignored kinds.

    With `fade_gap`, a rumor or hype headline whose opening gap exceeds it is faded instead.
    """

    def decide(self, view, book):
        p, orders, acted = self.params, [], set()
        for item in view.headlines():
            kind = item.get('kind', 'company')
            for symbol in (s for s in item['symbols'] if s in self.symbols and s not in acted):
                bars = view.bars[symbol]
                gap = bars[-1].o / bars[-2].c - 1
                held = book.qty(symbol)
                if p['fade_gap'] and kind in HYPE and abs(gap) > p['fade_gap']:
                    bearish = gap > 0
                elif kind in p['ignore'] or item['tone'] == 'neutral':
                    continue
                else:
                    bearish = item['tone'] == 'negative'
                if bearish and held:
                    orders.append(self.sell(book, symbol))
                elif not bearish and not held:
                    orders.append(self.buy(view, book, symbol, self.share()))
                acted.add(symbol)
        return orders


class RiskManager(Strategy):
    """Risks `risk` of equity per trade above the trend SMA with a stop under the recent low.

    Takes half off at `take_half_r` times the risk and moves the stop to the entry price.
    """

    def __init__(self, bot, symbols):
        super().__init__(bot, symbols)
        self.stop, self.entry, self.halved = {}, {}, set()

    def climax(self, view, symbol):
        bars, factor = view.bars[symbol], self.params['climax_volume']
        if not factor or len(bars) <= 20:
            return False
        average = sum(bar.v for bar in bars[-21:-1]) / 20
        return bars[-1].c > bars[-2].c and bars[-1].v > factor * average

    def can_enter(self, view, symbol):
        p, closes = self.params, view.closes(symbol)
        trend = sma(closes, p['trend_sma'])
        if trend is None or closes[-1] <= trend:
            return False
        if p['momentum_filter']:
            fast = sma(closes, 10)
            if len(closes) <= 10 or closes[-1] <= fast or fast <= sma(closes[:-1], 10):
                return False
        return not (p['avoid_hype'] and any(item.get('kind', 'company') in HYPE and symbol in item['symbols']
                                            for item in view.headlines(view.t - 2)))

    def manage(self, view, book, symbol):
        close, qty = view.close(symbol), book.qty(symbol)
        if self.climax(view, symbol) or close < self.stop[symbol]:
            self.halved.discard(symbol)
            return ('sell', symbol, qty)
        if symbol not in self.halved and close >= self.entry[symbol] + self.params['take_half_r'] * (self.entry[symbol] - self.stop[symbol]):
            self.halved.add(symbol)
            self.stop[symbol] = self.entry[symbol]
            return ('sell', symbol, max(1, qty // 2))
        return None

    def decide(self, view, book):
        p, orders = self.params, []
        closes = view.closes_now()
        equity = book.equity(closes)
        exposure = sum((book.qty(s) * closes[s] for s in self.symbols), Decimal(0))
        for symbol in self.symbols:
            if book.qty(symbol):
                order = self.manage(view, book, symbol)
                if order:
                    orders.append(order)
                continue
            if not self.can_enter(view, symbol):
                continue
            stop = min(bar.l for bar in view.bars[symbol][-p['stop_window']:])
            per_share = closes[symbol] - stop
            room = Decimal(str(p['max_exposure'])) * equity - exposure
            if per_share <= 0 or room <= 0:
                continue
            qty = min(floor(Decimal(str(p['risk'])) * equity / per_share), floor(room / view.ask(symbol)))
            if qty > 0:
                self.stop[symbol], self.entry[symbol] = stop, closes[symbol]
                exposure += qty * closes[symbol]
                orders.append(('buy', symbol, qty))
        return orders


STRATEGIES = {'buy_hold': BuyHold, 'momentum': Momentum, 'mean_reversion': MeanReversion, 'emotional': Emotional,
              'scalper': Scalper, 'breakout': Breakout, 'news_reactor': NewsReactor, 'risk_manager': RiskManager}


def create(bot, symbols):
    return STRATEGIES[bot['strategy']](bot, symbols)
