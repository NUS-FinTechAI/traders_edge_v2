"""Trading match tables; earlier tables are untouched."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, JSON, MetaData, Numeric, String, Table, UniqueConstraint
from app.migration_v1 import profiles

metadata = MetaData()
profiles.to_metadata(metadata)
games = Table(
    'games', metadata,
    Column('id', String(36), primary_key=True),
    Column('mode', String(20), nullable=False),
    Column('scenario_id', String(120), nullable=False),
    Column('scenario_version', Integer, nullable=False),
    Column('seed', Integer, nullable=False),
    Column('status', String(20), nullable=False),
    Column('clock', JSON, nullable=False),
    Column('context', JSON, nullable=False),
    Column('host_user_id', String(36), ForeignKey('profiles.id'), nullable=True),
    Column('lobby_id', String(36), nullable=True),
    Column('chapter_id', String(120), nullable=True),
    Column('level_id', String(120), nullable=True),
    Column('boss', String(10), nullable=True),
    Column('created_at', DateTime(timezone=True), nullable=False),
    Column('settled_at', DateTime(timezone=True), nullable=True),
    Index('ix_games_lobby_id', 'lobby_id'),
)
participants = Table(
    'game_participants', metadata,
    Column('id', String(36), primary_key=True),
    Column('game_id', String(36), ForeignKey('games.id', ondelete='CASCADE'), nullable=False),
    Column('user_id', String(36), ForeignKey('profiles.id'), nullable=True),
    Column('bot_id', String(120), nullable=True),
    Column('display_name', String(40), nullable=False),
    Column('plan', JSON, nullable=True),
    Column('result', JSON, nullable=True),
    Column('forfeited', Boolean, nullable=False),
    UniqueConstraint('game_id', 'user_id'),
    Index('ix_game_participants_user_id', 'user_id'),
)
orders = Table(
    'game_orders', metadata,
    Column('id', String(36), primary_key=True),
    Column('game_id', String(36), ForeignKey('games.id', ondelete='CASCADE'), nullable=False),
    Column('participant_id', String(36), ForeignKey('game_participants.id', ondelete='CASCADE'), nullable=False),
    Column('client_order_id', String(64), nullable=False),
    Column('seq', Integer, nullable=False),
    Column('tick', Integer, nullable=False),
    Column('symbol', String(5), nullable=False),
    Column('side', String(4), nullable=False),
    Column('type', String(6), nullable=False),
    Column('qty', Integer, nullable=False),
    Column('limit_price', Numeric(12, 2), nullable=True),
    Column('stop_price', Numeric(12, 2), nullable=True),
    Column('cancelled_tick', Integer, nullable=True),
    Column('created_at', DateTime(timezone=True), nullable=False),
    UniqueConstraint('participant_id', 'client_order_id'),
    Index('ix_game_orders_game_id', 'game_id'),
)
events = Table(
    'game_events', metadata,
    Column('id', String(36), primary_key=True),
    Column('game_id', String(36), ForeignKey('games.id', ondelete='CASCADE'), nullable=False),
    Column('participant_id', String(36), ForeignKey('game_participants.id', ondelete='CASCADE'), nullable=True),
    Column('tick', Integer, nullable=False),
    Column('kind', String(20), nullable=False),
    Column('payload', JSON, nullable=False),
    Column('created_at', DateTime(timezone=True), nullable=False),
    Index('ix_game_events_game_id', 'game_id'),
)


async def upgrade(connection):
    for table in (games, participants, orders, events):
        await connection.run_sync(lambda sync, table=table: table.create(sync, checkfirst=True))
