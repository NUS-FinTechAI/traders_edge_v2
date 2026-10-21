"""Mission predicates on engine state. Live progress uses the same predicate as the final result.

During play only milestone missions can be done; missions judged at the end report `on_track`,
`behind` or (for rules that can no longer be met) `failed`.
"""

from decimal import Decimal

from app.game.engine import HUNDRED, usd


MILESTONES = {'trades_min', 'use_order', 'stop_loss_set', 'min_holdings', 'sold_after_news', 'bought_after_news', 'held_between'}
RULES = {'trades_max', 'max_drawdown', 'max_position', 'no_buy_between', 'max_position_before', 'kept_plan'}


def _pct(value):
    return f'{Decimal(value):.1f}%'


def _signed(value):
    return ('+' if value >= 0 else '−') + usd(abs(value))


def _count(value, target):
    return value >= target, f'{min(value, target)}/{target}'


def _bot_participant(match, bot_id):
    return next((pid for pid, p in match.participants.items() if p.bot and p.bot['id'] == bot_id), None)


def _news_trade(match, book, params, side):
    item = next(n for n in match.scenario['news'] if n['id'] == params['news_id'])
    done = any(f.side == side and f.symbol in item['symbols'] and item['tick'] <= f.t <= item['tick'] + params['within']
               for f in book.fills)
    return done, 'Done' if done else 'Not yet'


def check(mission, match, pid, plan):
    book, params = match.books[pid], mission['params']
    kind = mission['type']
    trades = len(book.fills)
    profit = match.profit(pid)
    if kind == 'trades_min':
        return _count(trades, params['n'])
    if kind == 'trades_max':
        return trades <= params['n'], f'{trades} of at most {params["n"]}'
    if kind == 'use_order':
        return _count(book.placed[params['type']], params['n'])
    if kind == 'stop_loss_set':
        return _count(book.placed['stop'], 1)
    if kind == 'hold_at_end':
        holding = book.qty(params['symbol']) > 0 if 'symbol' in params else bool(book.held())
        return holding, 'Holding' if holding else 'Not holding'
    if kind == 'end_in_cash':
        cash = not book.held()
        return cash, 'In cash' if cash else 'Holding shares'
    if kind == 'profit_min':
        return profit >= Decimal(str(params['amount'])), f'{_signed(profit)} of {usd(params["amount"])}'
    if kind == 'profit_pct_min':
        pct = profit / match.rules.starting_cash * HUNDRED
        return pct >= Decimal(str(params['pct'])), f'{_pct(pct)} of {_pct(params["pct"])}'
    if kind == 'rank_max':
        board = match.leaderboard()
        mine = next(entry for entry in board if entry['participant_id'] == pid)
        forfeited = match.participants[pid].forfeited
        at_or_above = sum(1 for entry in board if entry['participant_id'] != pid
                          and (match.participants[entry['participant_id']].forfeited, -entry['profit']) <= (forfeited, -profit))
        return at_or_above < params['rank'], f'Rank {mine["rank"]} of {len(board)}'
    if kind == 'beat_bot':
        bot = _bot_participant(match, params['bot_id'])
        if bot is None:
            return False, 'Not in this match'
        gap = profit - match.profit(bot)
        return gap > 0, f'{_signed(gap)} vs {match.participants[bot].name}'
    if kind == 'beat_buy_hold':
        gap = profit - match.buy_hold_profit([params['symbol']])
        return gap > 0, f'{_signed(gap)} vs buy-and-hold'
    if kind == 'max_drawdown':
        return book.max_drawdown_pct <= Decimal(str(params['pct'])), f'Worst drop {_pct(book.max_drawdown_pct)} of {_pct(params["pct"])}'
    if kind == 'max_position':
        return book.biggest_position_pct <= Decimal(str(params['pct'])), f'Largest {_pct(book.biggest_position_pct)} of {_pct(params["pct"])}'
    if kind == 'min_holdings':
        return _count(book.most_held, params['n'])
    if kind == 'sold_after_news':
        return _news_trade(match, book, params, 'sell')
    if kind == 'bought_after_news':
        return _news_trade(match, book, params, 'buy')
    if kind == 'no_buy_between':
        broken = any(f.side == 'buy' and params['from'] <= f.t <= params['to'] for f in book.fills)
        return not broken, 'Broken' if broken else 'Kept'
    if kind == 'max_position_before':
        limit = Decimal(str(params['pct']))
        broken = any(pct > limit for t, _, weights in book.snapshots if t < params['tick']
                     for symbol, pct in weights.items() if params.get('symbol', symbol) == symbol)
        return not broken, 'Broken' if broken else 'Kept'
    if kind == 'held_between':
        window = [held.get(params['symbol'], 0) for t, held, _ in book.snapshots if params['from'] <= t <= params['to']]
        if not all(window):
            return False, 'Broken'
        return match.processed >= params['to'], 'Held' if match.processed >= params['to'] else 'Not yet'
    if kind == 'exited_by':
        after = [held.get(params['symbol'], 0) for t, held, _ in book.snapshots if t >= params['tick']]
        if any(after):
            return False, 'Still holding' if after[-1] else 'Bought back'
        return bool(after), 'Out' if after else 'Not yet'
    if kind == 'kept_plan':
        if not plan:
            return False, 'No plan'
        limit = Decimal(str(plan['max_loss_pct']))
        return book.max_drawdown_pct <= limit, f'Worst drop {_pct(book.max_drawdown_pct)} of {_pct(limit)}'
    raise ValueError(f'Unknown mission type {kind}')


def _state(kind, met, final):
    if final or kind in MILESTONES:
        return 'done' if met else ('failed' if final else 'pending')
    if met:
        return 'on_track'
    return 'failed' if kind in RULES else 'behind'


def evaluate(match, pid, plan, final=False):
    forfeited = match.participants[pid].forfeited
    missions = []
    for tier in ('basic', 'bonus'):
        for mission in match.scenario['missions'][tier]:
            if forfeited:
                met, progress, state = False, 'Forfeited', 'failed'
            else:
                met, progress = check(mission, match, pid, plan)
                state = _state(mission['type'], met, final)
            missions.append({'id': mission['id'], 'tier': tier, 'text': mission['text'], 'done': state == 'done',
                             'state': state, 'progress': progress})
    return missions
