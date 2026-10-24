import logging
import tempfile
import unittest
from unittest import mock

from fastapi.testclient import TestClient
from app.config import Settings
from app.logs import log_level_for
from app.main import create_app
from progression_fixtures import fixture_content


class RequestLoggingTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        app = create_app(Settings(database_url=f'sqlite+aiosqlite:///{directory.name}/logs.db'), fixture_content())
        self.client = TestClient(app)
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)

    def logged(self, method, path, level=logging.DEBUG, **kwargs):
        with self.assertLogs('app.request', level) as captured:
            response = self.client.request(method, path, **kwargs)
        return response, captured.output

    def test_generates_a_request_id_and_logs_route_status_and_duration(self):
        response, lines = self.logged('GET', '/')

        request_id = response.headers['X-Request-ID']
        self.assertRegex(request_id, r'^[0-9a-f]{32}$')
        self.assertEqual(len(lines), 1)
        self.assertRegex(lines[0], rf'^INFO:app\.request:GET / 200 \d+\.\dms rid={request_id}$')

    def test_honours_a_valid_incoming_request_id_and_replaces_an_invalid_one(self):
        kept, _ = self.logged('GET', '/', headers={'X-Request-ID': 'trace-123.abc_DEF'})
        replaced, lines = self.logged('GET', '/', headers={'X-Request-ID': 'bad id with spaces and a very long tail' * 4})

        self.assertEqual(kept.headers['X-Request-ID'], 'trace-123.abc_DEF')
        self.assertRegex(replaced.headers['X-Request-ID'], r'^[0-9a-f]{32}$')
        self.assertNotIn('bad id', lines[0])

    def test_logs_the_route_template_without_query_string_or_credentials(self):
        response, lines = self.logged('GET', '/api/campaign/levels/ch1-l1?token=secret-token&email=a@b.co',
                                      headers={'Authorization': 'Bearer secret-bearer', 'Cookie': 'traders_edge_session=secret-cookie'})
        text = '\n'.join(lines)

        self.assertIn('/api/campaign/levels/{level_id}', text)
        for private in ('secret-token', 'a@b.co', 'secret-bearer', 'secret-cookie', 'ch1-l1', '?', 'testclient'):
            self.assertNotIn(private, text)
        self.assertIn(f' {response.status_code} ', text)

    def test_unknown_paths_are_not_logged_verbatim(self):
        response, lines = self.logged('GET', '/private/path/abc123')

        self.assertEqual(response.status_code, 404)
        self.assertIn('WARNING:app.request:GET <unmatched> 404', lines[0])
        self.assertNotIn('abc123', lines[0])

    def test_health_checks_are_only_logged_at_debug(self):
        with self.assertNoLogs('app.request', logging.INFO):
            self.assertEqual(self.client.get('/health').status_code, 200)
        _, lines = self.logged('GET', '/health')

        self.assertTrue(lines[0].startswith('DEBUG:app.request:GET /health 200'))

    def test_levels_follow_the_status_class(self):
        self.assertEqual([log_level_for('/x', status) for status in (200, 302, 404, 422, 500, 503)],
                         [logging.INFO, logging.INFO, logging.WARNING, logging.WARNING, logging.ERROR, logging.ERROR])
        self.assertEqual(log_level_for('/health', 500), logging.ERROR)


class LogLevelSettingTests(unittest.TestCase):
    def test_log_level_is_validated(self):
        Settings(log_level='DEBUG').validate()
        with self.assertRaises(ValueError):
            Settings(log_level='LOUD').validate()

    def test_log_level_comes_from_the_environment(self):
        with mock.patch.dict('os.environ', {'LOG_LEVEL': ' warning '}):
            self.assertEqual(Settings.from_env().log_level, 'WARNING')
        with mock.patch.dict('os.environ', {}, clear=True):
            self.assertEqual(Settings.from_env().log_level, 'INFO')
