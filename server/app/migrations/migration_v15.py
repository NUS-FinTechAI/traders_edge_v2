"""Persistent, account-scoped read receipts for unlocked content."""
from sqlalchemy import Column, DateTime, ForeignKey, MetaData, String, Table
from app.migrations.migration_v1 import profiles

metadata = MetaData()
profiles.to_metadata(metadata)
unlock_receipts = Table(
    'unlock_receipts', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('category', String(40), primary_key=True),
    Column('item_id', String(120), primary_key=True),
    Column('seen_at', DateTime(timezone=True), nullable=False),
)


async def upgrade(connection):
    await connection.run_sync(lambda sync: unlock_receipts.create(sync, checkfirst=True))
