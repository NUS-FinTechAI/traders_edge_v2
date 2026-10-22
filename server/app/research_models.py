from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, now


class ResearchParticipant(Base):
    __tablename__ = 'research_participants'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    first_prior_knowledge: Mapped[str | None] = mapped_column(String(20))
    prior_knowledge: Mapped[str] = mapped_column(String(20))
    consented: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_version: Mapped[str | None] = mapped_column(String(80))
    consent_text: Mapped[str | None] = mapped_column(Text)
    consented_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ResearchCommand(Base):
    __tablename__ = 'research_commands'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    request_hash: Mapped[str] = mapped_column(String(64))
    response: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class PriorKnowledgeResponse(Base):
    """The one-time onboarding instrument: completed or skipped, only ever recorded under active study consent."""
    __tablename__ = 'prior_knowledge_responses'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    instrument_version: Mapped[str] = mapped_column(String(40))
    consent_version: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(10))
    experience: Mapped[str | None] = mapped_column(String(10))
    brokerage_account: Mapped[bool | None] = mapped_column(Boolean)
    market_frequency: Mapped[str | None] = mapped_column(String(10))
    confidence: Mapped[int | None] = mapped_column(Integer)
    answers: Mapped[list] = mapped_column(JSON, default=list)
    score: Mapped[int | None] = mapped_column(Integer)
    prior_knowledge_group: Mapped[str] = mapped_column(String(20))
    elapsed_seconds: Mapped[int | None] = mapped_column(Integer)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
