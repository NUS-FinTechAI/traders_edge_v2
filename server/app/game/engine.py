"""Pure match replay: (scenario, seed, participants, human orders, tick) -> state.

Ticks: while 0 <= tick < ticks the bar `tick` is the current day; its close is the price the
player sees and trades at. Bars 0..tick have been processed. At tick == ticks the match has
ended: no bar is added, no order is accepted, and equity is valued at the close of bar ticks-1.
A tick of -1 (briefing) processes no bars and shows only the history.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from decimal import Decimal, ROUND_FLOOR, ROUND_HALF_UP

from app.game import bots, market

CENT = Decimal('0.01')
ZERO = Decimal('0')
HUNDRED = Decimal('100')
TYPE_NAMES = {'limit': 'Limit', 'stop': 'Stop-loss'}


class OrderRejected(ValueError):
    pass


class ReplayError(RuntimeError):
    pass


def money(value):
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def usd(value):
    return f'${money(value):,.2f}'


@dataclass
class Participant:
    id: str
    name: str
    bot: dict | None = None
    forfeited: bool = False


@dataclass
class Order:
    id: str
    participant_id: str
    symbol: str
    side: str
    type: str
    qty: int
    tick: int
    limit_price: Decimal | None = None
    stop_price: Decimal | None = None
    cancelled_tick: int | None = None
    client_order_id: str | None = None
    status: str = 'open'
    filled_tick: int | None = None
    reserved: Decimal = ZERO


@dataclass
class Fill:
    order_id: str | None
    t: int
    symbol: str
    side: str
    qty: int
    price: Decimal
    fee: Decimal
    pnl: Decimal | None = None


@dataclass
class Rules:
    fee_rate: Decimal
    fee_min: Decimal
    half_spread: Decimal
    allow: dict
    max_position_pct: Decimal | None
    starting_cash: Decimal
    ticks: int

    @classmethod
    def of(cls, scenario):
        cap = scenario['max_position_pct']
        return cls(Decimal(str(scenario['fee']['rate'])), Decimal(str(scenario['fee']['min'])),
                   Decimal(str(scenario['spread'])) / 2, scenario['allow'],
                   None if cap is None else Decimal(str(cap)), money(Decimal(str(scenario['starting_cash']))),
                   scenario['ticks'])

    def fee(self, value):
        return max(self.fee_min, money(self.fee_rate * value))

    def ask(self, close):
        return money(close * (1 + self.half_spread))

    def bid(self, close):
        return money(close * (1 - self.half_spread))

    def cost(self, qty, price):
        value = price * qty
        return value + self.fee(value)


@dataclass
class Book:
    cash: Decimal
    shares: dict = field(default_factory=lambda: defaultdict(int))
    costs: dict = field(default_factory=lambda: defaultdict(lambda: ZERO))
    reserved_cash: Decimal = ZERO
    reserved_qty: dict = field(default_factory=lambda: defaultdict(int))
    orders: dict = field(default_factory=dict)
    fills: list = field(default_factory=list)
    realized: Decimal = ZERO
    fees: Decimal = ZERO
    equity_curve: list = field(default_factory=list)
    peak: Decimal = ZERO
    max_drawdown_pct: Decimal = ZERO
    biggest_position_pct: Decimal = ZERO
    most_held: int = 0
    snapshots: list = field(default_factory=list)
    placed: dict = field(default_factory=lambda: defaultdict(int))

    def qty(self, symbol):
        return self.shares[symbol]

    def avg_price(self, symbol):
        return self.costs[symbol] / self.shares[symbol] if self.shares[symbol] else ZERO

    def available_cash(self):
        return self.cash - self.reserved_cash

    def available_qty(self, symbol):
        return self.shares[symbol] - self.reserved_qty[symbol]

    def held(self):
        return [symbol for symbol, qty in self.shares.items() if qty]

    def equity(self, closes):
        return self.cash + sum((qty * closes[symbol] for symbol, qty in self.shares.items()), ZERO)

    def buy(self, order_id, t, symbol, qty, price, fee):
        value = price * qty
        self.cash -= value + fee
        self.shares[symbol] += qty
        self.costs[symbol] += value
        self._fill(Fill(order_id, t, symbol, 'buy', qty, price, fee))

    def sell(self, order_id, t, symbol, qty, price, fee):
        average = self.avg_price(symbol)
        gain = (price - average) * qty
        self.cash += price * qty - fee
        self.realized += gain
        self.shares[symbol] -= qty
        self.costs[symbol] = self.costs[symbol] - average * qty if self.shares[symbol] else ZERO
        self._fill(Fill(order_id, t, symbol, 'sell', qty, price, fee, gain))

    def _fill(self, fill):
        self.fees += fill.fee
        self.fills.append(fill)

    def record(self, t, closes):
        """Close-of-tick metrics; `snapshots` keeps (tick, shares, position % of equity) for missions."""
        equity = self.equity(closes)
        self.equity_curve.append((t, equity))
        self.peak = max(self.peak, equity)
        if self.peak > 0:
            self.max_drawdown_pct = max(self.max_drawdown_pct, (self.peak - equity) / self.peak * HUNDRED)
        held = {symbol: self.shares[symbol] for symbol in self.held()}
        weights = {symbol: qty * closes[symbol] / equity * HUNDRED for symbol, qty in held.items()} if equity > 0 else {}
        self.biggest_position_pct = max([self.biggest_position_pct, *weights.values()])
        self.most_held = max(self.most_held, len(held))
        self.snapshots.append((t, held, weights))


class Match:
    def __init__(self, scenario, seed, participants):
        self.scenario = scenario
        self.rules = Rules.of(scenario)
        self.offset = scenario['history']
        self.bars = market.generate(scenario, seed)
        self.symbols = [asset['symbol'] for asset in scenario['assets']]
        self.participants = {p.id: p for p in participants}
        self.books = {p.id: Book(cash=self.rules.starting_cash, peak=self.rules.starting_cash) for p in participants}
        self.strategies = {p.id: bots.create(p.bot, self.symbols) for p in participants if p.bot}
        self.processed = -1

    def bar(self, symbol, t):
        return self.bars[symbol][t + self.offset]

    def closes(self, t=None):
        t = self.processed if t is None else t
        return {symbol: self.bar(symbol, t).c for symbol in self.symbols}

    def news(self, t):
        return tuple(item for item in self.scenario['news'] if item['tick'] <= t)

    def ended(self, tick):
        return tick >= self.rules.ticks

    def advance(self, tick, orders=()):
        """Process bars up to `tick` (clamped to the last bar) applying stored human orders."""
        placed, cancels = defaultdict(list), defaultdict(list)
        for order in orders:
            placed[order.tick].append(order)
            if order.cancelled_tick is not None and order.cancelled_tick > order.tick:
                cancels[order.cancelled_tick].append(order)
        for t in range(self.processed + 1, min(tick, self.rules.ticks - 1) + 1):
            self.open(t)
            for order in cancels[t]:
                self.cancel(order.participant_id, order.id, t)
            for order in placed[t]:
                try:
                    self.place(order)
                except OrderRejected as error:
                    raise ReplayError(f'Stored order {order.id} no longer replays: {error}') from None
            self.close(t)
        return self

    def open(self, t):
        self.processed = t
        for book in self.books.values():
            for order in book.orders.values():
                if order.status == 'open' and order.tick < t:
                    self._try_resting(book, order, self.bar(order.symbol, t), t)

    def _try_resting(self, book, order, bar, t):
        if order.type == 'limit' and order.side == 'buy' and bar.l <= order.limit_price:
            price = min(order.limit_price, bar.o)
        elif order.type == 'limit' and order.side == 'sell' and bar.h >= order.limit_price:
            price = max(order.limit_price, bar.o)
        elif order.type == 'stop' and bar.l <= order.stop_price:
            price = money(min(order.stop_price, bar.o) * (1 - self.rules.half_spread))
        else:
            return
        self._release(book, order)
        order.status, order.filled_tick = 'filled', t
        fee = self.rules.fee(price * order.qty)
        (book.buy if order.side == 'buy' else book.sell)(order.id, t, order.symbol, order.qty, price, fee)

    def _release(self, book, order):
        if order.side == 'buy':
            book.reserved_cash -= order.reserved
        else:
            book.reserved_qty[order.symbol] -= order.qty

    def cancel(self, participant_id, order_id, t):
        book = self.books[participant_id]
        order = book.orders.get(order_id)
        if order is None:
            raise OrderRejected('This order does not exist.')
        if order.status == 'filled':
            raise OrderRejected('This order has already filled.')
        if order.status == 'open':
            self._release(book, order)
            order.status, order.cancelled_tick = 'cancelled', t
        return order

    def validate(self, order):
        """Raise OrderRejected with a plain-language reason when `order` breaks a rule now."""
        rules, book, t = self.rules, self.books[order.participant_id], self.processed
        if order.symbol not in self.symbols:
            raise OrderRejected(f'{order.symbol} is not traded in this match.')
        if order.type != 'market' and not rules.allow[order.type]:
            raise OrderRejected(f'{TYPE_NAMES[order.type]} orders are not available in this match.')
        close = self.bar(order.symbol, t).c
        if order.type == 'stop' and order.side != 'sell':
            raise OrderRejected('A stop-loss order must be a sell order.')
        if order.type == 'stop' and order.stop_price >= close:
            raise OrderRejected(f'A stop-loss price must be below the current price of {usd(close)}.')
        if order.side == 'buy':
            self._validate_buy(book, order, close)
        else:
            self._validate_sell(book, order, close)

    def _validate_buy(self, book, order, close):
        price = self.rules.ask(close) if order.type == 'market' else order.limit_price
        need = self.rules.cost(order.qty, price)
        if need > book.available_cash():
            raise OrderRejected(f'Not enough cash: this order needs {usd(need)} and you have {usd(book.available_cash())}.')
        cap = self.rules.max_position_pct
        if cap is not None:
            pending = sum(o.qty for o in book.orders.values() if o.status == 'open' and o.side == 'buy' and o.symbol == order.symbol)
            share = (book.qty(order.symbol) + pending + order.qty) * close / book.equity(self.closes()) * HUNDRED
            if share > cap:
                raise OrderRejected(f'This order would put {share:.1f}% of your portfolio in {order.symbol}; '
                                    f'this match allows at most {cap:g}%.')

    def _validate_sell(self, book, order, close):
        available = book.available_qty(order.symbol)
        if not book.qty(order.symbol):
            raise OrderRejected(f'You do not own any {order.symbol} shares to sell.')
        if not available:
            raise OrderRejected(f'All your {order.symbol} shares are already reserved by open sell orders.')
        if order.qty > available:
            raise OrderRejected(f'Not enough shares: you can sell up to {available} {order.symbol}.')
        if order.type == 'market':
            value = self.rules.bid(close) * order.qty
            if value - self.rules.fee(value) + book.available_cash() < 0:
                raise OrderRejected(f'Not enough cash to pay the {usd(self.rules.fee(value))} fee.')

    def place(self, order):
        """Validate and apply a human order at the current tick."""
        self.validate(order)
        book, t = self.books[order.participant_id], self.processed
        book.orders[order.id] = order
        book.placed[order.type] += 1
        if order.cancelled_tick == order.tick:
            order.status = 'cancelled'
        elif order.type == 'market':
            self._market(book, order.id, order.symbol, order.side, order.qty, t)
            order.status, order.filled_tick = 'filled', t
        elif order.side == 'buy':
            order.reserved = self.rules.cost(order.qty, order.limit_price)
            book.reserved_cash += order.reserved
        else:
            book.reserved_qty[order.symbol] += order.qty
        return order

    def _market(self, book, order_id, symbol, side, qty, t):
        close = self.bar(symbol, t).c
        price = self.rules.ask(close) if side == 'buy' else self.rules.bid(close)
        fee = self.rules.fee(price * qty)
        (book.buy if side == 'buy' else book.sell)(order_id, t, symbol, qty, price, fee)

    def close(self, t):
        for participant_id, strategy in self.strategies.items():
            book = self.books[participant_id]
            intents = sorted(strategy.decide(self.observe(t - strategy.delay), book), key=lambda intent: intent[0] != 'sell')
            for side, symbol, qty in intents:
                qty = self._bot_qty(book, side, symbol, qty, t)
                if qty > 0:
                    self._market(book, None, symbol, side, qty, t)
        closes = self.closes(t)
        for book in self.books.values():
            book.record(t, closes)

    def observe(self, t):
        return bots.Observation(t, {s: self.bars[s][:t + self.offset + 1] for s in self.symbols}, self.news(t), self.rules.half_spread)

    def _bot_qty(self, book, side, symbol, qty, t):
        if side == 'sell':
            return min(qty, book.available_qty(symbol))
        close = self.bar(symbol, t).c
        price = self.rules.ask(close)
        qty = min(qty, int((book.available_cash() / (price * (1 + self.rules.fee_rate))).to_integral_value(ROUND_FLOOR)))
        while qty > 0 and self.rules.cost(qty, price) > book.available_cash():
            qty -= 1
        cap = self.rules.max_position_pct
        if cap is not None and qty > 0:
            limit = cap / HUNDRED * book.equity(self.closes(t)) / close - book.qty(symbol)
            qty = min(qty, int(limit.to_integral_value(ROUND_FLOOR)))
        return qty

    def equity(self, participant_id):
        book = self.books[participant_id]
        return book.cash if self.processed < 0 else book.equity(self.closes())

    def profit(self, participant_id):
        return money(self.equity(participant_id) - self.rules.starting_cash)

    def leaderboard(self):
        """Rank by profit to the cent; forfeits rank below finishers; equal profits share a rank."""
        def score(pid):
            return (self.participants[pid].forfeited, -self.profit(pid))

        ordered = sorted(self.participants, key=lambda pid: (*score(pid), self.participants[pid].name, pid))
        return [{'participant_id': pid, 'profit': self.profit(pid),
                 'rank': 1 + sum(score(other) < score(pid) for other in ordered)} for pid in ordered]

    def buy_hold_profit(self, symbols=None):
        """Equal-weight buy-and-hold of `symbols` (default: all) from the close of tick 0."""
        symbols = symbols or self.symbols
        if self.processed < 0:
            return ZERO
        cash = self.rules.starting_cash
        budget = cash / len(symbols)
        end = self.closes()
        for symbol in symbols:
            price = self.rules.ask(self.bar(symbol, 0).c)
            qty = int((budget / (price * (1 + self.rules.fee_rate))).to_integral_value(ROUND_FLOOR))
            while qty > 0 and self.rules.cost(qty, price) > budget:
                qty -= 1
            if qty:
                cash += qty * end[symbol] - self.rules.cost(qty, price)
        return money(cash - self.rules.starting_cash)


def replay(scenario, seed, participants, orders, tick):
    return Match(scenario, seed, participants).advance(tick, orders)
