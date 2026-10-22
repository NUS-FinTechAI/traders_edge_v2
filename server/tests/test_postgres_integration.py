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
from sqlalchemy import func, select, text
from sqlalchemy.engine import make_url

from app.auth import current_profile, token_hash
from app.campaign.models import BossResult
from app.config import Settings
from app.db import Database, LearningActivity, Profile, SessionToken, XPLedger, now
from app.game.models import Game
from app.main import create_app
from app.migrations import MIGRATIONS
from app.player import ledger
from app.research_models import ResearchCommand
from progression_fixtures import fixture_content, use_fixture_scenarios
from test_migrations import assert_v13_preserves_rows, populate_before_v12, snapshot


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
        self.assertEqual(before, after)

    async def test_upgrade_to_thirteen_preserves_populated_rows(self):
        await assert_v13_preserves_rows(self, self.database)

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

    async def test_distinct_profiles_award_xp_and_activity_concurrently(self):
        await self.profiles()
        barrier = asyncio.Barrier(2)
        async def complete(identifier):
            async with self.database.sessions.begin() as db:
                await db.scalar(select(Profile).where(Profile.id == identifier).with_for_update())
                await barrier.wait()
                await ledger.record_activity(db, identifier, now())
                return await ledger.award_xp(db, identifier, 'level-check:ch1-l1', 10, 'Level check finished', now())
        self.assertEqual(await asyncio.wait_for(asyncio.gather(complete('one'), complete('two')), 10), [10, 10])
        async with self.database.sessions() as db:
            self.assertEqual(await db.scalar(select(func.sum(XPLedger.amount))), 20)
            self.assertEqual(await db.scalar(select(func.count()).select_from(LearningActivity)), 2)

    async def test_two_players_joining_ranked_at_once_on_different_workers_share_one_match(self):
        use_fixture_scenarios(self)
        await self.database.migrate()
        workers = [create_app(self.settings, fixture_content()), create_app(self.settings, fixture_content())]
        async with AsyncExitStack() as stack:
            for app in workers:
                await stack.enter_async_context(app.router.lifespan_context(app))
            clients = [await stack.enter_async_context(httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://localhost',
                                                                         headers={'Origin': 'http://localhost:5173'})) for app in workers]
            users = [(await client.post('/api/session')).json()['profile_id'] for client in clients]
            async with self.database.sessions.begin() as db:
                db.add_all([BossResult(user_id=user, chapter_id='ch3', kind='boss', won=True, attempts=1) for user in users])

            joined = await asyncio.wait_for(asyncio.gather(*(client.post('/api/matchmaking', json={}) for client in clients)), 10)
            polled = [(await client.get('/api/matchmaking')).json() for client in clients]

        self.assertEqual([response.status_code for response in joined], [200, 200])
        self.assertEqual(sorted(response.json()['status'] for response in joined), ['matched', 'searching'])
        self.assertEqual([view['status'] for view in polled], ['matched', 'matched'])
        self.assertEqual(polled[0]['game_id'], polled[1]['game_id'])
        async with self.database.sessions() as db:
            self.assertEqual(await db.scalar(select(func.count()).select_from(Game)), 1)

    async def test_command_race_across_workers_replays_after_restart(self):
        await self.database.migrate()
        first, second = create_app(self.settings, fixture_content()), create_app(self.settings, fixture_content())
        path, payload = '/api/me/research/metadata', {'idempotency_key': 'cross-worker-command', 'prior_knowledge': 'some'}
        async with AsyncExitStack() as stack:
            for app in (first, second):
                await stack.enter_async_context(app.router.lifespan_context(app))
            clients = [await stack.enter_async_context(httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://localhost', headers={'Origin': 'http://localhost:5173'})) for app in (first, second)]
            self.assertEqual((await clients[0].post('/api/session')).status_code, 200)
            clients[1].cookies.update(clients[0].cookies)
            results = await asyncio.wait_for(asyncio.gather(*(client.post(path, json=payload) for client in clients)), 10)
            self.assertEqual([result.status_code for result in results], [200, 200])
            original = results[0].json()
            self.assertEqual(original, results[1].json())
            cookie = dict(clients[0].cookies)
        restarted = create_app(self.settings, fixture_content())
        async with restarted.router.lifespan_context(restarted):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=restarted), base_url='http://localhost', cookies=cookie, headers={'Origin': 'http://localhost:5173'}) as client:
                replay = await client.post(path, json=payload)
                self.assertEqual(replay.status_code, 200)
                self.assertEqual(replay.json(), original)
        async with self.database.sessions() as db:
            self.assertEqual(await db.scalar(select(func.count()).select_from(ResearchCommand)), 1)
