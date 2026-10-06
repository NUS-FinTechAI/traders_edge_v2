"""Opt-in tests against a disposable loopback PostgreSQL database."""
import asyncio
from contextlib import AsyncExitStack
from datetime import timedelta
import os
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import uuid

from fastapi import Request
import httpx
from sqlalchemy import MetaData, Table, func, inspect, select, text
from sqlalchemy.engine import make_url

from app.auth import current_profile, token_hash
from app.config import Settings
from app.db import AggregateEvent, Attempt, Database, JournalEntry, LearningActivity, LearningRun, LearningRunCommand, LessonCompletion, MasteredModule, Profile, ReviewItem, SessionToken, SimulationSession, XPLedger, now
from app.main import create_app
from app.migrations import MIGRATIONS
from app.progression import reward
from app.simulation import engine
from app.simulation.api import SimulationCommand


TEST_URL = os.getenv('TRADERS_EDGE_TEST_POSTGRES_URL')


def checked_url(value):
    url = make_url(value)
    if url.drivername != 'postgresql+psycopg' or url.host not in {'localhost', '127.0.0.1', '::1'} or not (url.database or '').startswith('traders_edge_qa'):
        raise ValueError('PostgreSQL tests require a loopback traders_edge_qa database')
    if url.query:
        raise ValueError('PostgreSQL test URL must not override connection options')
    return url


