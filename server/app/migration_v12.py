"""Campaign, quiz, lobby and rating tables; earlier tables are untouched."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, JSON, MetaData, Numeric, String, Table
from app.migration_v1 import profiles

metadata = MetaData()
profiles.to_metadata(metadata)
campaign_progress = Table(
    'campaign_progress', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('level_id', String(120), primary_key=True),
    Column('check_done', Boolean, nullable=False),
    Column('check_first_try', Integer, nullable=False),
    Column('check_total', Integer, nullable=False),
    Column('normal_star', Boolean, nullable=False),
    Column('special_star', Boolean, nullable=False),
    Column('best_profit', Numeric(12, 2), nullable=True),
    Column('plays', Integer, nullable=False),
    Column('updated_at', DateTime(timezone=True), nullable=False),
)
campaign_checks = Table(
    'campaign_checks', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('level_id', String(120), primary_key=True),
    Column('question_id', String(120), primary_key=True),
    Column('first_option_id', String(100), nullable=False),
    Column('first_correct', Boolean, nullable=False),
    Column('solved', Boolean, nullable=False),
)
boss_results = Table(
    'boss_results', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('chapter_id', String(120), primary_key=True),
    Column('kind', String(10), primary_key=True),
    Column('won', Boolean, nullable=False),
    Column('best_profit', Numeric(12, 2), nullable=True),
    Column('attempts', Integer, nullable=False),
    Column('first_won_at', DateTime(timezone=True), nullable=True),
)
quiz_rooms = Table(
    'quiz_rooms_v2', metadata,
    Column('id', String(36), primary_key=True),
    Column('code', String(6), nullable=False, unique=True),
    Column('host_user_id', String(36), ForeignKey('profiles.id'), nullable=False),
    Column('topic_id', String(40), nullable=False),
    Column('title', String(80), nullable=False),
    Column('created_at', DateTime(timezone=True), nullable=False),
    Index('ix_quiz_rooms_v2_host_user_id', 'host_user_id'),
)
quiz_room_members = Table(
    'quiz_room_members_v2', metadata,
    Column('room_id', String(36), ForeignKey('quiz_rooms_v2.id', ondelete='CASCADE'), primary_key=True),
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('joined_at', DateTime(timezone=True), nullable=False),
    Index('ix_quiz_room_members_v2_user_id', 'user_id'),
)
quiz_attempts = Table(
    'quiz_attempts_v2', metadata,
    Column('id', String(36), primary_key=True),
    Column('user_id', String(36), ForeignKey('profiles.id'), nullable=False),
    Column('topic_id', String(40), nullable=False),
    Column('room_id', String(36), ForeignKey('quiz_rooms_v2.id', ondelete='CASCADE'), nullable=True),
    Column('bank_version', String(40), nullable=False),
    Column('items', JSON, nullable=False),
    Column('answers', JSON, nullable=False),
    Column('status', String(10), nullable=False),
    Column('score', Integer, nullable=False),
    Column('total', Integer, nullable=False),
    Column('passed', Boolean, nullable=True),
    Column('xp', Integer, nullable=False),
    Column('created_at', DateTime(timezone=True), nullable=False),
    Column('completed_at', DateTime(timezone=True), nullable=True),
    Index('ix_quiz_attempts_v2_user_id', 'user_id'),
    Index('ix_quiz_attempts_v2_room_id', 'room_id'),
)
lobbies = Table(
    'lobbies', metadata,
    Column('id', String(36), primary_key=True),
    Column('code', String(6), nullable=False, unique=True),
    Column('host_user_id', String(36), ForeignKey('profiles.id'), nullable=False),
    Column('scenario_id', String(120), nullable=False),
    Column('bots', Integer, nullable=False),
    Column('status', String(10), nullable=False),
    Column('game_id', String(36), nullable=True),
    Column('created_at', DateTime(timezone=True), nullable=False),
)
lobby_members = Table(
    'lobby_members', metadata,
    Column('lobby_id', String(36), ForeignKey('lobbies.id', ondelete='CASCADE'), primary_key=True),
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('joined_at', DateTime(timezone=True), nullable=False),
    Index('ix_lobby_members_user_id', 'user_id'),
)
matchmaking_queue = Table(
    'matchmaking_queue', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('status', String(10), nullable=False),
    Column('game_id', String(36), nullable=True),
    Column('created_at', DateTime(timezone=True), nullable=False),
)
ratings = Table(
    'ratings', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('rating', Integer, nullable=False),
    Column('matches', Integer, nullable=False),
    Column('wins', Integer, nullable=False),
    Column('updated_at', DateTime(timezone=True), nullable=False),
)
TABLES = (campaign_progress, campaign_checks, boss_results, quiz_rooms, quiz_room_members, quiz_attempts, lobbies, lobby_members,
          matchmaking_queue, ratings)


async def upgrade(connection):
    for table in TABLES:
        await connection.run_sync(lambda sync, table=table: table.create(sync, checkfirst=True))
