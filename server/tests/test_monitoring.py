import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.config import Settings
from app.main import create_app
from app.monitoring import scrub_event

DSN = 'https://public@o0.ingest.sentry.io/0'


def request_event():
    return {
        'request': {
            'url': 'https://api.example.test/api/me/research/export/game-events?cursor=abc',
            'query_string': 'cursor=abc',
            'cookies': {'traders_edge_session': 'secret'},
            'data': {'idempotency_key': 'key-12345'},
            'headers': {'Authorization': 'Bearer token', 'Cookie': 'traders_edge_session=secret', 'User-Agent': 'test'},
        },
        'breadcrumbs': {'values': [{'data': {'url': 'https://oauth2.example.test/token?code=1', 'http.query': 'code=1'}}]},
    }


class StartMonitoringTests(unittest.TestCase):
    def test_sentry_is_not_started_without_a_dsn(self):
        with patch('sentry_sdk.init') as init:
            create_app(Settings())

        init.assert_not_called()

    def test_sentry_starts_without_personal_data_when_a_dsn_is_set(self):
        with patch('sentry_sdk.init') as init:
            create_app(Settings(environment='development', sentry_dsn=DSN, release='abc123'))

        options = init.call_args.kwargs
        self.assertEqual((options['dsn'], options['environment'], options['release']), (DSN, 'development', 'abc123'))
        self.assertFalse(options['send_default_pii'])
        self.assertFalse(options['include_local_variables'])
        self.assertEqual(options['max_request_body_size'], 'never')
        self.assertEqual(options['traces_sample_rate'], 0.1)
        self.assertIs(options['before_send'], scrub_event)

    def test_settings_read_the_dsn_and_render_commit_and_hide_the_dsn(self):
        with patch.dict('os.environ', {'SENTRY_DSN': DSN, 'RENDER_GIT_COMMIT': 'abc123'}, clear=True):
            settings = Settings.from_env()

        self.assertEqual((settings.sentry_dsn, settings.release), (DSN, 'abc123'))
        self.assertNotIn(DSN, repr(settings))


class ScrubEventTests(unittest.TestCase):
    def test_cookies_bodies_and_query_strings_are_removed(self):
        request = scrub_event(request_event(), {})['request']

        self.assertEqual(request, {'url': 'https://api.example.test/api/me/research/export/game-events', 'headers': {'User-Agent': 'test'}})

    def test_breadcrumb_urls_lose_their_query_strings(self):
        crumb = scrub_event(request_event(), {})['breadcrumbs']['values'][0]

        self.assertEqual(crumb['data'], {'url': 'https://oauth2.example.test/token'})

    def test_expected_client_errors_are_dropped(self):
        error = HTTPException(status_code=404)

        self.assertIsNone(scrub_event(request_event(), {'exc_info': (HTTPException, error, None)}))

    def test_server_errors_are_kept(self):
        error = HTTPException(status_code=503)

        self.assertIsNotNone(scrub_event(request_event(), {'exc_info': (HTTPException, error, None)}))

    def test_events_without_a_request_are_unchanged(self):
        self.assertEqual(scrub_event({'message': 'boom'}, None), {'message': 'boom'})
