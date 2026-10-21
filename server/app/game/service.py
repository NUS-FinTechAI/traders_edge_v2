"""Match commands, public state and settlement. Chapters and currencies stay behind the hooks."""

from dataclasses import dataclass, field
from decimal import Decimal
import secrets

from fastapi import HTTPException
from sqlalchemy import func, select

from app.db import now, uid
from app.game import clock, engine, objectives, review
from app.game.engine import HUNDRED, money
from app.game.models import Game, GameEvent, GameOrder, GameParticipant
from app.game.scenario import get_scenario, load_bots, load_scenarios

SOLO_MODES = ('level', 'boss', 'daily', 'practice')
MULTIPLAYER_MODES = ('private', 'ranked')
NO_REWARDS = {'xp': 0, 'stocks': 0, 'gems': 0, 'items': [], 'badges': []}
PLAN_DAYS = 3
STALE_DEBRIEF = 'This match used an older version of its market, so it was closed without a result.'


@dataclass
class GameSpec:
    scenario_id: str
    mode: str
    chapter_id: str | None = None
    level_id: str | None = None
    boss: str | None = None
    context: dict = field(default_factory=dict)
    bot_ids: list[str] | None = None


class Rejected(Exception):
    def __init__(self, reason):
        super().__init__(reason)
        self.reason = reason


class Refused(Exception):
    """A refusal sent as `status` + `detail` that keeps the writes made before it (an HTTPException rolls them back)."""

    def __init__(self, status, detail):
        super().__init__(detail)
        self.status, self.detail = status, detail


@dataclass
class Loaded:
    game: Game
    scenario: dict | None
    me: GameParticipant
    participants: list
    orders: list
    stale: bool = False


async def resolve_game(db, profile, request):
    """Default: practice matches on `practice-*` scenarios only."""
    if request.mode != 'practice':
        raise HTTPException(403, 'This mode is not available yet')
    scenarios = load_scenarios()
    practice = sorted(key for key in scenarios if key.startswith('practice-'))
    scenario_id = request.scenario_id or secrets.choice(practice)
    if scenario_id not in practice:
        raise HTTPException(404, 'Scenario not found')
    bot_ids = scenarios[scenario_id]['bots'][:request.bots] if request.bots else None
    return GameSpec(scenario_id, 'practice', bot_ids=bot_ids)


async def settle_game(db, profile, game, participant, result):
    """Default: award nothing."""
    return {'rewards': dict(NO_REWARDS), 'stars': None, 'unlocked': None}


async def before_start(db, profile, game):
    """Default: every briefing may start. Raise HTTPException to refuse."""


def scenario_for(scenario_id):
    try:
        return get_scenario(scenario_id)
    except KeyError:
        raise HTTPException(404, 'Scenario not found') from None


def is_stale(game):
    """A match whose scenario was removed or changed version can no longer be replayed."""
    scenario = load_scenarios().get(game.scenario_id)
    return scenario is None or scenario['version'] != game.scenario_version


def _new_game(scenario, mode, status, game_clock, host_id, seed=None, **extra):
    return Game(id=uid(), mode=mode, scenario_id=scenario['id'], scenario_version=scenario['version'],
                seed=secrets.randbelow(2**31) if seed is None else seed, status=status, clock=game_clock, host_user_id=host_id, **extra)


def _seed_override(context):
    """An integer `seed` in the spec context (e.g. the daily shared seed) replaces the random seed."""
    seed = context.get('seed')
    return seed if isinstance(seed, int) and not isinstance(seed, bool) and 0 <= seed < 2**31 else None


def _add_participants(db, game, profiles, bot_ids):
    bots = load_bots()
    unknown = [bot_id for bot_id in bot_ids if bot_id not in bots]
    if unknown:
        raise HTTPException(422, f'Unknown opponent: {", ".join(unknown)}')
    for profile in profiles:
        db.add(GameParticipant(id=uid(), game_id=game.id, user_id=profile.id, display_name=profile.display_name, forfeited=False))
    for bot_id in bot_ids:
        db.add(GameParticipant(id=uid(), game_id=game.id, bot_id=bot_id, display_name=bots[bot_id]['name'], forfeited=False))


