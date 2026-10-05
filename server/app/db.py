import asyncio
from datetime import datetime, timezone
from pathlib import Path
import uuid

from fastapi import Request
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, event, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.config import Settings


def now():
    return datetime.now(timezone.utc)


def uid():
    return str(uuid.uuid4())


def aware(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


class Base(DeclarativeBase):
    pass


class SchemaVersion(Base):
    __tablename__ = 'schema_versions'
    version: Mapped[int] = mapped_column(primary_key=True)
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Profile(Base):
    __tablename__ = 'profiles'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    firebase_uid: Mapped[str | None] = mapped_column(String(128), unique=True)
    display_name: Mapped[str] = mapped_column(String(40), default='Learner')
    leaderboard_opt_in: Mapped[bool] = mapped_column(Boolean, default=False)
    analytics_opt_in: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SessionToken(Base):
    __tablename__ = 'sessions'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id', ondelete='CASCADE'), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Attempt(Base):
    __tablename__ = 'attempts'
    __table_args__ = (UniqueConstraint('user_id', 'idempotency_key'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    target_id: Mapped[str] = mapped_column(String(120))
    idempotency_key: Mapped[str] = mapped_column(String(100))
    request_hash: Mapped[str] = mapped_column(String(64))
    answers: Mapped[list] = mapped_column(JSON)
    reflection: Mapped[str] = mapped_column(Text)
    score: Mapped[int] = mapped_column(Integer)
    passed: Mapped[bool] = mapped_column(Boolean)
    result: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class LessonCompletion(Base):
    __tablename__ = 'lesson_completions'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    lesson_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    attempt_id: Mapped[str] = mapped_column(ForeignKey('attempts.id'))
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class MasteredModule(Base):
    __tablename__ = 'mastered_modules'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    module_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    attempt_id: Mapped[str] = mapped_column(ForeignKey('attempts.id'))
    mastered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ReviewItem(Base):
    __tablename__ = 'review_queue'
    __table_args__ = (UniqueConstraint('user_id', 'lesson_id'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), index=True)
    lesson_id: Mapped[str] = mapped_column(String(120))
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class XPLedger(Base):
    __tablename__ = 'xp_ledger'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    event_key: Mapped[str] = mapped_column(String(160), primary_key=True)
    amount: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class LearningActivity(Base):
    __tablename__ = 'learning_activity'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    day: Mapped[str] = mapped_column(String(10), primary_key=True)


class JournalEntry(Base):
    __tablename__ = 'journal_entries'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), index=True)
    text: Mapped[str] = mapped_column(Text)
    lesson_id: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AggregateEvent(Base):
    __tablename__ = 'aggregate_events'
    day: Mapped[str] = mapped_column(String(10), primary_key=True)
    kind: Mapped[str] = mapped_column(String(30), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, default=0)


class SimulationSession(Base):
    __tablename__ = 'simulation_sessions'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), index=True)
    mode: Mapped[str] = mapped_column(String(30))
    scenario_kind: Mapped[str] = mapped_column(String(40))
    version: Mapped[int] = mapped_column(Integer, default=1)
    snapshot_json: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class LearningRun(Base):
    __tablename__ = 'learning_runs'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), index=True)
    purpose: Mapped[str] = mapped_column(String(20))
    module_id: Mapped[str] = mapped_column(String(120))
    level_id: Mapped[str | None] = mapped_column(String(120))
    content_version: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20))
    snapshot_json: Mapped[dict] = mapped_column(JSON)
    state_json: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class LearningRunCommand(Base):
    __tablename__ = 'learning_run_commands'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    run_id: Mapped[str] = mapped_column(ForeignKey('learning_runs.id'), index=True)
    request_hash: Mapped[str] = mapped_column(String(64))
    response: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Database:
    def __init__(self, settings: Settings):
        if settings.database_url.startswith('sqlite+aiosqlite:///'):
            path = settings.database_url.removeprefix('sqlite+aiosqlite:///')
            if path != ':memory:':
                Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.engine = create_async_engine(settings.database_url)
        if settings.database_url.startswith('sqlite'):
            @event.listens_for(self.engine.sync_engine, 'connect')
            def sqlite_settings(connection, _):
                cursor = connection.cursor()
                cursor.execute('PRAGMA foreign_keys=ON')
                cursor.execute('PRAGMA busy_timeout=10000')
                cursor.close()
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)

    async def migrate(self):
        from app.migrations import migrate
        await migrate(self.engine)

    async def check_schema(self):
        from sqlalchemy import inspect
        from app.migrations import LATEST_VERSION
        async with self.engine.connect() as connection:
            exists = await connection.run_sync(lambda sync: inspect(sync).has_table('schema_versions'))
            if not exists:
                raise RuntimeError('Database migrations are required; run python -m app.db')
            versions = list((await connection.execute(select(SchemaVersion.version).order_by(SchemaVersion.version))).scalars())
            if versions != list(range(1, LATEST_VERSION + 1)):
                raise RuntimeError('Database migration version does not match this application')


async def get_db(request: Request):
    async with request.app.state.db.sessions() as session:
        async with session.begin():
            if request.method not in {'GET', 'HEAD', 'OPTIONS'} and session.bind.dialect.name == 'sqlite':
                await session.execute(text('BEGIN IMMEDIATE'))
            yield session


async def _migrate():
    settings = Settings.from_env()
    settings.validate()
    database = Database(settings)
    await database.migrate()
    await database.engine.dispose()


if __name__ == '__main__':
    asyncio.run(_migrate())
