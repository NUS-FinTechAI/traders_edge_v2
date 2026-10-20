from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, now, uid


class Game(Base):
    __tablename__ = 'games'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    mode: Mapped[str] = mapped_column(String(20))
    scenario_id: Mapped[str] = mapped_column(String(120))
    scenario_version: Mapped[int] = mapped_column(Integer)
    seed: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20))
    clock: Mapped[dict] = mapped_column(JSON)
    context: Mapped[dict] = mapped_column(JSON, default=dict)
    host_user_id: Mapped[str | None] = mapped_column(ForeignKey('profiles.id'))
    lobby_id: Mapped[str | None] = mapped_column(String(36), index=True)
    chapter_id: Mapped[str | None] = mapped_column(String(120))
    level_id: Mapped[str | None] = mapped_column(String(120))
    boss: Mapped[str | None] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class GameParticipant(Base):
    __tablename__ = 'game_participants'
    __table_args__ = (UniqueConstraint('game_id', 'user_id'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    game_id: Mapped[str] = mapped_column(ForeignKey('games.id', ondelete='CASCADE'))
    user_id: Mapped[str | None] = mapped_column(ForeignKey('profiles.id'), index=True)
    bot_id: Mapped[str | None] = mapped_column(String(120))
    display_name: Mapped[str] = mapped_column(String(40))
    plan: Mapped[dict | None] = mapped_column(JSON)
    result: Mapped[dict | None] = mapped_column(JSON)
    forfeited: Mapped[bool] = mapped_column(Boolean, default=False)


class GameOrder(Base):
    __tablename__ = 'game_orders'
    __table_args__ = (UniqueConstraint('participant_id', 'client_order_id'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    game_id: Mapped[str] = mapped_column(ForeignKey('games.id', ondelete='CASCADE'), index=True)
    participant_id: Mapped[str] = mapped_column(ForeignKey('game_participants.id', ondelete='CASCADE'))
    client_order_id: Mapped[str] = mapped_column(String(64))
    seq: Mapped[int] = mapped_column(Integer)
    tick: Mapped[int] = mapped_column(Integer)
    symbol: Mapped[str] = mapped_column(String(5))
    side: Mapped[str] = mapped_column(String(4))
    type: Mapped[str] = mapped_column(String(6))
    qty: Mapped[int] = mapped_column(Integer)
    limit_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    stop_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    cancelled_tick: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class GameEvent(Base):
    __tablename__ = 'game_events'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    game_id: Mapped[str] = mapped_column(ForeignKey('games.id', ondelete='CASCADE'), index=True)
    participant_id: Mapped[str | None] = mapped_column(ForeignKey('game_participants.id', ondelete='CASCADE'))
    tick: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String(20))
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
