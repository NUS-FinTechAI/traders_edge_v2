from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, now


class EconomyAccount(Base):
    __tablename__ = 'economy_accounts'
    __table_args__ = (
        CheckConstraint('stocks_balance >= 0', name='economy_stocks_nonnegative'),
        CheckConstraint('premium_balance >= 0', name='economy_premium_nonnegative'),
        CheckConstraint('login_streak >= 0', name='economy_login_streak_nonnegative'),
    )
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    stocks_week: Mapped[str] = mapped_column(String(10))
    stocks_balance: Mapped[int] = mapped_column(Integer, default=0)
    premium_balance: Mapped[int] = mapped_column(Integer, default=0)
    login_last_day: Mapped[str | None] = mapped_column(String(10))
    login_streak: Mapped[int] = mapped_column(Integer, default=0)
    daily_cooldown_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pending_refresh_event_key: Mapped[str | None] = mapped_column(String(160))


class EconomyEvent(Base):
    __tablename__ = 'economy_events'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    event_key: Mapped[str] = mapped_column(String(160), primary_key=True)
    policy_version: Mapped[str] = mapped_column(String(40))
    stocks_delta: Mapped[int] = mapped_column(Integer)
    premium_delta: Mapped[int] = mapped_column(Integer)
    xp_delta: Mapped[int] = mapped_column(Integer)
    context: Mapped[dict] = mapped_column(JSON)
    response: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class EconomyCommand(Base):
    __tablename__ = 'economy_commands'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    request_hash: Mapped[str] = mapped_column(String(64))
    response: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
