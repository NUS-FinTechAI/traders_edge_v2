from sqlalchemy import Column, DateTime, ForeignKey, JSON, MetaData, String, Table
from app.migration_v1 import profiles

metadata = MetaData()
profiles.to_metadata(metadata)
runs = Table(
    'learning_runs', metadata,
    Column('id', String(36), primary_key=True),
    Column('user_id', String(36), ForeignKey('profiles.id'), nullable=False, index=True),
    Column('purpose', String(20), nullable=False),
    Column('module_id', String(120), nullable=False),
    Column('level_id', String(120), nullable=True),
    Column('content_version', String(120), nullable=False),
    Column('status', String(20), nullable=False),
    Column('snapshot_json', JSON, nullable=False),
    Column('state_json', JSON, nullable=False),
    Column('created_at', DateTime(timezone=True), nullable=False),
    Column('updated_at', DateTime(timezone=True), nullable=False),
)
commands = Table(
    'learning_run_commands', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('key', String(100), primary_key=True),
    Column('run_id', String(36), ForeignKey('learning_runs.id'), nullable=False, index=True),
    Column('request_hash', String(64), nullable=False),
    Column('response', JSON, nullable=False),
    Column('created_at', DateTime(timezone=True), nullable=False),
)


async def upgrade(connection):
    await connection.run_sync(lambda sync: runs.create(sync, checkfirst=True))
    await connection.run_sync(lambda sync: commands.create(sync, checkfirst=True))