@unittest.skipUnless(TEST_URL, 'Set TRADERS_EDGE_TEST_POSTGRES_URL for live PostgreSQL tests')
class PostgreSQLIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        base_url = checked_url(TEST_URL)
        self.admin = Database(Settings(database_url=base_url.render_as_string(hide_password=False)))
        self.schema = 'traders_edge_qa_' + uuid.uuid4().hex
        async with self.admin.engine.begin() as connection:
            await connection.execute(text(f'CREATE SCHEMA "{self.schema}"'))
        self.url = base_url.update_query_dict({'options': f'-csearch_path={self.schema}'}).render_as_string(hide_password=False)
        self.database = Database(Settings(database_url=self.url))
        self.settings = Settings(database_url=self.url, auto_migrate=False)

    async def asyncTearDown(self):
        await self.database.engine.dispose()
        async with self.admin.engine.begin() as connection:
            await connection.execute(text(f'DROP SCHEMA "{self.schema}" CASCADE'))
        await self.admin.engine.dispose()

    async def profiles(self):
        await self.database.migrate()
        async with self.database.sessions.begin() as db:
            db.add_all([Profile(id='one', analytics_opt_in=True), Profile(id='two', analytics_opt_in=True)])

    async def test_populated_migrations_preserve_all_prior_rows(self):
        from app.migration_v1 import profiles
        with patch('app.migrations.MIGRATIONS', MIGRATIONS[:3]):
            await self.database.migrate()
        async with self.database.sessions.begin() as db:
            await db.execute(profiles.insert().values(id='legacy', display_name='Learner', leaderboard_opt_in=False, analytics_opt_in=False, created_at=now()))
            db.add(Attempt(id='attempt', user_id='legacy', kind='lesson', target_id='lesson', idempotency_key='attempt-key', request_hash='a' * 64, answers=[{'first': True}], reflection='Preserved reasoning', score=100, passed=True, result={'xp_awarded': 20}))
            db.add(LearningRun(id='run', user_id='legacy', purpose='practice', module_id='module', level_id='lesson', content_version='v1', status='completed', snapshot_json={'private': True}, state_json={'result': {'attempt_id': 'attempt'}}))
            db.add(SimulationSession(id='simulation', user_id='legacy', mode='guided', scenario_kind='sideways', version=engine.VERSION, snapshot_json=engine.new_session(17, 'sideways', 30)))
            await db.flush()
            db.add_all([
                SessionToken(token_hash='b' * 64, user_id='legacy', expires_at=now() + timedelta(days=1)),
                LessonCompletion(user_id='legacy', lesson_id='lesson', attempt_id='attempt'),
                MasteredModule(user_id='legacy', module_id='module', attempt_id='attempt'),
                ReviewItem(id='review', user_id='legacy', lesson_id='lesson', due_at=now()),
                XPLedger(user_id='legacy', event_key='lesson:lesson', amount=20, reason='Passed reasoning'),
                LearningActivity(user_id='legacy', day='2026-10-06'),
                JournalEntry(id='journal', user_id='legacy', text='Preserved private note'),
                AggregateEvent(day='2026-10-06', kind='learning_completed', count=1),
                LearningRunCommand(user_id='legacy', key='run-key', run_id='run', request_hash='c' * 64, response={'saved': True}),
                SimulationCommand(user_id='legacy', key='simulation-key', session_id='simulation', request_hash='d' * 64, response={'saved': 'original'}),
            ])
        def rows(connection, original_columns=None):
            tables = {name: Table(name, MetaData(), autoload_with=connection) for name in inspect(connection).get_table_names() if name != 'schema_versions'}
            columns = original_columns or {name: list(table.columns.keys()) for name, table in tables.items()}
            return columns, {name: list(connection.execute(select(*(tables[name].c[column] for column in names)).order_by(*tables[name].primary_key.columns)).mappings()) for name, names in columns.items()}
        async with self.database.engine.connect() as connection:
            columns, before = await connection.run_sync(rows)
        self.assertEqual(len(before), 14)
        self.assertTrue(all(len(values) == 1 for values in before.values()))
        await self.database.migrate()
        await self.database.migrate()
        await self.database.check_schema()
        async with self.database.engine.connect() as connection:
            _, after = await connection.run_sync(lambda sync: rows(sync, columns))
        self.assertEqual(before, after)
        async with self.database.sessions() as db:
            profile = await db.get(Profile, 'legacy')
            self.assertIsNone(profile.equipped_avatar_id)
            self.assertIsNone(profile.equipped_title_id)

    async def test_profile_lock_waits_then_refreshes_cached_identity(self):
        await self.profiles()
        async with self.database.sessions.begin() as db:
            db.add(SessionToken(token_hash=token_hash('local-token'), user_id='one', expires_at=now() + timedelta(days=1)))
        request = Request({'type': 'http', 'method': 'PATCH', 'headers': [(b'cookie', b'traders_edge_session=local-token')], 'app': SimpleNamespace(state=SimpleNamespace(settings=self.settings))})
        async with self.database.sessions() as reader, self.database.sessions() as writer:
            async with reader.begin():
                cached = await reader.get(Profile, 'one')
                async with writer.begin():
                    updated = await writer.scalar(select(Profile).where(Profile.id == 'one').with_for_update())
                    updated.display_name = 'Committed while waiting'
                    await writer.flush()
                    waiting = asyncio.create_task(current_profile(request, reader))
                    await asyncio.sleep(0.1)
                    self.assertFalse(waiting.done(), 'FOR UPDATE must wait for the conflicting transaction')
                refreshed = await asyncio.wait_for(waiting, 5)
                self.assertIs(cached, refreshed)
                self.assertEqual(refreshed.display_name, 'Committed while waiting')

    async def test_distinct_profile_rewards_atomically_increment_shared_counter(self):
        await self.profiles()
        barrier = asyncio.Barrier(2)
        async def complete(identifier):
            async with self.database.sessions.begin() as db:
                profile = await db.scalar(select(Profile).where(Profile.id == identifier).with_for_update())
                await barrier.wait()
                return await reward(db, profile, 'lesson:concurrent', 20, 'Passed reasoning')
        self.assertEqual(await asyncio.wait_for(asyncio.gather(complete('one'), complete('two')), 10), [20, 20])
        async with self.database.sessions() as db:
            self.assertEqual(await db.scalar(select(AggregateEvent.count)), 2)
            self.assertEqual(await db.scalar(select(func.sum(XPLedger.amount))), 40)
            self.assertEqual(await db.scalar(select(func.count()).select_from(LearningActivity)), 2)

    async def test_command_race_across_workers_replays_after_restart(self):
        await self.database.migrate()
        first, second = create_app(self.settings), create_app(self.settings)
        async with AsyncExitStack() as stack:
            for app in (first, second):
                await stack.enter_async_context(app.router.lifespan_context(app))
            clients = [await stack.enter_async_context(httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://localhost', headers={'Origin': 'http://localhost:5173'})) for app in (first, second)]
            session = await clients[0].post('/api/session')
            self.assertEqual(session.status_code, 200)
            clients[1].cookies.update(clients[0].cookies)
            path = '/api/modules/m01-money-before-markets/diagnostic-runs'
            payload = {'idempotency_key': 'cross-worker-command'}
            results = await asyncio.wait_for(asyncio.gather(*(client.post(path, json=payload) for client in clients)), 10)
            self.assertEqual([result.status_code for result in results], [200, 200])
            original = results[0].json()
            self.assertEqual(original, results[1].json())
            cookie = dict(clients[0].cookies)
        restarted = create_app(self.settings)
        async with restarted.router.lifespan_context(restarted):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=restarted), base_url='http://localhost', cookies=cookie, headers={'Origin': 'http://localhost:5173'}) as client:
                replay = await client.post(path, json=payload)
                self.assertEqual(replay.status_code, 200)
                self.assertEqual(replay.json(), original)
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=restarted), base_url='http://localhost', headers={'Origin': 'http://localhost:5173'}) as stranger:
                    self.assertEqual((await stranger.post('/api/session')).status_code, 200)
                    isolated = await stranger.get('/api/learning-runs/' + original['id'])
                    self.assertEqual(isolated.status_code, 403)
        async with self.database.sessions() as db:
            self.assertEqual(await db.scalar(select(func.count()).select_from(LearningRunCommand)), 1)
            self.assertEqual(await db.scalar(select(func.count()).select_from(LearningRun)), 1)
