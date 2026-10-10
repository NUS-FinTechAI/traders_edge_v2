"""Versioned game currency, separate from simulated trading funds and learning days."""

from copy import deepcopy
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta, timezone
import hashlib
import json
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.db import RewardGrant, XPLedger, aware, now
from app.economy_models import EconomyAccount, EconomyCommand, EconomyEvent
from app.learning import DB, Payload, User

router = APIRouter(prefix='/api/me/economy')
POLICY_VERSION = '1'
DAILY_VICTORY_STOCKS = 200
LOGIN_STOCKS = 20
LOGIN_XP = 5
REFRESH_PREMIUM = 10


@dataclass(frozen=True)
class ShopItem:
    id: str
    kind: str
    name: str
    currency: str
    price: int
    weekly: bool = False


SHOP = (
    ShopItem('title-colossal-challenger', 'title', 'Colossal Challenger', 'stocks', 1000, True),
    ShopItem('avatar-market-observer', 'avatar', 'Market observer', 'premium', 100),
)


@dataclass(frozen=True)
class ServerChallengeResult:
    """Construct only from a persisted server result, never from an HTTP payload."""

    attempt_id: str
    mode: Literal['practice', 'daily', 'chapter_entry', 'chapter_exit', 'public_ranked', 'private']
    won: bool
    completed_at: datetime
    chapter_id: str | None = None
    abandoned: bool = False
    challenge_day: str | None = None


class Command(Payload):
    idempotency_key: str = Field(min_length=8, max_length=100, pattern=r'^[a-zA-Z0-9_-]+$')
    policy_version: Literal['1'] = '1'


class Purchase(Command):
    item_id: str = Field(min_length=1, max_length=120)


def utc(value):
    return aware(value).astimezone(timezone.utc)


def week(value):
    day = utc(value).date()
    return (day - timedelta(days=day.weekday())).isoformat()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def wallet(account, instant):
    current_week = week(instant)
    cooldown = aware(account.daily_cooldown_until) if account and account.daily_cooldown_until else None
    last_day = date.fromisoformat(account.login_last_day) if account and account.login_last_day else None
    today = utc(instant).date()
    streak = account.login_streak if last_day and last_day >= today - timedelta(days=1) else 0
    return {
        'policy_version': POLICY_VERSION, 'timezone': 'UTC', 'stocks_week': current_week,
        'stocks_expires_at': (date.fromisoformat(current_week) + timedelta(days=7)).isoformat() + 'T00:00:00+00:00',
        'stocks_balance': account.stocks_balance if account and account.stocks_week == current_week else 0,
        'premium_balance': account.premium_balance if account else 0,
        'login_last_day': account.login_last_day if account else None, 'login_streak_days': streak,
        'daily_cooldown_until': cooldown.isoformat() if cooldown and cooldown > instant else None,
        'simulated_trading_funds': 'Stored in each simulation session; never spendable here',
    }


async def locked_account(db, user_id, instant):
    # Atomic creation handles two workers encountering a profile with no wallet.
    insert = {'sqlite': sqlite_insert, 'postgresql': postgresql_insert}[db.get_bind().dialect.name]
    await db.execute(insert(EconomyAccount).values(
        user_id=user_id, stocks_week=week(instant), stocks_balance=0, premium_balance=0,
        login_streak=0).on_conflict_do_nothing(index_elements=[EconomyAccount.user_id]))
    account = await db.scalar(select(EconomyAccount).where(EconomyAccount.user_id == user_id)
                              .with_for_update().execution_options(populate_existing=True))
    current_week = week(instant)
    if account.stocks_week > current_week:
        raise HTTPException(409, 'The wallet clock moved backwards; retry after the clock is corrected')
    if account.stocks_week != current_week:
        expired = account.stocks_balance
        old_week = account.stocks_week
        account.stocks_week = current_week
        account.stocks_balance = 0
        db.add(EconomyEvent(user_id=user_id, event_key='expiry:' + current_week,
                            policy_version=POLICY_VERSION, stocks_delta=-expired, premium_delta=0,
                            xp_delta=0, context={'expired_week': old_week}, response={}, created_at=instant))
        await db.flush()
    return account


