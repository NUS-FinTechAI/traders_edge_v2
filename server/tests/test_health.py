import unittest

from fastapi.testclient import TestClient
from app.main import app


class HealthTests(unittest.TestCase):
    def test_health_is_available_without_credentials(self):
        with TestClient(app) as client:
            response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_unknown_route_is_not_a_success(self):
        with TestClient(app) as client:
            response = client.get("/missing")
        self.assertEqual(response.status_code, 404)
