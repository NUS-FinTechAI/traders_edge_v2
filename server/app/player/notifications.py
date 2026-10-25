"""Account-scoped read receipts for unlock categories supplied by feature modules."""
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import DateTime, ForeignKey, String, select
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, now


class UnlockReceipt(Base):
    __tablename__ = 'unlock_receipts'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    category: Mapped[str] = mapped_column(String(40), primary_key=True)
    item_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


async def unread(db, user_id, available):
    rows = await db.execute(select(UnlockReceipt.category, UnlockReceipt.item_id).where(UnlockReceipt.user_id == user_id))
    seen = {(category, item_id) for category, item_id in rows}
    return [item for item in available if (item['category'], item['item_id']) not in seen]


async def acknowledge(db, user_id, available, requested):
    allowed = {(item['category'], item['item_id']) for item in available}
    keys = {(item.category, item.item_id) for item in requested}
    if not keys <= allowed:
        raise HTTPException(403, 'Only your unlocked content can be marked as seen')
    for category, item_id in keys:
        if await db.get(UnlockReceipt, (user_id, category, item_id)) is None:
            db.add(UnlockReceipt(user_id=user_id, category=category, item_id=item_id))
    await db.flush()