async def replay(db, user_id, body, operation):
    request_hash = digest({'operation': operation, 'payload': body.model_dump(exclude={'idempotency_key'})})
    command = await db.get(EconomyCommand, (user_id, body.idempotency_key))
    if command and command.request_hash != request_hash:
        raise HTTPException(409, 'This idempotency key was already used for a different economy command')
    return request_hash, deepcopy(command.response) if command else None


async def remember(db, user_id, body, request_hash, response):
    db.add(EconomyCommand(user_id=user_id, key=body.idempotency_key, request_hash=request_hash,
                          response=deepcopy(response)))
    await db.flush()
    return response


async def game_xp(db, user_id, key, amount):
    if not amount or await db.get(XPLedger, (user_id, key)):
        return 0
    db.add(XPLedger(user_id=user_id, event_key=key, amount=amount, reason='Game participation reward'))
    await db.flush()
    return amount


async def daily_can_start(db, profile, instant=None):
    instant = utc(instant or now())
    account = await db.get(EconomyAccount, profile.id)
    cooldown = aware(account.daily_cooldown_until) if account and account.daily_cooldown_until else None
    if cooldown and cooldown > instant:
        raise HTTPException(409, {'message': 'Daily challenge retry is cooling down',
                                  'retry_at': cooldown.isoformat(), 'refresh_premium_cost': REFRESH_PREMIUM})


async def consume_daily_refresh(db, profile, attempt_id):
    """Bind a paid refresh to the newly created daily attempt in its transaction."""
    key = 'refresh_used:' + attempt_id
    existing = await db.get(EconomyEvent, (profile.id, key))
    if existing:
        return existing.response['refresh_event_key']
    instant = utc(now())
    account = await locked_account(db, profile.id, instant)
    existing = await db.get(EconomyEvent, (profile.id, key))
    if existing:
        return existing.response['refresh_event_key']
    receipt = account.pending_refresh_event_key
    account.pending_refresh_event_key = None
    db.add(EconomyEvent(user_id=profile.id, event_key=key, policy_version=POLICY_VERSION,
                        stocks_delta=0, premium_delta=0, xp_delta=0,
                        context={'attempt_id': attempt_id, 'refresh_event_key': receipt},
                        response={'refresh_event_key': receipt}, created_at=instant))
    await db.flush()
    return receipt


