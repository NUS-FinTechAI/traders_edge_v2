"""XP, wallet, owned cosmetics and activity days. Every write uses a natural unique key, so repeats award nothing."""

from datetime import date, datetime, time, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.db import LearningActivity, RewardGrant, XPLedger, aware, now
from app.economy_models import EconomyAccount, EconomyEvent

POLICY_VERSION = 'game-2'


def current():
    """The server clock for every progression rule."""
    return now()


def utc(instant):
    return aware(instant).astimezone(timezone.utc)


def day(instant):
    return utc(instant).date().isoformat()


def day_start(value):
    return datetime.combine(date.fromisoformat(value), time(), timezone.utc)


def week(instant):
    today = utc(instant).date()
    return (today - timedelta(days=today.weekday())).isoformat()


def week_ends_at(instant):
    return day_start(week(instant)) + timedelta(days=7)


def _insert(db):
    return {'sqlite': sqlite_insert, 'postgresql': postgresql_insert}[db.get_bind().dialect.name]


async def award_xp(db, user_id, key, amount, reason, instant):
    """Award `amount` XP once per key; returns the XP awarded now."""
    if amount <= 0 or await db.get(XPLedger, (user_id, key)):
        return 0
    db.add(XPLedger(user_id=user_id, event_key=key, amount=amount, reason=reason, created_at=instant))
    await db.flush()
    return amount


async def total_xp(db, user_id):
    return await db.scalar(select(func.coalesce(func.sum(XPLedger.amount), 0)).where(XPLedger.user_id == user_id))


async def record_activity(db, user_id, instant):
    await db.execute(_insert(db)(LearningActivity).values(user_id=user_id, day=day(instant))
                     .on_conflict_do_nothing(index_elements=[LearningActivity.user_id, LearningActivity.day]))


async def read_account(db, user_id):
    return await db.get(EconomyAccount, user_id)


async def account(db, user_id, instant):
    """Lock the wallet, creating it if needed. Doubloons from an earlier week expire here."""
    await db.execute(_insert(db)(EconomyAccount).values(user_id=user_id, stocks_week=week(instant), stocks_balance=0, premium_balance=0,
                                                        login_streak=0).on_conflict_do_nothing(index_elements=[EconomyAccount.user_id]))
    wallet = await db.scalar(select(EconomyAccount).where(EconomyAccount.user_id == user_id).with_for_update()
                             .execution_options(populate_existing=True))
    current = week(instant)
    if wallet.stocks_week > current:
        raise HTTPException(409, 'The wallet clock moved backwards; try again later')
    if wallet.stocks_week != current:
        db.add(EconomyEvent(user_id=user_id, event_key='expiry:' + current, policy_version=POLICY_VERSION, stocks_delta=-wallet.stocks_balance,
                            premium_delta=0, xp_delta=0, context={'expired_week': wallet.stocks_week}, response={}, created_at=instant))
        wallet.stocks_week, wallet.stocks_balance = current, 0
        await db.flush()
    return wallet


def doubloons(wallet, instant):
    return wallet.stocks_balance if wallet and wallet.stocks_week == week(instant) else 0


async def credit(db, user_id, key, instant, stocks=0, gems=0, context=None):
    """Apply a wallet change once per key. Returns False when the key was already used."""
    if await db.get(EconomyEvent, (user_id, key)):
        return False
    wallet = await account(db, user_id, instant)
    if wallet.stocks_balance + stocks < 0 or wallet.premium_balance + gems < 0:
        raise HTTPException(409, 'Not enough Doubloons or Gems')
    wallet.stocks_balance += stocks
    wallet.premium_balance += gems
    db.add(EconomyEvent(user_id=user_id, event_key=key, policy_version=POLICY_VERSION, stocks_delta=stocks, premium_delta=gems,
                        xp_delta=0, context=context or {}, response={}, created_at=instant))
    await db.flush()
    return True


async def event(db, user_id, key):
    return await db.get(EconomyEvent, (user_id, key))


async def owned(db, user_id):
    rows = await db.execute(select(RewardGrant.item_id, RewardGrant.created_at).where(RewardGrant.user_id == user_id))
    return {item_id: created_at for item_id, created_at in rows}


async def grant(db, user_id, item_id, cosmetics, evidence, instant):
    """Grant a catalog item once; returns its reward entry when newly granted."""
    if await db.get(RewardGrant, (user_id, item_id)):
        return None
    reward = cosmetics.reward(item_id)
    db.add(RewardGrant(user_id=user_id, item_id=item_id, rule_version=POLICY_VERSION, public_snapshot=reward, evidence=evidence,
                       created_at=instant))
    await db.flush()
    return reward
