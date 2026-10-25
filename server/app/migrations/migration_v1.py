"""Frozen initial schema for migration 1; subsequent changes belong in new migrations."""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, JSON, MetaData, String, Table, Text, UniqueConstraint

metadata = MetaData()

aggregate_events = Table(
    'aggregate_events', metadata,
    Column('day', String(length=10), primary_key=True, nullable=False),
    Column('kind', String(length=30), primary_key=True, nullable=False),
    Column('count', Integer(), primary_key=False, nullable=False),
)

profiles = Table(
    'profiles', metadata,
    Column('id', String(length=36), primary_key=True, nullable=False),
    Column('firebase_uid', String(length=128), primary_key=False, nullable=True),
    Column('display_name', String(length=40), primary_key=False, nullable=False),
    Column('leaderboard_opt_in', Boolean(), primary_key=False, nullable=False),
    Column('analytics_opt_in', Boolean(), primary_key=False, nullable=False),
    Column('created_at', DateTime(timezone=True), primary_key=False, nullable=False),
    UniqueConstraint('firebase_uid'),
)

schema_versions = Table(
    'schema_versions', metadata,
    Column('version', Integer(), primary_key=True, nullable=False),
    Column('applied_at', DateTime(timezone=True), primary_key=False, nullable=False),
)

attempts = Table(
    'attempts', metadata,
    Column('id', String(length=36), primary_key=True, nullable=False),
    Column('user_id', String(length=36), ForeignKey('profiles.id'), primary_key=False, nullable=False),
    Column('kind', String(length=20), primary_key=False, nullable=False),
    Column('target_id', String(length=120), primary_key=False, nullable=False),
    Column('idempotency_key', String(length=100), primary_key=False, nullable=False),
    Column('request_hash', String(length=64), primary_key=False, nullable=False),
    Column('answers', JSON(), primary_key=False, nullable=False),
    Column('reflection', Text(), primary_key=False, nullable=False),
    Column('score', Integer(), primary_key=False, nullable=False),
    Column('passed', Boolean(), primary_key=False, nullable=False),
    Column('result', JSON(), primary_key=False, nullable=False),
    Column('created_at', DateTime(timezone=True), primary_key=False, nullable=False),
    UniqueConstraint('user_id', 'idempotency_key'),
)
Index('ix_attempts_user_id', attempts.c.user_id)

journal_entries = Table(
    'journal_entries', metadata,
    Column('id', String(length=36), primary_key=True, nullable=False),
    Column('user_id', String(length=36), ForeignKey('profiles.id'), primary_key=False, nullable=False),
    Column('text', Text(), primary_key=False, nullable=False),
    Column('lesson_id', String(length=120), primary_key=False, nullable=True),
    Column('created_at', DateTime(timezone=True), primary_key=False, nullable=False),
)
Index('ix_journal_entries_user_id', journal_entries.c.user_id)

learning_activity = Table(
    'learning_activity', metadata,
    Column('user_id', String(length=36), ForeignKey('profiles.id'), primary_key=True, nullable=False),
    Column('day', String(length=10), primary_key=True, nullable=False),
)

review_queue = Table(
    'review_queue', metadata,
    Column('id', String(length=36), primary_key=True, nullable=False),
    Column('user_id', String(length=36), ForeignKey('profiles.id'), primary_key=False, nullable=False),
    Column('lesson_id', String(length=120), primary_key=False, nullable=False),
    Column('due_at', DateTime(timezone=True), primary_key=False, nullable=False),
    Column('completed_at', DateTime(timezone=True), primary_key=False, nullable=True),
    UniqueConstraint('user_id', 'lesson_id'),
)
Index('ix_review_queue_user_id', review_queue.c.user_id)

sessions = Table(
    'sessions', metadata,
    Column('token_hash', String(length=64), primary_key=True, nullable=False),
    Column('user_id', String(length=36), ForeignKey('profiles.id', ondelete='CASCADE'), primary_key=False, nullable=False),
    Column('expires_at', DateTime(timezone=True), primary_key=False, nullable=False),
)
Index('ix_sessions_user_id', sessions.c.user_id)

simulation_sessions = Table(
    'simulation_sessions', metadata,
    Column('id', String(length=36), primary_key=True, nullable=False),
    Column('user_id', String(length=36), ForeignKey('profiles.id'), primary_key=False, nullable=False),
    Column('mode', String(length=30), primary_key=False, nullable=False),
    Column('scenario_kind', String(length=40), primary_key=False, nullable=False),
    Column('version', Integer(), primary_key=False, nullable=False),
    Column('snapshot_json', JSON(), primary_key=False, nullable=False),
    Column('updated_at', DateTime(timezone=True), primary_key=False, nullable=False),
)
Index('ix_simulation_sessions_user_id', simulation_sessions.c.user_id)

xp_ledger = Table(
    'xp_ledger', metadata,
    Column('user_id', String(length=36), ForeignKey('profiles.id'), primary_key=True, nullable=False),
    Column('event_key', String(length=160), primary_key=True, nullable=False),
    Column('amount', Integer(), primary_key=False, nullable=False),
    Column('reason', String(length=120), primary_key=False, nullable=False),
    Column('created_at', DateTime(timezone=True), primary_key=False, nullable=False),
)

lesson_completions = Table(
    'lesson_completions', metadata,
    Column('user_id', String(length=36), ForeignKey('profiles.id'), primary_key=True, nullable=False),
    Column('lesson_id', String(length=120), primary_key=True, nullable=False),
    Column('attempt_id', String(length=36), ForeignKey('attempts.id'), primary_key=False, nullable=False),
    Column('completed_at', DateTime(timezone=True), primary_key=False, nullable=False),
)

mastered_modules = Table(
    'mastered_modules', metadata,
    Column('user_id', String(length=36), ForeignKey('profiles.id'), primary_key=True, nullable=False),
    Column('module_id', String(length=120), primary_key=True, nullable=False),
    Column('attempt_id', String(length=36), ForeignKey('attempts.id'), primary_key=False, nullable=False),
    Column('mastered_at', DateTime(timezone=True), primary_key=False, nullable=False),
)
