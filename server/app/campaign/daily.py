"""Daily challenge: weekday rotation, the day's shared seed, one open daily at a time, cooldown and Gem refresh."""

from datetime import timedelta
import secrets

from fastapi import HTTPException
from sqlalchemy import func, select

from app.campaign.models import DailySeed
from app.economy_models import EconomyEvent
from app.game import clock, service
from app.game.models import Game, GameParticipant
from app.game.scenario import load_bots, load_scenarios
from app.player import ledger

ROTATION = ('daily-mon-steady-climb', 'daily-tue-range-chop', 'daily-wed-pullback', 'daily-thu-earnings-gap',
            'daily-fri-breakout-fakeout', 'daily-sat-news-shock', 'daily-sun-bubble-crash')
COOLDOWN = timedelta(hours=2)
REFRESH_GEMS = 20
WIN_STOCKS = 200
WEEKLY_TARGET = 1000
LOCKED_REASON = 'Win the Chapter 1 boss to unlock the daily challenge'
OPEN_DAILY = 'Finish your current daily challenge first'
EXPIRED = 'This daily challenge has expired'


def scenario_for(instant):
    return ROTATION[ledger.utc(instant).weekday()]


async def shared_seed(db, day):
    """The day's shared seed: random, drawn on first use and stored, so it cannot be derived from the date."""
    await db.execute(ledger._insert(db)(DailySeed).values(day=day, seed=secrets.randbits(31), created_at=ledger.current())
                     .on_conflict_do_nothing(index_elements=[DailySeed.day]))
    return await db.scalar(select(DailySeed.seed).where(DailySeed.day == day))


def unlocked(progress):
    return progress.won(progress.campaign.chapters[0]['id'], 'boss')


def active_cooldown(wallet, instant):
    """A loss cooldown from an earlier UTC day never blocks today's daily."""
    if wallet is None or wallet.daily_cooldown_until is None:
        return None
    until = ledger.utc(wallet.daily_cooldown_until)
    if until <= instant or ledger.day(until - COOLDOWN) != ledger.day(instant):
        return None
    return until


def cooldown_message(until):
    return f'Next daily try at {until:%H:%M} UTC, or skip the wait for {REFRESH_GEMS} Gems'


async def attempts_today(db, user_id, instant):
    return await db.scalar(select(func.count()).select_from(Game).where(
        Game.host_user_id == user_id, Game.mode == 'daily', Game.context['day'].as_string() == ledger.day(instant)))


async def unsettled(db, user_id):
    """The player's unsettled dailies that can still be replayed, newest first, with (tick, status) on the match clock."""
    games = await db.scalars(select(Game).join(GameParticipant, GameParticipant.game_id == Game.id).where(
        Game.host_user_id == user_id, Game.mode == 'daily', Game.status != 'settled', GameParticipant.user_id == user_id,
        GameParticipant.result.is_(None)).order_by(Game.created_at.desc(), Game.id))
    at = clock.now_ms()
    return [(game, *service.game_status(game, load_scenarios()[game.scenario_id], at)) for game in games if not service.is_stale(game)]


async def open_daily(db, user_id, instant):
    """Today's unsettled daily (briefing, running or ended but not finished), if any."""
    today = ledger.day(instant)
    return next((game for game, _, _ in await unsettled(db, user_id) if game.context.get('day') == today), None)


async def wins_this_week(db, user_id, instant):
    first = ledger.week(instant)
    return await db.scalar(select(func.count()).select_from(EconomyEvent).where(
        EconomyEvent.user_id == user_id, EconomyEvent.event_key >= f'daily-win:{first}', EconomyEvent.event_key < 'daily-win:~'))


def today_scenario(instant):
    scenario = load_scenarios().get(scenario_for(instant))
    if scenario is None or not scenario['bots']:
        raise HTTPException(503, "Today's daily challenge is not available yet")
    return scenario


