"""Daily challenge: weekday rotation, the day's shared seed, cooldown and Gem refresh."""

from datetime import timedelta
import hashlib

from fastapi import HTTPException
from sqlalchemy import func, select

from app.economy_models import EconomyEvent
from app.game.models import Game
from app.game.scenario import load_bots, load_scenarios
from app.player import ledger

ROTATION = ('daily-mon-steady-climb', 'daily-tue-range-chop', 'daily-wed-pullback-uptrend', 'daily-thu-earnings-gap',
            'daily-fri-breakout-fakeout', 'daily-sat-news-shock', 'daily-sun-bubble-crash')
COOLDOWN = timedelta(hours=2)
REFRESH_GEMS = 20
WIN_STOCKS = 200
WEEKLY_TARGET = 1000
LOCKED_REASON = 'Win the Chapter 1 boss to unlock the daily challenge'


def scenario_for(instant):
    return ROTATION[ledger.utc(instant).weekday()]


def shared_seed(day):
    return int(hashlib.sha256(f'daily:{day}'.encode()).hexdigest()[:8], 16) % 2**31


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


async def attempts_today(db, user_id, instant):
    return await db.scalar(select(func.count()).select_from(Game).where(
        Game.host_user_id == user_id, Game.mode == 'daily', Game.context['day'].as_string() == ledger.day(instant)))


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
    return {
        'date': today, 'unlocked': is_unlocked, 'locked_reason': None if is_unlocked else LOCKED_REASON,
        'scenario': {key: scenario[key] for key in ('id', 'title', 'briefing', 'ticks')},
        'opponent': {'bot_id': bot_id, 'name': bot['name'], 'avatar': bot['avatar'], 'tier': bot.get('tier', ''), 'style': bot['style']},
        'won_today': await ledger.event(db, user_id, f'daily-win:{today}') is not None,
        'attempts_today': await attempts_today(db, user_id, instant),
        'cooldown_until': cooldown.isoformat() if cooldown else None, 'refresh_cost_gems': REFRESH_GEMS,
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


async def resolve(db, profile, progress, instant):
    if not unlocked(progress):
        raise HTTPException(403, LOCKED_REASON)
    scenario = today_scenario(instant)
    wallet = await ledger.account(db, profile.id, instant)
    until = active_cooldown(wallet, instant)
    if until is not None:
        raise HTTPException(409, f'Next daily try at {until:%H:%M} UTC, or skip the wait for {REFRESH_GEMS} Gems')
    today = ledger.day(instant)
    attempt = await attempts_today(db, profile.id, instant) + 1
    context = {'day': today, 'attempt': attempt, 'refresh_event_key': wallet.pending_refresh_event_key}
    if attempt == 1:
        context['seed'] = shared_seed(today)
    wallet.pending_refresh_event_key = None
    return scenario['id'], context


async def settle(db, user_id, game, result, instant):
    """Returns (xp, stocks). A finished daily earns XP once a day; the first win earns Doubloons; a loss starts the cooldown."""
    today = game.context.get('day') or ledger.day(instant)
    xp = stocks = 0
    if not result['forfeited']:
        xp += await ledger.award_xp(db, user_id, f'daily-finished:{today}', 15, 'Daily challenge finished', instant)
    if result['won']:
        xp += await ledger.award_xp(db, user_id, f'daily-won:{today}', 15, 'Daily challenge won', instant)
        if await ledger.credit(db, user_id, f'daily-win:{today}', instant, stocks=WIN_STOCKS, context={'game_id': game.id}):
            stocks = WIN_STOCKS
    else:
        wallet = await ledger.account(db, user_id, instant)
        wallet.daily_cooldown_until = instant + COOLDOWN
        await db.flush()
    return xp, stocks
