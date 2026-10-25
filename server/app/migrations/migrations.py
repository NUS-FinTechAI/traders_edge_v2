"""Ordered schema changes. Append a migration; never edit a deployed version."""

from sqlalchemy import select

LATEST_VERSION = 14


async def initial_schema(connection):
    from app.migrations.migration_v1 import metadata
    await connection.run_sync(metadata.create_all)


from app.migrations.migration_v2 import upgrade as simulation_commands

from app.migrations.migration_v3 import upgrade as learning_runs

from app.migrations.migration_v4 import upgrade as rewards

from app.migrations.migration_v5 import upgrade as challenges

from app.migrations.migration_v6 import upgrade as economy

from app.migrations.migration_v7 import upgrade as adventure
from app.migrations.migration_v8 import upgrade as quizzes
from app.migrations.migration_v9 import upgrade as multiplayer
from app.migrations.migration_v10 import upgrade as research
from app.migrations.migration_v11 import upgrade as games
from app.migrations.migration_v12 import upgrade as progression
from app.migrations.migration_v13 import upgrade as research_instruments
from app.migrations.migration_v14 import upgrade as equipped_badges

MIGRATIONS = ((1, initial_schema), (2, simulation_commands), (3, learning_runs), (4, rewards), (5, challenges), (6, economy), (7, adventure), (8, quizzes), (9, multiplayer), (10, research), (11, games), (12, progression), (13, research_instruments), (14, equipped_badges))


async def migrate(engine):
    from app.db import SchemaVersion
    async with engine.begin() as connection:
        await connection.run_sync(lambda sync: SchemaVersion.__table__.create(sync, checkfirst=True))
        recorded = list((await connection.execute(select(SchemaVersion.version).order_by(SchemaVersion.version))).scalars())
        if recorded != list(range(1, max(recorded, default=0) + 1)) or max(recorded, default=0) > LATEST_VERSION:
            raise RuntimeError('Unsupported or incomplete migration history')
        applied = []
        for version, upgrade in MIGRATIONS:
            if version not in recorded:
                await upgrade(connection)
                await connection.execute(SchemaVersion.__table__.insert().values(version=version))
                applied.append(version)
    return applied
