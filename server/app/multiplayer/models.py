from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, now, uid


class MultiplayerLobby(Base):
    __tablename__ = 'multiplayer_lobbies'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    host_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'))
    mode: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20), index=True)
    join_code_hash: Mapped[str | None] = mapped_column(String(64), unique=True)
    version: Mapped[str] = mapped_column(String(40))
    snapshot_json: Mapped[dict] = mapped_column(JSON)
    result_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class MultiplayerMember(Base):
    __tablename__ = 'multiplayer_members'
    lobby_id: Mapped[str] = mapped_column(ForeignKey('multiplayer_lobbies.id'), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True, index=True)
    attempt_number: Mapped[int] = mapped_column(Integer)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class MultiplayerRating(Base):
    __tablename__ = 'multiplayer_ratings'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    rating: Mapped[int] = mapped_column(Integer, default=1000)
    matches: Mapped[int] = mapped_column(Integer, default=0)


class MultiplayerQueue(Base):
    __tablename__ = 'multiplayer_queues'
    channel: Mapped[str] = mapped_column(String(40), primary_key=True)


class MultiplayerJoinThrottle(Base):
    __tablename__ = 'multiplayer_join_throttle'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    window_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer)


class MultiplayerCommand(Base):
    __tablename__ = 'multiplayer_commands'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    lobby_id: Mapped[str] = mapped_column(ForeignKey('multiplayer_lobbies.id'), index=True)
    request_hash: Mapped[str] = mapped_column(String(64))
    response: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
