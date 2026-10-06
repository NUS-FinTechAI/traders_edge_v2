from datetime import timedelta
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from fastapi import HTTPException, Request

from app.auth import current_profile, token_hash
from app.config import Settings
from app.db import Base, Database, Profile, SessionToken, now


class AuthConsistencyTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.database = Database(Settings(database_url=f'sqlite+aiosqlite:///{self.temp.name}/auth.db'))
        self.addAsyncCleanup(self.database.engine.dispose)
        async with self.database.engine.begin() as connection:
            await connection.run_sync(lambda sync: Base.metadata.create_all(sync, tables=[Profile.__table__, SessionToken.__table__]))
        async with self.database.sessions() as db:
            profile = Profile(firebase_uid='verified-user', analytics_opt_in=True, display_name='Before')
            db.add(profile)
            await db.flush()
            self.profile_id = profile.id
            db.add(SessionToken(token_hash=token_hash('guest-token'), user_id=profile.id, expires_at=now() + timedelta(days=1)))
            await db.commit()

    def request(self, mode):
        settings = Settings(auth_mode=mode)
        app = SimpleNamespace(state=SimpleNamespace(settings=settings, firebase_app=object()))
        headers = [(b'authorization', b'Bearer verified-token')] if mode == 'firebase' else [(b'cookie', f'{settings.cookie_name}=guest-token'.encode())]
        return Request({'type': 'http', 'method': 'PATCH', 'path': '/api/me/profile', 'headers': headers, 'app': app})

    async def assert_refreshed_profile(self, request):
        async with self.database.sessions() as cached_db:
            cached = await cached_db.get(Profile, self.profile_id)
            self.assertTrue(cached.analytics_opt_in)
            self.assertEqual(cached.display_name, 'Before')
            async with self.database.sessions() as other_db:
                updated = await other_db.get(Profile, self.profile_id)
                updated.analytics_opt_in = False
                updated.display_name = 'After'
                await other_db.commit()
            self.assertTrue(cached.analytics_opt_in)
            profile = await current_profile(request, cached_db)
            self.assertIs(profile, cached)
            self.assertEqual((profile.analytics_opt_in, profile.display_name), (False, 'After'))

    async def test_guest_mutation_refreshes_cached_profile(self):
        await self.assert_refreshed_profile(self.request('guest'))

    async def test_firebase_mutation_refreshes_cached_profile(self):
        request = self.request('firebase')
        with patch('firebase_admin.auth.verify_id_token', return_value={'uid': 'verified-user'}) as verify:
            await self.assert_refreshed_profile(request)
            verify.assert_called_once_with('verified-token', app=request.app.state.firebase_app, check_revoked=True)

    async def test_deleted_profile_at_locked_load_returns_401(self):
        async with self.database.sessions() as cached_db:
            cached = await cached_db.get(Profile, self.profile_id)
            cached_token = await cached_db.get(SessionToken, token_hash('guest-token'))
            async with self.database.sessions() as other_db:
                deleted = await other_db.get(Profile, self.profile_id)
                await other_db.delete(deleted)
                await other_db.commit()
            self.assertIs(await cached_db.get(Profile, self.profile_id), cached)
            self.assertIs(await cached_db.get(SessionToken, token_hash('guest-token')), cached_token)
            with self.assertRaises(HTTPException) as error:
                await current_profile(self.request('guest'), cached_db)
            self.assertEqual(error.exception.status_code, 401)
            self.assertEqual(error.exception.detail, 'Session is unavailable')
