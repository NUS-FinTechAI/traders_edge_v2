"""Owned research metadata and receipts; existing operational records are retained."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, JSON, MetaData, String, Table, Text
from app.migration_v1 import profiles

metadata = MetaData()
profiles.to_metadata(metadata)
participants = Table(
    'research_participants', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('first_prior_knowledge', String(20)),
    Column('prior_knowledge', String(20), nullable=False),
    Column('consented', Boolean, nullable=False),
    Column('consent_version', String(80)),
    Column('consent_text', Text),
    Column('consented_at', DateTime(timezone=True)),
    Column('withdrawn_at', DateTime(timezone=True)),
    Column('created_at', DateTime(timezone=True), nullable=False),
    Column('updated_at', DateTime(timezone=True), nullable=False),
)
commands = Table(
    'research_commands', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('key', String(100), primary_key=True),
    Column('request_hash', String(64), nullable=False),
    Column('response', JSON, nullable=False),
    Column('created_at', DateTime(timezone=True), nullable=False),
)


async def upgrade(connection):
    for table in (participants, commands):
        await connection.run_sync(lambda sync, table=table: table.create(sync, checkfirst=True))
