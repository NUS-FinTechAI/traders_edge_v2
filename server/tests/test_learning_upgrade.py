import asyncio
import tempfile
import unittest
from unittest.mock import patch

from sqlalchemy import inspect, select

from app.config import Settings
from app.db import Attempt, Database, LessonCompletion, MasteredModule, ReviewItem, SchemaVersion, XPLedger, now
from app.migration_v1 import profiles
from app.migrations import MIGRATIONS


class LearningUpgradeTests(unittest.TestCase):
    def test_populated_v2_upgrade_preserves_all_evidence(self):
        async def exercise(directory):
            database = Database(Settings(database_url=f'sqlite+aiosqlite:///{directory}/upgrade.db'))
            with patch('app.migrations.MIGRATIONS', MIGRATIONS[:2]):
                await database.migrate()
            async with database.sessions.begin() as db:
                await db.execute(profiles.insert().values(id='legacy-user', display_name='Learner', leaderboard_opt_in=False, analytics_opt_in=False, created_at=now()))
                db.add(Attempt(id='legacy-attempt', user_id='legacy-user', kind='lesson', target_id='m01-l01', idempotency_key='legacy-key', request_hash='a' * 64, answers=[{'historical': 'answer'}], reflection='Historical reflection', score=100, passed=True, result={'original': True}))
                await db.flush()
                db.add_all([LessonCompletion(user_id='legacy-user', lesson_id='m01-l01', attempt_id='legacy-attempt'), MasteredModule(user_id='legacy-user', module_id='historical-module', attempt_id='legacy-attempt'), XPLedger(user_id='legacy-user', event_key='lesson:m01-l01', amount=20, reason='Historical reward'), ReviewItem(id='legacy-review', user_id='legacy-user', lesson_id='m01-l01', due_at=now())])
            async with database.engine.connect() as connection:
                before = await connection.run_sync(lambda c: set(inspect(c).get_table_names()))
            with patch('app.migrations.MIGRATIONS', MIGRATIONS[:3]):
                await database.migrate()
            async with database.engine.connect() as connection:
                version_three = await connection.run_sync(lambda c: set(inspect(c).get_table_names()))
                versions = list((await connection.execute(select(SchemaVersion.version).order_by(SchemaVersion.version))).scalars())
            self.assertEqual(version_three - before, {'learning_runs', 'learning_run_commands'})
            self.assertEqual(versions, [1, 2, 3])
            with patch('app.migrations.MIGRATIONS', MIGRATIONS[:4]):
                await database.migrate()
                await database.migrate()
            async with database.engine.connect() as connection:
                after = await connection.run_sync(lambda c: set(inspect(c).get_table_names()))
            self.assertEqual(after - before, {'learning_runs', 'learning_run_commands', 'reward_grants', 'reward_commands'})
            async with database.sessions() as db:
                self.assertEqual(list((await db.scalars(select(SchemaVersion.version).order_by(SchemaVersion.version))).all()), [1, 2, 3, 4])
                self.assertEqual((await db.get(Attempt, 'legacy-attempt')).result, {'original': True})
                self.assertEqual((await db.get(Attempt, 'legacy-attempt')).answers, [{'historical': 'answer'}])
                self.assertEqual((await db.get(XPLedger, ('legacy-user', 'lesson:m01-l01'))).amount, 20)
                self.assertIsNotNone(await db.get(LessonCompletion, ('legacy-user', 'm01-l01')))
                self.assertIsNotNone(await db.get(MasteredModule, ('legacy-user', 'historical-module')))
                self.assertIsNotNone(await db.get(ReviewItem, 'legacy-review'))
            await database.migrate()
            await database.check_schema()
            await database.engine.dispose()
        with tempfile.TemporaryDirectory() as directory:
            asyncio.run(exercise(directory))
