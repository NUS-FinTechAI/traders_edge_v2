"""Ordered schema changes. Append a migration; never edit a deployed version."""

from sqlalchemy import select

LATEST_VERSION = 2


async def initial_schema(connection):
    from app.migration_v1 import metadata
    await connection.run_sync(metadata.create_all)


from app.migration_v2 import upgrade as simulation_commands

MIGRATIONS = ((1, initial_schema), (2, simulation_commands))


async def migrate(engine):
    from app.db import SchemaVersion
    async with engine.begin() as connection:
        await connection.run_sync(lambda sync: SchemaVersion.__table__.create(sync, checkfirst=True))
        recorded = list((await connection.execute(select(SchemaVersion.version).order_by(SchemaVersion.version))).scalars())
        if recorded != list(range(1, max(recorded, default=0) + 1)) or max(recorded, default=0) > LATEST_VERSION:
            raise RuntimeError('Unsupported or incomplete migration history')
        for version, upgrade in MIGRATIONS:
            if version not in recorded:
                await upgrade(connection)
                await connection.execute(SchemaVersion.__table__.insert().values(version=version))