async def create_game(db, profile, spec):
    scenario = scenario_for(spec.scenario_id)
    game = _new_game(scenario, spec.mode, 'briefing', clock.briefing(clock.now_ms()), profile.id, _seed_override(spec.context),
                     context=spec.context, chapter_id=spec.chapter_id, level_id=spec.level_id, boss=spec.boss)
    db.add(game)
    await db.flush()
    _add_participants(db, game, [profile], scenario['bots'] if spec.bot_ids is None else spec.bot_ids)
    await db.flush()
    return game


async def create_multiplayer_game(db, scenario_id, mode, human_profiles, bot_ids, lobby_id):
    """Create a running shared match on the fixed multiplayer clock. Each player may then submit a plan."""
    if mode not in MULTIPLAYER_MODES:
        raise ValueError(f'Multiplayer mode must be one of {", ".join(MULTIPLAYER_MODES)}')
    scenario = scenario_for(scenario_id)
    at = clock.now_ms()
    game = _new_game(scenario, mode, 'running', clock.start(at, clock.MULTIPLAYER_TICK_MS), human_profiles[0].id,
                     context={'lobby_id': lobby_id}, lobby_id=lobby_id)
    db.add(game)
    await db.flush()
    _add_participants(db, game, human_profiles, bot_ids)
    await db.flush()
    for participant in await db.scalars(select(GameParticipant).where(GameParticipant.game_id == game.id, GameParticipant.user_id.is_not(None))):
        db.add(GameEvent(game_id=game.id, participant_id=participant.id, tick=0, kind='start', payload={'plan': None, 'lobby_id': lobby_id}))
    return game


async def load(db, profile, game_id, lock=False, allow_stale=False):
    """`allow_stale` returns a match whose scenario changed (`Loaded.stale`, no scenario) so it can still be closed."""
    member = select(GameParticipant.id).where(GameParticipant.game_id == Game.id, GameParticipant.user_id == profile.id).exists()
    query = select(Game).where(Game.id == game_id, member)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    game = await db.scalar(query)
    if game is None:
        raise HTTPException(404, 'Match not found')
    stale = is_stale(game)
    if stale and not allow_stale:
        raise HTTPException(409, 'This match uses an older version of its scenario and can no longer be loaded')
    scenario = None if stale else scenario_for(game.scenario_id)
    participants = list(await db.scalars(select(GameParticipant).where(GameParticipant.game_id == game.id).order_by(GameParticipant.id)))
    orders = list(await db.scalars(select(GameOrder).where(GameOrder.game_id == game.id).order_by(GameOrder.participant_id, GameOrder.seq)))
    me = next(p for p in participants if p.user_id == profile.id)
    return Loaded(game, scenario, me, participants, orders, stale)


def current_tick(loaded, at):
    return 0 if loaded.game.status == 'briefing' else clock.current_tick(loaded.game.clock, loaded.scenario['ticks'], at)


def status_of(loaded, tick):
    return 'ended' if loaded.game.status == 'running' and tick >= loaded.scenario['ticks'] else loaded.game.status


def never_started(loaded):
    """Solo matches store a plan at start, so a solo match without one never left the briefing."""
    return loaded.game.status == 'briefing' or (loaded.game.mode in SOLO_MODES and loaded.me.plan is None)


