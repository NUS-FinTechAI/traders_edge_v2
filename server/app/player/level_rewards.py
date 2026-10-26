"""Persistent level entitlements; claiming never awards XP."""

from fastapi import HTTPException
from sqlalchemy import select

from app.economy_models import EconomyEvent
from app.player import ledger
from app.player.levels import MAX_LEVEL, level_for


def amount(level):
    return min(30, 5 * (1 + (level - 1) // 5))


async def rewards(db, user_id):
    level = level_for(await ledger.total_xp(db, user_id))[0]
    claimed = set(await db.scalars(select(EconomyEvent.event_key).where(
        EconomyEvent.user_id == user_id, EconomyEvent.event_key.like('level-reward:%'))))
    return [{'level': target, 'amount': amount(target),
             'status': 'claimed' if f'level-reward:{target}' in claimed else 'claimable' if target <= level else 'locked'}
            for target in range(2, MAX_LEVEL + 1)]


async def claim(db, user_id, target=None):
    entries = await rewards(db, user_id)
    if target is not None and entries[target - 2]['status'] == 'locked':
        raise HTTPException(403, 'Reach this player level before claiming its reward')
    instant = ledger.current()
    granted = 0
    for entry in entries:
        if entry['status'] == 'claimable' and (target is None or entry['level'] == target):
            if await ledger.credit(db, user_id, f"level-reward:{entry['level']}", instant,
                                   gems=entry['amount'], context={'level': entry['level']}):
                granted += entry['amount']
    return granted
