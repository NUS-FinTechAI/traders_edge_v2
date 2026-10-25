from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, MetaData, String, Table

from app.migration_v1 import profiles

metadata = MetaData()
profiles.to_metadata(metadata)
rooms = Table(
    'quiz_rooms', metadata,
    Column('id', String(36), primary_key=True),
    Column('host_id', String(36), ForeignKey('profiles.id'), nullable=False, index=True),
    Column('join_code', String(8), nullable=False, unique=True),
    Column('title', String(80), nullable=False),
    Column('content_version', String(120), nullable=False),
    Column('status', String(20), nullable=False),
    Column('attempt_limit', Integer, nullable=False),
    Column('snapshot_json', JSON, nullable=False),
    Column('created_at', DateTime(timezone=True), nullable=False),
)
members = Table(
    'quiz_members', metadata,
    Column('room_id', String(36), ForeignKey('quiz_rooms.id'), primary_key=True),
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('joined_at', DateTime(timezone=True), nullable=False),
)
attempts = Table(
    'quiz_attempts', metadata,
    Column('id', String(36), primary_key=True),
    Column('user_id', String(36), ForeignKey('profiles.id'), nullable=False, index=True),
    Column('room_id', String(36), ForeignKey('quiz_rooms.id'), index=True),
    Column('quiz_id', String(160), nullable=False),
    Column('content_version', String(120), nullable=False),
    Column('attempt_number', Integer, nullable=False),
    Column('status', String(20), nullable=False),
    Column('snapshot_json', JSON, nullable=False),
    Column('state_json', JSON, nullable=False),
    Column('result_json', JSON),
    Column('created_at', DateTime(timezone=True), nullable=False),
)
commands = Table(
    'quiz_commands', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('key', String(100), primary_key=True),
    Column('request_hash', String(64), nullable=False),
    Column('response', JSON, nullable=False),
    Column('created_at', DateTime(timezone=True), nullable=False),
)


async def upgrade(connection):
    for table in (rooms, members, attempts, commands):
        await connection.run_sync(lambda sync, table=table: table.create(sync, checkfirst=True))