def build(loaded, tick):
    bots = load_bots()
    if any(p.bot_id and p.bot_id not in bots for p in loaded.participants):
        raise HTTPException(409, 'An opponent in this match is no longer available')
    participants = [engine.Participant(p.id, p.display_name, bots[p.bot_id] if p.bot_id else None, p.forfeited) for p in loaded.participants]
    orders = [engine.Order(id=o.id, participant_id=o.participant_id, symbol=o.symbol, side=o.side, type=o.type, qty=o.qty,
                           tick=o.tick, limit_price=o.limit_price, stop_price=o.stop_price, cancelled_tick=o.cancelled_tick,
                           client_order_id=o.client_order_id) for o in loaded.orders]
    try:
        return engine.replay(loaded.scenario, loaded.game.seed, participants, orders, -1 if never_started(loaded) else tick)
    except engine.ReplayError:
        raise HTTPException(409, 'This match can no longer be replayed') from None


def f2(value):
    return float(money(value))


def _bar(bar):
    return {'t': bar.t, 'o': f2(bar.o), 'h': f2(bar.h), 'l': f2(bar.l), 'c': f2(bar.c), 'v': bar.v}


def _news(item):
    return {'id': item['id'], 't': item['tick'], 'headline': item['headline'], 'body': item['body'],
            'symbols': item['symbols'], 'tone': item['tone'], 'kind': item.get('kind', 'company')}


def _order(order):
    return {'id': order.id, 'client_order_id': order.client_order_id, 'symbol': order.symbol, 'side': order.side,
            'type': order.type, 'qty': order.qty, 'status': order.status, 'tick': order.tick,
            'limit_price': None if order.limit_price is None else f2(order.limit_price),
            'stop_price': None if order.stop_price is None else f2(order.stop_price)}


def leaderboard(loaded, match):
    bots = load_bots()
    people = {p.id: p for p in loaded.participants}
    entries = []
    for entry in match.leaderboard():
        person = people[entry['participant_id']]
        bot = bots.get(person.bot_id) if person.bot_id else None
        entries.append({'participant_id': person.id, 'name': person.display_name, 'kind': 'bot' if bot else 'human',
                        'bot_id': person.bot_id, 'avatar': bot['avatar'] if bot else None, 'style': bot['style'] if bot else None,
                        'tier': bot.get('tier') if bot else None,
                        'profit': f2(entry['profit']), 'rank': entry['rank'], 'is_me': person.id == loaded.me.id,
                        'forfeited': match.participants[person.id].forfeited})
    return entries


def player(loaded, match):
    pid = loaded.me.id
    book = match.books[pid]
    closes = match.closes()
    profit = match.profit(pid)
    positions = [{'symbol': s, 'qty': book.qty(s), 'avg_price': f2(book.avg_price(s)), 'value': f2(book.qty(s) * closes[s]),
                  'unrealized': f2((closes[s] - book.avg_price(s)) * book.qty(s))} for s in match.symbols if book.qty(s)]
    fills = [{'order_id': f.order_id, 't': f.t, 'symbol': f.symbol, 'side': f.side, 'qty': f.qty, 'price': f2(f.price), 'fee': f2(f.fee)}
             for f in book.fills]
    return {'participant_id': pid, 'cash': f2(book.cash), 'available_cash': f2(book.available_cash()),
            'equity': f2(match.equity(pid)), 'profit': f2(profit), 'profit_pct': f2(profit / match.rules.starting_cash * HUNDRED),
            'positions': positions, 'orders': [_order(o) for o in book.orders.values()], 'fills': fills,
            'max_drawdown_pct': f2(book.max_drawdown_pct), 'plan': loaded.me.plan}


