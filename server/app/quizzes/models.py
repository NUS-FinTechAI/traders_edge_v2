from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, now, uid


class QuizRoom(Base):
    __tablename__ = 'quiz_rooms'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    host_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), index=True)
    join_code: Mapped[str] = mapped_column(String(8), unique=True)
    title: Mapped[str] = mapped_column(String(80))
    content_version: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20))
    attempt_limit: Mapped[int] = mapped_column(Integer)
    snapshot_json: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class QuizMember(Base):
    __tablename__ = 'quiz_members'
    room_id: Mapped[str] = mapped_column(ForeignKey('quiz_rooms.id'), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class QuizAttempt(Base):
    __tablename__ = 'quiz_attempts'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), index=True)
    room_id: Mapped[str | None] = mapped_column(ForeignKey('quiz_rooms.id'), index=True)
    quiz_id: Mapped[str] = mapped_column(String(160))
    content_version: Mapped[str] = mapped_column(String(120))
    attempt_number: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20))
    snapshot_json: Mapped[dict] = mapped_column(JSON)
    state_json: Mapped[dict] = mapped_column(JSON)
    result_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class QuizCommand(Base):
    __tablename__ = 'quiz_commands'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    request_hash: Mapped[str] = mapped_column(String(64))
    response: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