async def settle_challenge(db, profile, result):
    """Settle inside the same transaction as the server-owned finished challenge."""
    if not isinstance(result, ServerChallengeResult):
        raise TypeError('Settlement requires a ServerChallengeResult')
    if result.mode not in {'practice', 'daily', 'chapter_entry', 'chapter_exit', 'public_ranked', 'private'}:
        raise ValueError('Unknown challenge mode')
    if result.mode.startswith('chapter_') and not result.chapter_id:
        raise ValueError('Chapter results require the server chapter identifier')
    instant = utc(now())
    context = asdict(result)
    context['completed_at'] = utc(result.completed_at).isoformat()
    result_hash = digest(context)
    key = 'challenge:' + result.attempt_id
    existing = await db.get(EconomyEvent, (profile.id, key))
    if existing:
        if existing.context.get('result_hash') != result_hash:
            raise HTTPException(409, 'The stored challenge settlement does not match this result')
        return deepcopy(existing.response)
    account = await locked_account(db, profile.id, instant)
    existing = await db.get(EconomyEvent, (profile.id, key))
    if existing:
        if existing.context.get('result_hash') != result_hash:
            raise HTTPException(409, 'The stored challenge settlement does not match this result')
        return deepcopy(existing.response)
    if utc(result.completed_at) > instant:
        raise ValueError('Challenge completion cannot be in the future')
    if result.abandoned and result.won:
        raise ValueError('An abandoned challenge cannot be a victory')
    day = utc(result.completed_at).date().isoformat()
    stocks = premium = amount = 0
    if result.mode == 'daily':
        amount = await game_xp(db, profile.id, 'game:daily:' + day, 20) if not result.abandoned else 0
        if result.won:
            victory_key = 'daily-victory:' + day
            dated_day = result.challenge_day or day
            date.fromisoformat(dated_day)
            if dated_day == day == instant.date().isoformat() and not await db.get(EconomyEvent, (profile.id, victory_key)):
                stocks = DAILY_VICTORY_STOCKS if week(result.completed_at) == week(instant) else 0
                db.add(EconomyEvent(user_id=profile.id, event_key=victory_key, policy_version=POLICY_VERSION,
                                    stocks_delta=stocks, premium_delta=0, xp_delta=0,
                                    context={'attempt_id': result.attempt_id, 'earned_week': week(result.completed_at)},
                                    response={}, created_at=instant))
        else:
            cooldown = utc(result.completed_at) + timedelta(hours=2)
            if not account.daily_cooldown_until or cooldown > aware(account.daily_cooldown_until):
                account.daily_cooldown_until = cooldown
    elif not result.abandoned and result.mode in {'chapter_entry', 'chapter_exit'}:
        amount = await game_xp(db, profile.id, f'game:{result.mode}:{result.chapter_id}', 20)
    elif not result.abandoned and result.mode == 'public_ranked':
        premium = 10 if result.won else 5
        amount = await game_xp(db, profile.id, 'game:ranked:' + result.attempt_id, 10)
    elif not result.abandoned and result.mode == 'practice':
        amount = await game_xp(db, profile.id, 'game:practice:' + result.attempt_id, 20)
    account.stocks_balance += stocks
    account.premium_balance += premium
    response = {'wallet': wallet(account, instant), 'awarded': {'stocks': stocks, 'premium': premium, 'xp': amount}}
    db.add(EconomyEvent(user_id=profile.id, event_key=key, policy_version=POLICY_VERSION,
                        stocks_delta=0, premium_delta=premium, xp_delta=amount,
                        context={**context, 'result_hash': result_hash}, response=deepcopy(response), created_at=instant))
    await db.flush()
    return response


@router.get('', operation_id='getEconomy')
async def read_wallet(db: DB, user: User):
    return wallet(await db.get(EconomyAccount, user.id), utc(now()))


@router.post('/login-claims', operation_id='claimLoginReward')
async def login_claim(body: Command, db: DB, user: User):
    request_hash, previous = await replay(db, user.id, body, 'login')
    if previous is not None:
        return previous
    instant = utc(now())
    account = await locked_account(db, user.id, instant)
    today = instant.date()
    key = 'login:' + today.isoformat()
    entry = await db.get(EconomyEvent, (user.id, key))
    if entry:
        response = deepcopy(entry.response)
    else:
        yesterday = (today - timedelta(days=1)).isoformat()
        account.login_streak = account.login_streak + 1 if account.login_last_day == yesterday else 1
        account.login_last_day = today.isoformat()
        account.stocks_balance += LOGIN_STOCKS
        amount = await game_xp(db, user.id, 'game:' + key, LOGIN_XP)
        response = {'wallet': wallet(account, instant), 'awarded': {'stocks': LOGIN_STOCKS, 'premium': 0, 'xp': amount}}
        db.add(EconomyEvent(user_id=user.id, event_key=key, policy_version=POLICY_VERSION,
                            stocks_delta=LOGIN_STOCKS, premium_delta=0, xp_delta=amount, context={},
                            response=deepcopy(response), created_at=instant))
    return await remember(db, user.id, body, request_hash, response)


