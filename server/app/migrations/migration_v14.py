"""An optional equipped badge; existing profiles keep no badge selected."""
from sqlalchemy import inspect, text


def _add_badge(sync):
    if 'equipped_badge_id' not in {column['name'] for column in inspect(sync).get_columns('profiles')}:
        sync.execute(text('ALTER TABLE profiles ADD COLUMN equipped_badge_id VARCHAR(120)'))


async def upgrade(connection):
    await connection.run_sync(_add_badge)
