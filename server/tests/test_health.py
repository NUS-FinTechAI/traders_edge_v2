import tempfile
import unittest

from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app
from progression_fixtures import fixture_content


class HealthTests(unittest.TestCase):
    def test_health_and_unknown_route_without_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            app = create_app(Settings(database_url=f'sqlite+aiosqlite:///{directory}/health.db'), fixture_content())
            with TestClient(app) as client:
                self.assertEqual(client.get('/health').json(), {'status': 'ok'})
                self.assertEqual(client.get('/missing').status_code, 404)
