import unittest
from unittest.mock import patch

from app.config import Settings, database_url

POSTGRES = 'postgresql+psycopg://user:pass@db:5432/traders_edge'
HTTPS = ('https://traders-edge.vercel.app',)


class DatabaseUrlTests(unittest.TestCase):
    def test_plain_postgres_urls_use_the_psycopg_driver(self):
        self.assertEqual(database_url('postgres://user:pass@db:5432/te'), 'postgresql+psycopg://user:pass@db:5432/te')
        self.assertEqual(database_url('postgresql://user:pass@db:5432/te'), 'postgresql+psycopg://user:pass@db:5432/te')

    def test_driver_and_sqlite_urls_are_unchanged(self):
        self.assertEqual(database_url(POSTGRES), POSTGRES)
        self.assertEqual(database_url('sqlite+aiosqlite:///:memory:'), 'sqlite+aiosqlite:///:memory:')

    def test_environment_url_is_normalised_when_loading_settings(self):
        with patch.dict('os.environ', {'DATABASE_URL': 'postgres://u:p@h/db'}, clear=True):
            self.assertEqual(Settings.from_env().database_url, 'postgresql+psycopg://u:p@h/db')


class EnvironmentTests(unittest.TestCase):
    def test_unknown_environment_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'APP_ENV'):
            Settings(environment='prod').validate()

    def test_staging_allows_guest_play_on_postgres_over_https(self):
        settings = Settings(environment='staging', auth_mode='guest', database_url=POSTGRES, allowed_origins=HTTPS)

        settings.validate()

        self.assertTrue(settings.hosted)

    def test_staging_requires_postgres_and_https_origins(self):
        with self.assertRaisesRegex(ValueError, 'Staging requires PostgreSQL'):
            Settings(environment='staging', allowed_origins=HTTPS).validate()
        with self.assertRaisesRegex(ValueError, 'Staging requires explicit HTTPS'):
            Settings(environment='staging', database_url=POSTGRES).validate()

    def test_production_still_requires_firebase(self):
        with self.assertRaisesRegex(ValueError, 'Firebase'):
            Settings(environment='production', auth_mode='guest', database_url=POSTGRES, allowed_origins=HTTPS).validate()

    def test_only_development_migrates_automatically_by_default(self):
        for environment, expected in (('development', True), ('staging', False), ('production', False)):
            with patch.dict('os.environ', {'APP_ENV': environment}, clear=True):
                self.assertEqual(Settings.from_env().auto_migrate, expected, environment)


if __name__ == '__main__':
    unittest.main()
