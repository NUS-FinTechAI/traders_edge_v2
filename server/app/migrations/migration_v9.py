from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, MetaData, String, Table

from app.migration_v1 import profiles

metadata = MetaData()
profiles.to_metadata(metadata)
lobbies = Table('multiplayer_lobbies', metadata,
    Column('id', String(36), primary_key=True),
    Column('host_id', String(36), ForeignKey('profiles.id'), nullable=False),
    Column('mode', String(30), nullable=False),
    Column('status', String(20), nullable=False, index=True),
    Column('join_code_hash', String(64), unique=True),
    Column('version', String(40), nullable=False),
    Column('snapshot_json', JSON, nullable=False),
    Column('result_json', JSON),
    Column('created_at', DateTime(timezone=True), nullable=False),
    Column('updated_at', DateTime(timezone=True), nullable=False))
members = Table('multiplayer_members', metadata,
    Column('lobby_id', String(36), ForeignKey('multiplayer_lobbies.id'), primary_key=True),
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True, index=True),
    Column('attempt_number', Integer, nullable=False),
    Column('joined_at', DateTime(timezone=True), nullable=False))
ratings = Table('multiplayer_ratings', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('rating', Integer, nullable=False),
    Column('matches', Integer, nullable=False))
queues = Table('multiplayer_queues', metadata,
    Column('channel', String(40), primary_key=True))
throttles = Table('multiplayer_join_throttle', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('window_at', DateTime(timezone=True), nullable=False),
    Column('attempts', Integer, nullable=False))
commands = Table('multiplayer_commands', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('key', String(100), primary_key=True),
    Column('lobby_id', String(36), ForeignKey('multiplayer_lobbies.id'), nullable=False, index=True),
    Column('request_hash', String(64), nullable=False),
    Column('response', JSON, nullable=False),
    Column('created_at', DateTime(timezone=True), nullable=False))


async def upgrade(connection):
    for table in (lobbies, members, ratings, queues, throttles, commands):
        await connection.run_sync(lambda sync, table=table: table.create(sync, checkfirst=True))
