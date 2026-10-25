from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, MetaData, String, Table

from app.migration_v1 import profiles

metadata = MetaData()
profiles.to_metadata(metadata)
attempts = Table(
    'challenge_attempts', metadata,
    Column('id', String(36), primary_key=True),
    Column('user_id', String(36), ForeignKey('profiles.id'), nullable=False, index=True),
    Column('challenge_id', String(120), nullable=False),
    Column('attempt_number', Integer, nullable=False),
    Column('mode', String(30), nullable=False),
    Column('module_id', String(120)),
    Column('version', String(40), nullable=False),
    Column('status', String(20), nullable=False),
    Column('snapshot_json', JSON, nullable=False),
    Column('result_json', JSON),
    Column('created_at', DateTime(timezone=True), nullable=False),
    Column('updated_at', DateTime(timezone=True), nullable=False),
)
commands = Table(
    'challenge_commands', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('key', String(100), primary_key=True),
    Column('attempt_id', String(36), ForeignKey('challenge_attempts.id'), nullable=False, index=True),
    Column('request_hash', String(64), nullable=False),
    Column('response', JSON, nullable=False),
    Column('created_at', DateTime(timezone=True), nullable=False),
)


async def upgrade(connection):
    await connection.run_sync(lambda sync: attempts.create(sync, checkfirst=True))
    await connection.run_sync(lambda sync: commands.create(sync, checkfirst=True))