def public_state(loaded, match, tick, at, since=None):
    game, scenario = loaded.game, loaded.scenario
    visible = match.processed
    newer = (lambda t: True) if since is None else (lambda t: t > since)
    assets = []
    for asset in scenario['assets']:
        close, previous = match.bar(asset['symbol'], visible).c, match.bar(asset['symbol'], visible - 1).c
        assets.append({'symbol': asset['symbol'], 'name': asset['name'], 'sector': asset['sector'], 'blurb': asset['blurb'],
                       'price': f2(close), 'change_pct': f2((close / previous - 1) * HUNDRED)})
    status = status_of(loaded, tick)
    return {
        'id': game.id, 'mode': game.mode, 'chapter_id': game.chapter_id, 'level_id': game.level_id, 'boss': game.boss,
        'status': status, 'tick': tick, 'ticks': scenario['ticks'],
        'tick_label': scenario['tick_label'], 'tick_ms': game.clock['tick_ms'], 'speed': game.clock['speed'],
        'paused': game.clock['paused'], 'server_time': at,
        'next_tick_at': clock.next_tick_at(game.clock, scenario['ticks'], at) if status == 'running' else None,
        'scenario': {key: scenario[key] for key in ('id', 'title', 'briefing', 'objective', 'difficulty', 'starting_cash', 'tools',
                                                    'allow', 'max_position_pct', 'fee', 'spread')},
        'assets': assets,
        'bars': {s: [_bar(b) for b in match.bars[s][:visible + match.offset + 1] if newer(b.t)] for s in match.symbols},
        'news': [_news(n) for n in scenario['news'] if n['tick'] <= visible and newer(n['tick'])],
        'me': player(loaded, match),
        'leaderboard': leaderboard(loaded, match),
        'missions': objectives.evaluate(match, loaded.me.id, loaded.me.plan, final=status in ('ended', 'settled')),
        'result': loaded.me.result,
    }


def observed(match, pid, tick):
    """The decision context a player saw, stored with each command for research."""
    book = match.books[pid]
    closes = match.closes()
    headlines = [n['id'] for n in match.scenario['news'] if n['tick'] <= match.processed]
    return {'tick': tick, 'prices': {s: f2(c) for s, c in closes.items()}, 'cash': f2(book.cash),
            'available_cash': f2(book.available_cash()), 'equity': f2(match.equity(pid)),
            'positions': {s: {'qty': book.qty(s), 'avg_price': f2(book.avg_price(s))} for s in book.held()},
            'open_orders': sum(1 for o in book.orders.values() if o.status == 'open'),
            'latest_headline': headlines[-1] if headlines else None}


def log(db, loaded, tick, kind, payload):
    db.add(GameEvent(game_id=loaded.game.id, participant_id=loaded.me.id, tick=tick, kind=kind, payload=payload))


async def state(db, profile, game_id, since=None):
    loaded = await load(db, profile, game_id)
    at = clock.now_ms()
    tick = current_tick(loaded, at)
    return public_state(loaded, build(loaded, tick), tick, at, since)


def _multiplayer_plan_problem(loaded, tick):
    if loaded.me.forfeited or loaded.me.result is not None:
        return 'You left this match, so you can no longer set a plan.'
    if status_of(loaded, tick) != 'running' or tick >= PLAN_DAYS:
        return f'The game plan must be set in the first {PLAN_DAYS} days of the match.'
    return None


async def start(db, profile, game_id, plan, check=before_start):
    """Solo: leave the briefing (after the `check` hook). Multiplayer: set the plan once, during the first PLAN_DAYS days."""
    loaded = await load(db, profile, game_id, lock=True)
    at = clock.now_ms()
    game = loaded.game
    if game.mode in MULTIPLAYER_MODES:
        if loaded.me.plan is None:
            tick = current_tick(loaded, at)
            problem = _multiplayer_plan_problem(loaded, tick)
            if problem:
                raise HTTPException(409, problem)
            loaded.me.plan = plan
            log(db, loaded, tick, 'plan', {'plan': plan})
    elif game.status == 'briefing':
        await check(db, profile, game)
        attempt = await db.scalar(select(func.count()).select_from(GameParticipant).join(Game, Game.id == GameParticipant.game_id)
                                  .where(GameParticipant.user_id == profile.id, Game.scenario_id == game.scenario_id, Game.status != 'briefing'))
        loaded.me.plan = plan
        game.status = 'running'
        game.clock = clock.start(at)
        log(db, loaded, 0, 'start', {'plan': plan, 'attempt': attempt + 1, 'mode': game.mode, 'scenario_id': game.scenario_id,
                                     'scenario_version': game.scenario_version, 'difficulty': loaded.scenario['difficulty'],
                                     'context': game.context})
    await db.flush()
    tick = current_tick(loaded, at)
    return public_state(loaded, build(loaded, tick), tick, at)


