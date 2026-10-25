from sqlalchemy import Column, DateTime, ForeignKey, JSON, MetaData, String, Table, inspect, text

from app.migration_v1 import profiles

metadata = MetaData()
profiles.to_metadata(metadata)
grants = Table(
    'reward_grants', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('item_id', String(120), primary_key=True),
    Column('rule_version', String(40), nullable=False),
    Column('public_snapshot', JSON, nullable=False),
    Column('evidence', JSON, nullable=False),
    Column('created_at', DateTime(timezone=True), nullable=False),
)
commands = Table(
    'reward_commands', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('key', String(100), primary_key=True),
    Column('request_hash', String(64), nullable=False),
    Column('response', JSON, nullable=False),
    Column('created_at', DateTime(timezone=True), nullable=False),
)


async def upgrade(connection):
    await connection.run_sync(lambda sync: grants.create(sync, checkfirst=True))
    await connection.run_sync(lambda sync: commands.create(sync, checkfirst=True))
    columns = await connection.run_sync(lambda sync: {column['name'] for column in inspect(sync).get_columns('profiles')})
    if 'equipped_avatar_id' not in columns:
        await connection.execute(text('ALTER TABLE profiles ADD COLUMN equipped_avatar_id VARCHAR(120) NULL'))
    if 'equipped_title_id' not in columns:
        await connection.execute(text('ALTER TABLE profiles ADD COLUMN equipped_title_id VARCHAR(120) NULL'))
