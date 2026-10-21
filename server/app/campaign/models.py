from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, now


class CampaignProgress(Base):
    __tablename__ = 'campaign_progress'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    level_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    check_done: Mapped[bool] = mapped_column(Boolean, default=False)
    check_first_try: Mapped[int] = mapped_column(Integer, default=0)
    check_total: Mapped[int] = mapped_column(Integer, default=0)
    normal_star: Mapped[bool] = mapped_column(Boolean, default=False)
    special_star: Mapped[bool] = mapped_column(Boolean, default=False)
    best_profit: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    plays: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class CampaignCheck(Base):
    __tablename__ = 'campaign_checks'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    level_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    question_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    first_option_id: Mapped[str] = mapped_column(String(100))
    first_correct: Mapped[bool] = mapped_column(Boolean)
    solved: Mapped[bool] = mapped_column(Boolean)
    run_first_correct: Mapped[bool | None] = mapped_column(Boolean)
    run_solved: Mapped[bool] = mapped_column(Boolean, default=False)


class DailySeed(Base):
    __tablename__ = 'daily_seeds'
    day: Mapped[str] = mapped_column(String(10), primary_key=True)
    seed: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class BossResult(Base):
    __tablename__ = 'boss_results'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    chapter_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    kind: Mapped[str] = mapped_column(String(10), primary_key=True)
    won: Mapped[bool] = mapped_column(Boolean, default=False)
    best_profit: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    first_won_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
