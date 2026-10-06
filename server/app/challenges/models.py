from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, now, uid


class ChallengeAttempt(Base):
    __tablename__ = 'challenge_attempts'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), index=True)
    challenge_id: Mapped[str] = mapped_column(String(120))
    attempt_number: Mapped[int] = mapped_column(Integer)
    mode: Mapped[str] = mapped_column(String(30))
    module_id: Mapped[str | None] = mapped_column(String(120))
    version: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20))
    snapshot_json: Mapped[dict] = mapped_column(JSON)
    result_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ChallengeCommand(Base):
    __tablename__ = 'challenge_commands'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    attempt_id: Mapped[str] = mapped_column(ForeignKey('challenge_attempts.id'), index=True)
    request_hash: Mapped[str] = mapped_column(String(64))
    response: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