async def control_clock(db, profile, game_id, action, speed=None):
    loaded = await load(db, profile, game_id, lock=True)
    game, ticks = loaded.game, loaded.scenario['ticks']
    if game.mode in MULTIPLAYER_MODES:
        raise HTTPException(403, 'The clock cannot be paused or changed in multiplayer matches')
    at = clock.now_ms()
    tick = current_tick(loaded, at)
    if status_of(loaded, tick) != 'running' or loaded.me.forfeited:
        raise HTTPException(409, 'The match is not running')
    if action == 'pause':
        game.clock = clock.pause(game.clock, ticks, at)
    elif action == 'resume':
        game.clock = clock.resume(game.clock, ticks, at)
    elif action == 'step':
        if not game.clock['paused']:
            raise HTTPException(409, 'Pause the match before moving to the next day')
        game.clock = clock.step(game.clock, ticks, at)
    else:
        game.clock = clock.set_speed(game.clock, ticks, speed, at)
    log(db, loaded, tick, 'clock', {'action': action, 'speed': game.clock['speed'], 'paused': game.clock['paused']})
    await db.flush()
    tick = current_tick(loaded, at)
    return public_state(loaded, build(loaded, tick), tick, at)


def _same_order(row, body, limit, stop):
    return (row.symbol, row.side, row.type, row.qty, row.limit_price, row.stop_price) == (body.symbol, body.side, body.type, body.qty, limit, stop)


def _cents(value):
    return None if value is None else money(Decimal(str(value)))


def _trading_problem(loaded, tick):
    if loaded.game.status == 'briefing':
        return 'Start the match before trading.'
    if loaded.me.forfeited or loaded.me.result is not None:
        return 'You left this match, so you can no longer trade.'
    if status_of(loaded, tick) != 'running':
        return 'This match has ended.'
    if loaded.me.plan is None:
        return 'Choose your game plan before trading.'
    return None


async def place_order(db, profile, game_id, body):
    """Return (order, state). Raises Rejected after logging when a rule is broken."""
    loaded = await load(db, profile, game_id, lock=True)
    at = clock.now_ms()
    tick = current_tick(loaded, at)
    limit, stop = _cents(body.limit_price), _cents(body.stop_price)
    previous = next((o for o in loaded.orders if o.participant_id == loaded.me.id and o.client_order_id == body.client_order_id), None)
    if previous is not None:
        if not _same_order(previous, body, limit, stop):
            raise HTTPException(409, 'This order id was already used for a different order')
        match = build(loaded, tick)
        return _order(match.books[loaded.me.id].orders[previous.id]), public_state(loaded, match, tick, at)
    request = body.model_dump()
    problem = _trading_problem(loaded, tick)
    price = limit if limit is not None else stop
    if problem is None and price is not None and price <= 0:
        problem = 'Use a price of at least $0.01.'
    match = build(loaded, tick)
    context = observed(match, loaded.me.id, tick)
    order = engine.Order(id=uid(), participant_id=loaded.me.id, symbol=body.symbol, side=body.side, type=body.type, qty=body.qty,
                         tick=tick, limit_price=limit, stop_price=stop, client_order_id=body.client_order_id)
    if problem is None:
        try:
            match.place(order)
        except engine.OrderRejected as error:
            problem = str(error)
    if problem is not None:
        log(db, loaded, tick, 'rejected', {'order': request, 'reason': problem, 'observed': context})
        raise Rejected(problem)
    seq = 1 + sum(1 for o in loaded.orders if o.participant_id == loaded.me.id)
    row = GameOrder(id=order.id, game_id=loaded.game.id, participant_id=loaded.me.id, client_order_id=body.client_order_id, seq=seq,
                    tick=tick, symbol=body.symbol, side=body.side, type=body.type, qty=body.qty, limit_price=limit, stop_price=stop)
    db.add(row)
    log(db, loaded, tick, 'order', {'order_id': order.id, 'order': request, 'status': order.status, 'observed': context})
    await db.flush()
    loaded.orders = sorted([*loaded.orders, row], key=lambda o: (o.participant_id, o.seq))
    replayed = build(loaded, tick)
    return _order(replayed.books[loaded.me.id].orders[order.id]), public_state(loaded, replayed, tick, at)


