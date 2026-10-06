from sqlalchemy import Column, DateTime, ForeignKey, JSON, MetaData, String, Table

from app.migration_v1 import profiles
from app.migration_v5 import attempts

metadata = MetaData()
profiles.to_metadata(metadata)
attempts.to_metadata(metadata)
definitions = Table('game_challenge_definitions', metadata,
    Column('id', String(120), primary_key=True),
    Column('config', JSON, nullable=False),
    Column('created_at', DateTime(timezone=True), nullable=False))
access = Table('chapter_access', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('module_id', String(120), primary_key=True),
    Column('attempt_id', String(36), ForeignKey('challenge_attempts.id'), nullable=False),
    Column('created_at', DateTime(timezone=True), nullable=False))
bosses = Table('chapter_boss_completions', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('module_id', String(120), primary_key=True),
    Column('purpose', String(30), primary_key=True),
    Column('attempt_id', String(36), ForeignKey('challenge_attempts.id'), nullable=False),
    Column('created_at', DateTime(timezone=True), nullable=False))


async def upgrade(connection):
    for table in (definitions, access, bosses):
        await connection.run_sync(lambda sync: table.create(sync, checkfirst=True))
