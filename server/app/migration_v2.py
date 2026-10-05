"""Persist simulator commands so retries replay the original committed response."""
from sqlalchemy import Column, DateTime, ForeignKey, JSON, MetaData, String, Table
from app.migration_v1 import profiles, simulation_sessions

metadata = MetaData()
profiles.to_metadata(metadata)
simulation_sessions.to_metadata(metadata)
commands = Table(
    'simulation_commands', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('key', String(100), primary_key=True),
    Column('session_id', String(36), ForeignKey('simulation_sessions.id'), nullable=False, index=True),
    Column('request_hash', String(64), nullable=False),
    Column('response', JSON, nullable=False),
    Column('created_at', DateTime(timezone=True), nullable=False),
)

async def upgrade(connection):
    await connection.run_sync(lambda sync: commands.create(sync, checkfirst=True))