async def cancel_order(db, profile, game_id, order_id):
    loaded = await load(db, profile, game_id, lock=True)
    at = clock.now_ms()
    tick = current_tick(loaded, at)
    row = next((o for o in loaded.orders if o.id == order_id and o.participant_id == loaded.me.id), None)
    if row is None:
        raise HTTPException(404, 'Order not found')
    match = build(loaded, tick)
    if row.cancelled_tick is None:
        problem = _trading_problem(loaded, tick)
        if problem:
            raise HTTPException(409, problem)
        context = observed(match, loaded.me.id, tick)
        try:
            match.cancel(loaded.me.id, row.id, tick)
        except engine.OrderRejected as error:
            raise HTTPException(409, str(error)) from None
        row.cancelled_tick = tick
        log(db, loaded, tick, 'cancel', {'order_id': row.id, 'observed': context})
        await db.flush()
    return public_state(loaded, match, tick, at)


def compute_result(loaded, match):
    """The engine result for the current participant, before the settle hook adds rewards."""
    pid, plan = loaded.me.id, loaded.me.plan
    book = match.books[pid]
    board = leaderboard(loaded, match)
    mine = next(entry for entry in board if entry['is_me'])
    forfeited = match.participants[pid].forfeited
    won = not forfeited and len(board) > 1 and mine['rank'] == 1 and sum(1 for entry in board if entry['rank'] == 1) == 1
    plan_review = None if not plan else {
        'strategy': plan['strategy'], 'max_loss_pct': plan['max_loss_pct'], 'worst_drawdown_pct': f2(book.max_drawdown_pct),
        'kept_loss_limit': book.max_drawdown_pct <= Decimal(str(plan['max_loss_pct']))}
    profit = match.profit(pid)
    missions = objectives.evaluate(match, pid, plan, final=True)
    breakdown, weights = review.decision_breakdown(match, pid, plan, missions)
    return {'won': won, 'rank': mine['rank'], 'of': len(board), 'forfeited': forfeited, 'profit': f2(profit),
            'profit_pct': f2(profit / match.rules.starting_cash * HUNDRED), 'leaderboard': board,
            'missions': missions, 'plan_review': plan_review,
            'decision_score': sum(breakdown.values()), 'decision_breakdown': breakdown, 'decision_max': weights,
            'key_moments': review.key_moments(match, pid),
            'stats': {'trades': len(book.fills), 'fees': f2(book.fees), 'biggest_position_pct': f2(book.biggest_position_pct),
                      'max_drawdown_pct': f2(book.max_drawdown_pct), 'buy_hold_profit': f2(match.buy_hold_profit())},
            'debrief': loaded.scenario['debrief'], 'reflection': None}


def stale_result(loaded, reflection):
    """A closed match whose scenario changed: no replay, no rewards, ranked last."""
    count = len(loaded.participants)
    zero = {key: 0 for key in review.PARTS}
    return {'won': False, 'rank': count, 'of': count, 'forfeited': True, 'profit': 0.0, 'profit_pct': 0.0, 'leaderboard': [],
            'missions': [], 'plan_review': None, 'decision_score': 0, 'decision_breakdown': zero, 'decision_max': zero,
            'key_moments': [], 'stats': {'trades': 0, 'fees': 0.0, 'biggest_position_pct': 0.0, 'max_drawdown_pct': 0.0, 'buy_hold_profit': 0.0},
            'debrief': STALE_DEBRIEF, 'reflection': reflection or None, 'rewards': dict(NO_REWARDS), 'stars': None, 'unlocked': None}


