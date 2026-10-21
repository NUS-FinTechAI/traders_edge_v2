from datetime import timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from sqlalchemy import MetaData, Table, inspect, select

from app.config import Settings
from app.db import Database, LearningActivity, Profile, RewardGrant, SessionToken, XPLedger, now
from app.economy_models import EconomyAccount, EconomyEvent
from app.game.models import Game, GameEvent, GameParticipant
from app.migration_v1 import attempts
from app.migration_v12 import TABLES
from app.migrations import LATEST_VERSION, MIGRATIONS
from app.research_models import ResearchParticipant


def snapshot(connection, columns=None):
    names = [name for name in inspect(connection).get_table_names() if name != 'schema_versions']
    tables = {name: Table(name, MetaData(), autoload_with=connection) for name in names}
    columns = columns or {name: list(table.columns.keys()) for name, table in tables.items()}
    return columns, {name: [dict(row) for row in connection.execute(select(*(tables[name].c[c] for c in cols))
                                                                     .order_by(*tables[name].primary_key.columns)).mappings()]
                     for name, cols in columns.items()}


async def populate_before_v12(database):
    async with database.sessions.begin() as db:
        db.add(Profile(id='legacy', display_name='Legacy', leaderboard_opt_in=True, analytics_opt_in=False, equipped_avatar_id='avatar-x'))
        await db.flush()
        await db.execute(attempts.insert().values(id='attempt', user_id='legacy', kind='lesson', target_id='lesson', idempotency_key='attempt-key',
                                                  request_hash='a' * 64, answers=[], reflection='Kept', score=100, passed=True, result={},
                                                  created_at=now()))
        db.add_all([
            SessionToken(token_hash='b' * 64, user_id='legacy', expires_at=now() + timedelta(days=1)),
            XPLedger(user_id='legacy', event_key='lesson:lesson', amount=20, reason='Passed', created_at=now()),
            LearningActivity(user_id='legacy', day='2026-10-06'),
            RewardGrant(user_id='legacy', item_id='avatar-x', rule_version='1', public_snapshot={}, evidence=[], created_at=now()),
            EconomyAccount(user_id='legacy', stocks_week='2026-10-05', stocks_balance=40, premium_balance=7, login_streak=2),
            EconomyEvent(user_id='legacy', event_key='login:2026-10-06', policy_version='1', stocks_delta=20, premium_delta=0, xp_delta=5,
                         context={}, response={}, created_at=now()),
            ResearchParticipant(user_id='legacy', prior_knowledge='some', consented=False),
            Game(id='game', mode='practice', scenario_id='practice-trend-rider', scenario_version=1, seed=1, status='settled', clock={},
                 context={}, host_user_id='legacy'),
        ])
        await db.flush()
        db.add(GameParticipant(id='participant', game_id='game', user_id='legacy', display_name='Legacy', forfeited=False, result={'won': True}))
        await db.flush()
        db.add(GameEvent(id='event', game_id='game', participant_id='participant', tick=0, kind='start', payload={'plan': None}))


class MigrationChainTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.database = Database(Settings(database_url=f'sqlite+aiosqlite:///{Path(self.directory.name) / "chain.db"}'))
        self.addAsyncCleanup(self.database.engine.dispose)

    async def test_fresh_database_migrates_one_through_latest_and_passes_the_schema_check(self):
        await self.database.migrate()

        await self.database.check_schema()
        async with self.database.engine.connect() as connection:
            names = await connection.run_sync(lambda sync: set(inspect(sync).get_table_names()))
        self.assertEqual(LATEST_VERSION, 12)
        self.assertEqual([version for version, _ in MIGRATIONS], list(range(1, 13)))
        self.assertTrue({table.name for table in TABLES} <= names)

    async def test_upgrade_to_twelve_preserves_every_populated_row_and_is_repeatable(self):
        with patch('app.migrations.MIGRATIONS', MIGRATIONS[:11]):
            await self.database.migrate()
        await populate_before_v12(self.database)
        async with self.database.engine.connect() as connection:
            columns, before = await connection.run_sync(snapshot)

        await self.database.migrate()
        await self.database.migrate()

        await self.database.check_schema()
        async with self.database.engine.connect() as connection:
            _, after = await connection.run_sync(lambda sync: snapshot(sync, columns))
            _, added = await connection.run_sync(lambda sync: snapshot(sync, {table.name: [c.name for c in table.columns] for table in TABLES}))
        self.assertEqual(before, after)
        self.assertTrue(all(rows == [] for rows in added.values()))
        self.assertEqual(sum(bool(rows) for rows in before.values()), 12)
