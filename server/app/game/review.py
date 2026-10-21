"""Post-match review: an unvalidated decision score and plain-language key moments."""

from decimal import Decimal

from app.game.engine import HUNDRED, usd

DROP = Decimal('-0.03')
MAX_MOMENTS = 5


def _pct(value):
    return ('+' if value >= 0 else '−') + f'{abs(value) * HUNDRED:.1f}%'


PARTS = {'missions': 40, 'plan': 25, 'risk': 25, 'overtrading': 10}
OUTCOME_MISSIONS = {'profit_min', 'profit_pct_min', 'rank_max', 'beat_bot', 'beat_buy_hold'}


def _protected(book, fill):
    return any(o.type == 'stop' and o.symbol == fill.symbol and o.tick <= fill.t + 1
               and (o.cancelled_tick is None or (o.cancelled_tick > o.tick and o.cancelled_tick >= fill.t))
               and (o.filled_tick is None or o.filled_tick >= fill.t)
               for o in book.orders.values())


def process_missions(match, missions):
    """Bonus process missions (basic ones when there are none); profit and rank missions never count."""
    kinds = {mission['id']: mission['type'] for tier in ('basic', 'bonus') for mission in match.scenario['missions'][tier]}
    process = [m for m in missions if kinds.get(m['id']) not in OUTCOME_MISSIONS]
    return [m for m in process if m['tier'] == 'bonus'] or process


def weights(available):
    """Rescale the PARTS weights of the available components to whole points that sum to 100 (largest remainder)."""
    total = sum(PARTS[key] for key in available)
    exact = {key: Decimal(PARTS[key] * 100) / total if key in available else Decimal(0) for key in PARTS}
    whole = {key: int(value) for key, value in exact.items()}
    for key in sorted(available, key=lambda key: (whole[key] - exact[key], list(PARTS).index(key)))[:100 - sum(whole.values())]:
        whole[key] += 1
    return whole


def decision_breakdown(match, pid, plan, missions):
    """(points, maximum points) per component: process missions, plan kept, stop discipline and low overtrading.

    A component the player could not act on (stop orders disabled, no process missions) is left out and the others are
    rescaled to 100. Profit never adds points directly. Not a validated measure.
    """
    book = match.books[pid]
    process = process_missions(match, missions)
    buys = [fill for fill in book.fills if fill.side == 'buy']
    shares = {
        'missions': Decimal(sum(m['done'] for m in process)) / len(process) if process else None,
        'plan': Decimal(bool(plan) and book.max_drawdown_pct <= Decimal(str(plan['max_loss_pct']))),
        'risk': (Decimal(sum(_protected(book, fill) for fill in buys)) / len(buys) if buys else Decimal(0)) if match.rules.allow['stop'] else None,
        'overtrading': 1 - min(Decimal(1), book.fees / max(Decimal(1), abs(match.profit(pid)))),
    }
    maximum = weights([key for key, share in shares.items() if share is not None])
    points = {key: min(maximum[key], int((maximum[key] * share).to_integral_value())) if share is not None else 0
              for key, share in shares.items()}
    return points, maximum


def _held(book, t, symbol):
    return next((held.get(symbol, 0) for tick, held, _ in book.snapshots if tick == t), 0)


def _news_moment(match, book, item, day):
    effects = [e for e in item['effects'] if e['symbol'] in item['symbols']]
    symbol = effects[0]['symbol'] if effects else item['symbols'][0]
    window = max((e['ticks'] for e in effects if e['symbol'] == symbol), default=1)
    start, end = item['tick'] - 1, min(item['tick'] + window - 1, match.processed)
    before, after = match.bar(symbol, start).c, match.bar(symbol, end).c
    move = after / before - 1
    qty = _held(book, start, symbol)
    text = f'{day(item["tick"])}: {item["headline"]} ({_pct(move)}).'
    if not qty:
        return item['tick'], abs(move) * 1000, f'{text} You held no {symbol}.'
    change = qty * (after - before)
    return item['tick'], abs(change), f'{text} You held {qty} {symbol} and {"gained" if change >= 0 else "lost"} {usd(abs(change))}.'


def _drop_sell(match, pid, fill, day):
    change = match.bar(fill.symbol, fill.t).c / match.bar(fill.symbol, fill.t - 1).c - 1
    if change > DROP:
        return None
    mine = match.profit(pid)
    holders = [(match.profit(other) - mine, p.name) for other, p in match.participants.items()
               if p.bot and _held(match.books[other], fill.t, fill.symbol) and match.profit(other) > mine]
    text = f'{day(fill.t)}: you sold {fill.qty} {fill.symbol} right after a {_pct(change)} drop'
    if holders:
        gap, name = max(holders)
        text += f'; {name} held and finished {usd(gap)} ahead'
    return fill.t, fill.qty * fill.price * abs(change) + 1, text + '.'


def key_moments(match, pid):
    book = match.books[pid]
    label = match.scenario['tick_label']

    def day(t):
        return f'{label} {t + 1}'

    moments = [_news_moment(match, book, item, day) for item in match.scenario['news'] if item['tick'] <= match.processed]
    for fill in book.fills:
        if fill.side != 'sell':
            continue
        order = book.orders.get(fill.order_id)
        if order is not None and order.type == 'stop':
            moments.append((fill.t, fill.qty * fill.price * Decimal('0.02'), f'{day(fill.t)}: your stop-loss sold {fill.qty} {fill.symbol} at {usd(fill.price)}.'))
        elif fill.t > 0:
            moments.append(_drop_sell(match, pid, fill, day))
    trades = [fill for fill in book.fills if fill.pnl]
    if trades:
        best = max(trades, key=lambda fill: abs(fill.pnl))
        if abs(best.pnl) >= 1:
            moments.append((best.t, abs(best.pnl), f'{day(best.t)}: you sold {best.qty} {best.symbol} for a '
                                                   f'{"gain" if best.pnl > 0 else "loss"} of {usd(abs(best.pnl))}.'))
    peak, deepest = match.rules.starting_cash, None
    for t, equity in book.equity_curve:
        peak = max(peak, equity)
        if peak > 0 and (deepest is None or (peak - equity) / peak > deepest[1]):
            deepest = (t, (peak - equity) / peak, peak - equity)
    if deepest and deepest[1] >= Decimal('0.03'):
        moments.append((deepest[0], deepest[2], f'{day(deepest[0])}: your portfolio was {deepest[1] * HUNDRED:.1f}% below its peak, its deepest drop.'))
    if not book.fills and match.processed >= 0:
        moments.append((match.processed, Decimal(10**9), 'You made no trades, so your money stayed in cash all match.'))
    chosen = sorted((m for m in moments if m), key=lambda m: m[1], reverse=True)[:MAX_MOMENTS]
    return [text for _, _, text in sorted(chosen, key=lambda m: m[0])]
