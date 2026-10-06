import asyncio
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from sqlalchemy import func, select

from app.config import Settings
from app.db import AggregateEvent, Database, LearningActivity, Profile, XPLedger
from app.progression import reward


class AggregateEventTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = TemporaryDirectory()
        self.database = Database(Settings(database_url=f'sqlite+aiosqlite:///{Path(self.directory.name) / "events.db"}'))
        await self.database.migrate()
        async with self.database.sessions.begin() as db:
            db.add_all([Profile(id='one', analytics_opt_in=True), Profile(id='two', analytics_opt_in=True), Profile(id='private', analytics_opt_in=False)])
        self.instant = datetime(2026, 10, 6, tzinfo=timezone.utc)
        self.clock = patch('app.progression.now', return_value=self.instant)
        self.clock.start()

    async def asyncTearDown(self):
        self.clock.stop()
        await self.database.engine.dispose()
        self.directory.cleanup()

    async def test_distinct_learners_can_create_the_first_daily_aggregate(self):
        barrier = asyncio.Barrier(2)
        first_committed = asyncio.Event()

        async def complete(identifier):
            try:
                async with self.database.sessions(autoflush=False) as db:
                    async with db.begin():
                        profile = await db.scalar(select(Profile).where(Profile.id == identifier).with_for_update().execution_options(populate_existing=True))
                        original_get = db.get

                        async def interleaved_get(model, *args, **kwargs):
                            result = await original_get(model, *args, **kwargs)
                            if model is AggregateEvent and result is None:
                                await barrier.wait()
                                if identifier == 'two':
                                    await first_committed.wait()
                            return result

                        db.get = interleaved_get
                        amount = await reward(db, profile, 'lesson:race', 20, 'Passed reasoning check')
                    return amount
            finally:
                if identifier == 'one':
                    first_committed.set()

        # Control absent-row reads without the SQLite request-wide writer lock.
        # This models the cross-profile interleaving; it is not a live PostgreSQL test.
        results = await asyncio.wait_for(asyncio.gather(complete('one'), complete('two'), return_exceptions=True), timeout=10)
        self.assertEqual(results, [20, 20])
        async with self.database.sessions() as db:
            aggregate = await db.get(AggregateEvent, ('2026-10-06', 'learning_completed'))
            self.assertEqual(aggregate.count, 2)
            self.assertEqual(await db.scalar(select(func.count()).select_from(XPLedger)), 2)
            self.assertEqual(await db.scalar(select(func.count()).select_from(LearningActivity)), 2)

    async def test_existing_count_and_event_replay_preserve_totals(self):
        async with self.database.sessions.begin() as db:
            db.add(AggregateEvent(day='2026-10-06', kind='learning_completed', count=7))
        for identifier in ('one', 'two'):
            async with self.database.sessions.begin() as db:
                profile = await db.get(Profile, identifier)
                self.assertEqual(await reward(db, profile, 'lesson:once', 20, 'Passed reasoning check'), 20)
                self.assertEqual(await reward(db, profile, 'lesson:once', 20, 'Passed reasoning check'), 0)
        async with self.database.sessions() as db:
            self.assertEqual((await db.get(AggregateEvent, ('2026-10-06', 'learning_completed'))).count, 9)
            self.assertEqual(await db.scalar(select(func.sum(XPLedger.amount))), 40)

    async def test_analytics_opt_out_keeps_learning_without_aggregate(self):
        async with self.database.sessions.begin() as db:
            profile = await db.get(Profile, 'private')
            self.assertEqual(await reward(db, profile, 'lesson:private', 20, 'Passed reasoning check'), 20)
        async with self.database.sessions() as db:
            self.assertEqual(await db.scalar(select(func.count()).select_from(AggregateEvent)), 0)
            self.assertEqual(await db.scalar(select(func.sum(XPLedger.amount))), 20)
            self.assertEqual(await db.scalar(select(func.count()).select_from(LearningActivity)), 1)

    async def test_aggregate_rolls_back_with_learning_then_retry_counts_once(self):
        with self.assertRaisesRegex(RuntimeError, 'Abort after reward'):
            async with self.database.sessions.begin() as db:
                profile = await db.get(Profile, 'one')
                await reward(db, profile, 'lesson:rollback', 20, 'Passed reasoning check')
                raise RuntimeError('Abort after reward')
        async with self.database.sessions() as db:
            for model in (AggregateEvent, XPLedger, LearningActivity):
                self.assertEqual(await db.scalar(select(func.count()).select_from(model)), 0)
        async with self.database.sessions.begin() as db:
            profile = await db.get(Profile, 'one')
            self.assertEqual(await reward(db, profile, 'lesson:rollback', 20, 'Passed reasoning check'), 20)
            self.assertEqual(await reward(db, profile, 'lesson:rollback', 20, 'Passed reasoning check'), 0)
        async with self.database.sessions() as db:
            self.assertEqual((await db.get(AggregateEvent, ('2026-10-06', 'learning_completed'))).count, 1)
            self.assertEqual(await db.scalar(select(func.sum(XPLedger.amount))), 20)
            self.assertEqual(await db.scalar(select(func.count()).select_from(LearningActivity)), 1)


if __name__ == '__main__':
    unittest.main()
