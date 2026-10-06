"""Append-only game economy storage; existing learner records are unchanged."""

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, JSON, MetaData, String, Table

from app.migration_v1 import profiles

metadata = MetaData()
profiles.to_metadata(metadata)
accounts = Table(
    'economy_accounts', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('stocks_week', String(10), nullable=False),
    Column('stocks_balance', Integer, nullable=False),
    Column('premium_balance', Integer, nullable=False),
    Column('login_last_day', String(10)),
    Column('login_streak', Integer, nullable=False),
    Column('daily_cooldown_until', DateTime(timezone=True)),
    Column('pending_refresh_event_key', String(160)),
    CheckConstraint('stocks_balance >= 0', name='economy_stocks_nonnegative'),
    CheckConstraint('premium_balance >= 0', name='economy_premium_nonnegative'),
    CheckConstraint('login_streak >= 0', name='economy_login_streak_nonnegative'),
)
events = Table(
    'economy_events', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('event_key', String(160), primary_key=True),
    Column('policy_version', String(40), nullable=False),
    Column('stocks_delta', Integer, nullable=False),
    Column('premium_delta', Integer, nullable=False),
    Column('xp_delta', Integer, nullable=False),
    Column('context', JSON, nullable=False),
    Column('response', JSON, nullable=False),
    Column('created_at', DateTime(timezone=True), nullable=False),
)
commands = Table(
    'economy_commands', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('key', String(100), primary_key=True),
    Column('request_hash', String(64), nullable=False),
    Column('response', JSON, nullable=False),
    Column('created_at', DateTime(timezone=True), nullable=False),
)


async def upgrade(connection):
    for table in (accounts, events, commands):
        await connection.run_sync(lambda sync, table=table: table.create(sync, checkfirst=True))
