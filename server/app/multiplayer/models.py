from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, now, uid


class Lobby(Base):
    __tablename__ = 'lobbies'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    code: Mapped[str] = mapped_column(String(6), unique=True)
    host_user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'))
    scenario_id: Mapped[str] = mapped_column(String(120))
    bots: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(10), default='open')
    game_id: Mapped[str | None] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class LobbyMember(Base):
    __tablename__ = 'lobby_members'
    lobby_id: Mapped[str] = mapped_column(ForeignKey('lobbies.id', ondelete='CASCADE'), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True, index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class QueueEntry(Base):
    __tablename__ = 'matchmaking_queue'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    status: Mapped[str] = mapped_column(String(10))
    game_id: Mapped[str | None] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Rating(Base):
    __tablename__ = 'ratings'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    rating: Mapped[int] = mapped_column(Integer, default=1000)
    matches: Mapped[int] = mapped_column(Integer, default=0)
    wins: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