async def view(db, user_id, progress, instant):
    scenario = today_scenario(instant)
    bot_id = scenario['bots'][0]
    bot = load_bots()[bot_id]
    wallet = await ledger.read_account(db, user_id)
    cooldown = active_cooldown(wallet, instant)
    today = ledger.day(instant)
    is_unlocked = unlocked(progress)
    current = await open_daily(db, user_id, instant)
    return {
        'date': today, 'unlocked': is_unlocked, 'locked_reason': None if is_unlocked else LOCKED_REASON,
        'scenario': {key: scenario[key] for key in ('id', 'title', 'briefing', 'ticks')},
        'opponent': {'bot_id': bot_id, 'name': bot['name'], 'avatar': bot['avatar'], 'tier': bot.get('tier', ''), 'style': bot['style']},
        'won_today': await ledger.event(db, user_id, f'daily-win:{today}') is not None,
        'attempts_today': await attempts_today(db, user_id, instant),
        'cooldown_until': cooldown.isoformat() if cooldown else None, 'refresh_cost_gems': REFRESH_GEMS,
        'active_game_id': current.id if current else None,
        'week': {'doubloons': ledger.doubloons(wallet, instant), 'target': WEEKLY_TARGET,
                 'resets_at': ledger.week_ends_at(instant).isoformat(), 'wins_this_week': await wins_this_week(db, user_id, instant)},
    }


async def refresh(db, user_id, instant):
    wallet = await ledger.account(db, user_id, instant)
    until = active_cooldown(wallet, instant)
    if until is None:
        raise HTTPException(409, 'There is no cooldown to skip right now')
    if wallet.premium_balance < REFRESH_GEMS:
        raise HTTPException(409, f'You need {REFRESH_GEMS} Gems to skip the cooldown')
    key = f'daily-refresh:{until.isoformat()}'
    await ledger.credit(db, user_id, key, instant, gems=-REFRESH_GEMS, context={'cooldown_until': until.isoformat()})
    wallet.daily_cooldown_until = None
    wallet.pending_refresh_event_key = key
    await db.flush()


async def resolve(db, profile, progress, instant, settle):
    """Today's scenario and context. Dailies that ended unfinished are settled first, so a loss starts its cooldown.

    Refusals are `service.Refused`, which keeps those settlements.
    """
    if not unlocked(progress):
        raise HTTPException(403, LOCKED_REASON)
    scenario = today_scenario(instant)
    today = ledger.day(instant)
    current = None
    for game, _, status in await unsettled(db, profile.id):
        if status == 'ended':
            await service.finish(db, profile, game.id, False, None, settle)
        elif game.context.get('day') == today:
            current = current or game
    if current is not None:
        raise service.Refused(409, OPEN_DAILY)
    wallet = await ledger.account(db, profile.id, instant)
    until = active_cooldown(wallet, instant)
    if until is not None:
        raise service.Refused(409, cooldown_message(until))
    attempt = await attempts_today(db, profile.id, instant) + 1
    context = {'day': today, 'attempt': attempt, 'refresh_event_key': wallet.pending_refresh_event_key}
    if attempt == 1:
        context['seed'] = await shared_seed(db, today)
    wallet.pending_refresh_event_key = None
    return scenario['id'], context


async def check_start(db, user_id, game, instant):
    """A daily starts only on the UTC day it was created for and outside a cooldown."""
    if game.context.get('day') != ledger.day(instant):
        raise HTTPException(409, EXPIRED)
    until = active_cooldown(await ledger.read_account(db, user_id), instant)
    if until is not None:
        raise HTTPException(409, cooldown_message(until))


async def settle(db, user_id, game, result, instant):
    """Returns (xp, stocks). A finished daily earns XP once a day; the first win earns Doubloons; a loss on today's daily starts the cooldown."""
    today = game.context.get('day') or ledger.day(instant)
    xp = stocks = 0
    if not result['forfeited']:
        xp += await ledger.award_xp(db, user_id, f'daily-finished:{today}', 15, 'Daily challenge finished', instant)
    if result['won']:
        xp += await ledger.award_xp(db, user_id, f'daily-won:{today}', 15, 'Daily challenge won', instant)
        if await ledger.credit(db, user_id, f'daily-win:{today}', instant, stocks=WIN_STOCKS, context={'game_id': game.id}):
            stocks = WIN_STOCKS
    elif today == ledger.day(instant):
        wallet = await ledger.account(db, user_id, instant)
        wallet.daily_cooldown_until = instant + COOLDOWN
        await db.flush()
    return xp, stocks
