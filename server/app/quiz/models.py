from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, now, uid


class QuizRoom(Base):
    __tablename__ = 'quiz_rooms_v2'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    code: Mapped[str] = mapped_column(String(6), unique=True)
    host_user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), index=True)
    topic_id: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class QuizRoomMember(Base):
    __tablename__ = 'quiz_room_members_v2'
    room_id: Mapped[str] = mapped_column(ForeignKey('quiz_rooms_v2.id', ondelete='CASCADE'), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True, index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class QuizAttempt(Base):
    __tablename__ = 'quiz_attempts_v2'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), index=True)
    topic_id: Mapped[str] = mapped_column(String(40))
    room_id: Mapped[str | None] = mapped_column(ForeignKey('quiz_rooms_v2.id', ondelete='CASCADE'), index=True)
    bank_version: Mapped[str] = mapped_column(String(40))
    items: Mapped[list] = mapped_column(JSON)
    answers: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(10), default='active')
    score: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer)
    passed: Mapped[bool | None] = mapped_column(Boolean)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