@router.post('/daily-refresh', operation_id='refreshDailyChallenge')
async def refresh_daily(body: Command, db: DB, user: User):
    request_hash, previous = await replay(db, user.id, body, 'daily-refresh')
    if previous is not None:
        return previous
    instant = utc(now())
    account = await locked_account(db, user.id, instant)
    if not account.daily_cooldown_until or aware(account.daily_cooldown_until) <= instant:
        raise HTTPException(409, 'There is no active daily cooldown to refresh')
    if account.premium_balance < REFRESH_PREMIUM:
        raise HTTPException(409, 'Insufficient premium currency')
    previous_cooldown = aware(account.daily_cooldown_until).isoformat()
    account.premium_balance -= REFRESH_PREMIUM
    account.daily_cooldown_until = None
    account.pending_refresh_event_key = 'refresh:' + body.idempotency_key
    response = {'wallet': wallet(account, instant), 'spent': {'premium': REFRESH_PREMIUM}}
    db.add(EconomyEvent(user_id=user.id, event_key='refresh:' + body.idempotency_key,
                        policy_version=POLICY_VERSION, stocks_delta=0, premium_delta=-REFRESH_PREMIUM,
                        xp_delta=0, context={'cleared_cooldown_until': previous_cooldown},
                        response=deepcopy(response), created_at=instant))
    return await remember(db, user.id, body, request_hash, response)


def shop_snapshot(item, current_week):
    item_id = item.id + '-' + current_week if item.weekly else item.id
    return {'id': item_id, 'shop_id': item.id, 'kind': item.kind, 'name': item.name,
            'visual_key': item.id.replace('-', '.'), 'rule_version': 'economy-' + POLICY_VERSION,
            'currency': item.currency, 'price': item.price, 'week': current_week if item.weekly else None,
            'criteria': {'description': 'Purchased with earned game currency under economy policy 1'}}


@router.get('/shop', operation_id='getShop')
async def read_shop(db: DB, user: User):
    current_week = week(now())
    items = []
    for item in SHOP:
        public = shop_snapshot(item, current_week)
        public['status'] = 'owned' if await db.get(RewardGrant, (user.id, public['id'])) else 'available'
        items.append(public)
    return {'policy_version': POLICY_VERSION, 'items': items}


@router.post('/shop/purchases', operation_id='purchaseShopItem')
async def purchase(body: Purchase, db: DB, user: User):
    request_hash, previous = await replay(db, user.id, body, 'purchase')
    if previous is not None:
        return previous
    item = next((item for item in SHOP if item.id == body.item_id), None)
    if item is None:
        raise HTTPException(404, 'Shop item not found')
    instant = utc(now())
    account = await locked_account(db, user.id, instant)
    public = shop_snapshot(item, week(instant))
    grant = await db.get(RewardGrant, (user.id, public['id']))
    spent = 0
    if grant is None:
        slot = item.currency + '_balance'
        if getattr(account, slot) < item.price:
            raise HTTPException(409, 'Insufficient ' + item.currency + ' currency')
        setattr(account, slot, getattr(account, slot) - item.price)
        spent = item.price
        grant = RewardGrant(user_id=user.id, item_id=public['id'], rule_version=public['rule_version'],
                            public_snapshot=public, evidence=[{'type': 'game_currency_purchase',
                                                             'currency': item.currency, 'amount': item.price}],
                            created_at=instant)
        db.add(grant)
    response = {'item': deepcopy(grant.public_snapshot), 'wallet': wallet(account, instant),
                'spent': {item.currency: spent}}
    db.add(EconomyEvent(user_id=user.id, event_key='purchase:' + body.idempotency_key,
                        policy_version=POLICY_VERSION, stocks_delta=-spent if item.currency == 'stocks' else 0,
                        premium_delta=-spent if item.currency == 'premium' else 0, xp_delta=0,
                        context={'item_id': public['id']}, response=deepcopy(response), created_at=instant))
    return await remember(db, user.id, body, request_hash, response)
