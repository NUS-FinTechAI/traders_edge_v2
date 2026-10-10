import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


class PublicConfigTests(unittest.TestCase):
    def client(self, **overrides):
        directory = self.enterContext(tempfile.TemporaryDirectory())
        settings = Settings(database_url=f'sqlite+aiosqlite:///{directory}/config.db', **overrides)
        if settings.auth_mode == 'firebase':
            self.enterContext(patch('firebase_admin.initialize_app'))
            self.enterContext(patch('firebase_admin.delete_app'))
        return self.enterContext(TestClient(create_app(settings, {'modules': []})))

    def test_guest_config_is_readable_without_a_session(self):
        client = self.client()

        response = client.get('/api/config')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'auth': {'mode': 'guest', 'firebase_project_id': None}})
        self.assertNotIn('set-cookie', response.headers)

    def test_firebase_config_is_readable_without_a_token(self):
        client = self.client(auth_mode='firebase', firebase_project_id='test-project')

        response = client.get('/api/config')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'auth': {'mode': 'firebase', 'firebase_project_id': 'test-project'}})
        self.assertNotIn('set-cookie', response.headers)

    def test_guest_config_omits_inactive_firebase_project(self):
        client = self.client(firebase_project_id='inactive-project')

        response = client.get('/api/config')

        self.assertEqual(response.json()['auth']['firebase_project_id'], None)

    def test_config_exposes_only_public_fields_when_private_settings_are_populated(self):
        client = self.client(
            cookie_name='private-cookie-name', session_days=14,
            instructor_firebase_uids=('private-firebase-uid',),
            instructor_profile_ids=('private-profile-id',),
            research_enabled=True, research_policy_version='private-policy',
            research_policy_text='Study consent text',
        )

        response = client.get('/api/config')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'auth': {'mode': 'guest', 'firebase_project_id': None}})

    def test_config_is_not_cacheable_and_allows_the_configured_browser_origin(self):
        client = self.client()

        response = client.get('/api/config', headers={'Origin': 'http://localhost:5173'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        self.assertEqual(response.headers['Access-Control-Allow-Origin'], 'http://localhost:5173')

    def test_new_app_returns_its_own_settings(self):
        guest_client = self.client()
        self.assertEqual(guest_client.get('/api/config').json()['auth']['mode'], 'guest')
        firebase_client = self.client(auth_mode='firebase', firebase_project_id='another-project')

        response = firebase_client.get('/api/config')

        self.assertEqual(response.json(), {'auth': {'mode': 'firebase', 'firebase_project_id': 'another-project'}})
