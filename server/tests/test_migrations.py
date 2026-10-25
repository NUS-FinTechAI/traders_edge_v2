from datetime import timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from sqlalchemy import MetaData, Table, inspect, select, text

from app.config import Settings
from app.db import Database, LearningActivity, Profile, RewardGrant, SessionToken, XPLedger, now
from app.economy_models import EconomyAccount, EconomyEvent
from app.game.models import Game, GameEvent, GameParticipant
from app.migrations.migration_v1 import attempts
from app.migrations.migration_v12 import TABLES, boss_results, campaign_checks, campaign_progress
from app.migrations.migration_v13 import upgrade as upgrade_v13
from app.migrations.migration_v14 import upgrade as upgrade_v14
from app.migrations.migrations import LATEST_VERSION, MIGRATIONS
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
        await db.execute(text("INSERT INTO profiles (id, display_name, leaderboard_opt_in, analytics_opt_in, equipped_avatar_id, created_at) "
                              "VALUES ('legacy', 'Legacy', true, false, 'avatar-x', :created_at)"), {'created_at': now()})
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


async def populate_before_v13(database):
    """Rows in every table migration 12 created that migration 13 touches, written with the version-12 schema."""
    await populate_before_v12(database)
    async with database.engine.begin() as connection:
        await connection.execute(campaign_progress.insert().values(user_id='legacy', level_id='ch1-l1', check_done=True, check_first_try=1,
                                                                   check_total=2, normal_star=True, special_star=False, best_profit=12.5,
                                                                   plays=1, updated_at=now()))
        await connection.execute(campaign_checks.insert().values(user_id='legacy', level_id='ch1-l1', question_id='q1', first_option_id='a',
                                                                 first_correct=True, solved=True, run_first_correct=None, run_solved=False))
        await connection.execute(boss_results.insert().values(user_id='legacy', chapter_id='ch1', kind='preview', won=True, best_profit=3,
                                                              attempts=1, first_won_at=now()))


async def assert_v13_preserves_rows(case, database):
    """Migrate a populated version-12 database to 13 twice; every earlier row survives and old check answers have no time."""
    with patch('app.migrations.migrations.MIGRATIONS', MIGRATIONS[:12]):
        await database.migrate()
    await populate_before_v13(database)
    async with database.engine.connect() as connection:
        columns, before = await connection.run_sync(snapshot)

    await database.migrate()
    async with database.engine.begin() as connection:
        await upgrade_v13(connection)

    await database.check_schema()
    async with database.engine.connect() as connection:
        _, after = await connection.run_sync(lambda sync: snapshot(sync, columns))
        answered = (await connection.execute(text('SELECT first_answered_at FROM campaign_checks'))).scalars().all()
        responses = (await connection.execute(text('SELECT COUNT(*) FROM prior_knowledge_responses'))).scalar_one()
    case.assertEqual(before, after)
    case.assertEqual(answered, [None])
    case.assertEqual(responses, 0)


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
        self.assertEqual(LATEST_VERSION, 14)
        self.assertEqual([version for version, _ in MIGRATIONS], list(range(1, 15)))
        self.assertTrue({table.name for table in TABLES} | {'prior_knowledge_responses'} <= names)

    async def test_upgrade_to_twelve_preserves_every_populated_row_and_is_repeatable(self):
        with patch('app.migrations.migrations.MIGRATIONS', MIGRATIONS[:11]):
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

    async def test_upgrade_to_thirteen_preserves_populated_rows_and_is_repeatable(self):
        await assert_v13_preserves_rows(self, self.database)

    async def test_badge_migration_preserves_profiles_and_their_existing_equipment(self):
        with patch('app.migrations.migrations.MIGRATIONS', MIGRATIONS[:13]):
            await self.database.migrate()
        await populate_before_v13(self.database)
        async with self.database.engine.connect() as connection:
            columns, before = await connection.run_sync(snapshot)

        await self.database.migrate()
        async with self.database.engine.begin() as connection:
            await upgrade_v14(connection)
        async with self.database.engine.connect() as connection:
            _, after = await connection.run_sync(lambda sync: snapshot(sync, columns))
        async with self.database.sessions() as db:
            profile = await db.get(Profile, 'legacy')
            self.assertIsNone(profile.equipped_badge_id)
            self.assertEqual(profile.equipped_avatar_id, 'avatar-x')
        self.assertEqual(before, after)