def _settle_if_complete(loaded):
    if all(p.result is not None for p in loaded.participants if p.user_id):
        loaded.game.status, loaded.game.settled_at = 'settled', now()


async def finish(db, profile, game_id, forfeit, reflection, settle):
    loaded = await load(db, profile, game_id, lock=True, allow_stale=True)
    me, game = loaded.me, loaded.game
    if me.result is not None:
        if reflection and not me.result.get('reflection'):
            me.result = {**me.result, 'reflection': reflection}
            log(db, loaded, loaded.scenario['ticks'] if loaded.scenario else 0, 'reflection', {'reflection': reflection})
            await db.flush()
        return me.result
    if loaded.stale:
        me.forfeited, me.result = True, stale_result(loaded, reflection)
        _settle_if_complete(loaded)
        log(db, loaded, game.clock.get('anchor_tick', 0), 'finish', {'forfeit': True, 'stale': True, 'reflection': reflection})
        await db.flush()
        return me.result
    at = clock.now_ms()
    tick = current_tick(loaded, at)
    ended = status_of(loaded, tick) == 'ended'
    if not forfeit and not ended:
        raise HTTPException(409, 'The match is still running. Finish after the last day or forfeit.')
    forfeit = forfeit and not ended
    match = build(loaded, tick)
    if forfeit:
        me.forfeited = True
        match.participants[me.id].forfeited = True
        for row in loaded.orders:
            if row.participant_id == me.id and match.books[me.id].orders[row.id].status == 'open':
                match.cancel(me.id, row.id, tick)
                row.cancelled_tick = tick
        if game.mode in SOLO_MODES and game.status == 'running':
            game.clock = clock.pause(game.clock, loaded.scenario['ticks'], at)
    result = {**compute_result(loaded, match), 'reflection': reflection or None}
    result = {**result, **await settle(db, profile, game, me, result)}
    me.result = result
    _settle_if_complete(loaded)
    log(db, loaded, tick, 'finish', {'forfeit': forfeit, 'reflection': reflection, 'rank': result['rank'], 'of': result['of'],
                                     'won': result['won'], 'profit': result['profit'], 'observed': observed(match, me.id, tick)})
    await db.flush()
    return result


async def stored_result(db, profile, game_id):
    loaded = await load(db, profile, game_id, allow_stale=True)
    if loaded.me.result is None:
        raise HTTPException(404, 'This match has not been settled yet')
    return loaded.me.result


def game_status(game, scenario, at):
    """(tick, status) of a stored match without replaying it."""
    tick = 0 if game.status == 'briefing' else clock.current_tick(game.clock, scenario['ticks'], at)
    return tick, 'ended' if game.status == 'running' and tick >= scenario['ticks'] else game.status


async def active_games(db, profile):
    """Unfinished matches the player can resume; matches whose scenario changed are left out."""
    rows = (await db.execute(select(Game, GameParticipant).join(GameParticipant, GameParticipant.game_id == Game.id)
                             .where(GameParticipant.user_id == profile.id, GameParticipant.result.is_(None), Game.status != 'settled')
                             .order_by(Game.created_at.desc()))).all()
    at = clock.now_ms()
    games = []
    for game, _ in rows:
        if is_stale(game):
            continue
        scenario = load_scenarios()[game.scenario_id]
        tick, status = game_status(game, scenario, at)
        games.append({'id': game.id, 'mode': game.mode, 'status': status, 'scenario_id': game.scenario_id, 'title': scenario['title'],
                      'tick': tick, 'ticks': scenario['ticks'], 'created_at': game.created_at})
    return {'games': games}
