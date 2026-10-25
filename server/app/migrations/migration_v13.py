"""Prior-knowledge onboarding responses and the time of each first check answer; earlier tables keep every row."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, MetaData, String, Table, inspect, text
from app.migration_v1 import profiles

metadata = MetaData()
profiles.to_metadata(metadata)
prior_knowledge_responses = Table(
    'prior_knowledge_responses', metadata,
    Column('user_id', String(36), ForeignKey('profiles.id'), primary_key=True),
    Column('instrument_version', String(40), nullable=False),
    Column('consent_version', String(80), nullable=False),
    Column('status', String(10), nullable=False),
    Column('experience', String(10), nullable=True),
    Column('brokerage_account', Boolean, nullable=True),
    Column('market_frequency', String(10), nullable=True),
    Column('confidence', Integer, nullable=True),
    Column('answers', JSON, nullable=False),
    Column('score', Integer, nullable=True),
    Column('prior_knowledge_group', String(20), nullable=False),
    Column('elapsed_seconds', Integer, nullable=True),
    Column('recorded_at', DateTime(timezone=True), nullable=False),
)
FIRST_ANSWERED_AT = Column('first_answered_at', DateTime(timezone=True), nullable=True)


def _add_first_answered_at(sync):
    """Existing first answers keep a null time: they cannot be placed inside a consent period."""
    if FIRST_ANSWERED_AT.name in {column['name'] for column in inspect(sync).get_columns('campaign_checks')}:
        return
    column_type = FIRST_ANSWERED_AT.type.compile(dialect=sync.dialect)
    sync.execute(text(f'ALTER TABLE campaign_checks ADD COLUMN {FIRST_ANSWERED_AT.name} {column_type}'))


async def upgrade(connection):
    await connection.run_sync(lambda sync: prior_knowledge_responses.create(sync, checkfirst=True))
    await connection.run_sync(_add_first_answered_at)
