from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
import os
import hashlib
import tempfile
import unittest
import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.config import Settings
from app.db import now
from app.game.models import Game, GameEvent, GameParticipant
from app.main import create_app
from app.migration_v10 import upgrade
from app.research_models import ResearchCommand, ResearchParticipant
from progression_fixtures import fixture_content
from test_postgres_integration import checked_url


class ResearchTests(unittest.TestCase):
    postgres = False

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.schema = None
        database_url = f'sqlite+aiosqlite:///{self.temp.name}/research.db'
        if self.postgres:
            import psycopg
            from psycopg import sql
            self.base_url = checked_url(os.environ['TRADERS_EDGE_TEST_POSTGRES_URL'])
            self.schema = 'traders_edge_qa_' + uuid.uuid4().hex
            with psycopg.connect(self.base_url.set(drivername='postgresql').render_as_string(hide_password=False), autocommit=True) as connection:
                connection.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(self.schema)))
            database_url = self.base_url.update_query_dict({'options': f'-csearch_path={self.schema}'}).render_as_string(hide_password=False)
        self.settings = Settings(database_url=database_url)
        self.content = fixture_content()
        self.app = self.application(self.settings)
        self.client = TestClient(self.app, headers={'Origin': 'http://localhost:5173'})
        self.client.__enter__()
        self.user_id = self.client.post('/api/session').json()['profile_id']

    def application(self, settings):
        return create_app(settings, self.content)

    def tearDown(self):
        self.client.__exit__(None, None, None)
        if self.schema:
            import psycopg
            from psycopg import sql
            with psycopg.connect(self.base_url.set(drivername='postgresql').render_as_string(hide_password=False), autocommit=True) as connection:
                connection.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(self.schema)))
        self.temp.cleanup()

    def post(self, path, key, **payload):
        if path == 'consents' and payload.get('accepted') is True:
            policy = self.client.get('/api/me/research').json()['study_policy']
            payload.setdefault('policy_digest', policy['policy_digest'] or '0' * 64)
        return self.client.post('/api/me/research/' + path, json={'idempotency_key': key, **payload})

    def export(self, kind, **params):
        return self.client.get('/api/me/research/export/' + kind, params=params)

    def enable(self, version='study-1', content='A separately approved study consent text.'):
        self.app.state.settings = replace(self.settings, research_enabled=True, research_policy_version=version, research_policy_text=content)

    def test_study_environment_defaults_and_enabled_policy_validation(self):
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings.from_env()
            self.assertFalse(settings.research_enabled)
            self.assertIsNone(settings.research_policy_version)
            settings.validate()
        with patch.dict(os.environ, {'RESEARCH_ENABLED': 'true', 'RESEARCH_POLICY_VERSION': 'study-1',
                                     'RESEARCH_POLICY_TEXT': 'Participant policy text.'}, clear=True):
            settings = Settings.from_env()
            settings.validate()
            self.assertTrue(settings.research_enabled)
            self.assertEqual(settings.research_policy_text, 'Participant policy text.')
        for changes in ({'research_policy_version': None}, {'research_policy_version': ' '},
                        {'research_policy_version': ' study-1 '},
                        {'research_policy_version': 'a' * 81}, {'research_policy_text': None}, {'research_policy_text': ' '}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                replace(settings, **changes).validate()

    def test_disabled_policy_explicit_acceptance_and_no_implicit_enrollment(self):
        initial = self.client.get('/api/me/research').json()
        self.assertFalse(initial['study_policy']['available'])
        self.assertFalse(initial['participation_active'])
        self.assertEqual(self.post('consents', 'disabled-consent', accepted=True, policy_version='study-1').status_code, 409)
        for invalid in (False, 'true', 1):
            self.assertEqual(self.post('consents', 'invalid-consent', accepted=invalid, policy_version='study-1').status_code, 422)
        self.assertEqual(self.post('metadata', 'metadata-not-consent', prior_knowledge='some').status_code, 200)
        self.assertFalse(self.client.get('/api/me/research').json()['consented'])
        self.enable()
        self.assertEqual(self.post('consents', 'old-policy-consent', accepted=True, policy_version='old').status_code, 409)
        self.app.state.settings = replace(self.settings, research_enabled=True, research_policy_version='study-1', research_policy_text='  ')
        self.assertEqual(self.post('consents', 'blank-policy-consent', accepted=True, policy_version='study-1').status_code, 409)

    def test_metadata_first_report_frozen_and_commands_owned_exactly(self):
        first = self.post('metadata', 'metadata-first-key', prior_knowledge='none')
        self.assertEqual(first.status_code, 200, first.text)
        changed = self.post('metadata', 'metadata-change-key', prior_knowledge='experienced').json()
        self.assertEqual(changed['first_prior_knowledge'], 'none')
        self.assertEqual(changed['prior_knowledge'], 'experienced')
        self.assertEqual(changed['prior_knowledge_basis'], 'self_reported_unvalidated')
        self.assertEqual(self.post('metadata', 'metadata-first-key', prior_knowledge='none').json(), first.json())
        self.assertEqual(self.post('metadata', 'metadata-first-key', prior_knowledge='some').status_code, 409)
        self.assertEqual(self.post('withdrawals', 'metadata-first-key').status_code, 409)
        self.assertEqual(self.post('metadata', 'invented-knowledge', prior_knowledge='expert').status_code, 422)
        self.client.cookies.clear()
        self.client.post('/api/session')
        self.assertIsNone(self.client.get('/api/me/research').json()['first_prior_knowledge'])
        foreign = self.post('metadata', 'metadata-first-key', prior_knowledge='some').json()
        self.assertEqual(foreign['first_prior_knowledge'], 'some')

    def test_consent_pinning_withdrawal_replay_and_new_version(self):
        self.enable()
        consent = self.post('consents', 'consent-first-key', accepted=True, policy_version='study-1')
        self.assertEqual(consent.status_code, 200, consent.text)
        self.assertIsNone(consent.json()['first_prior_knowledge'])
        reported = self.post('metadata', 'post-consent-knowledge', prior_knowledge='some').json()
        self.assertEqual(reported['first_prior_knowledge'], 'some')
        self.enable(content='Changed text under the same version.')
        self.assertFalse(self.client.get('/api/me/research').json()['participation_active'])
        self.assertEqual(self.post('consents', 'changed-text-consent', accepted=True, policy_version='study-1').status_code, 409)
        self.enable()
        withdrawn = self.post('withdrawals', 'withdraw-first-key').json()
        self.assertFalse(withdrawn['consented'])
        self.assertIsNotNone(withdrawn['withdrawn_at'])
        self.assertEqual(self.post('consents', 'consent-first-key', accepted=True, policy_version='study-1').json(), consent.json())
        self.assertFalse(self.client.get('/api/me/research').json()['consented'])
        self.app.state.settings = self.settings
        self.assertEqual(self.post('withdrawals', 'withdraw-first-key').json(), withdrawn)
        self.enable(version='study-2', content='New approved policy revision.')
        renewed = self.post('consents', 'consent-second-key', accepted=True, policy_version='study-2').json()
        self.assertTrue(renewed['participation_active'])
        self.assertEqual(renewed['consent_text'], 'New approved policy revision.')
        self.assertEqual(renewed['withdrawn_at'], withdrawn['withdrawn_at'])

    def test_stale_policy_digest_rejects_first_consent_before_creating_evidence(self):
        self.enable(content='Consent text A with exact Unicode: café.\n')
        policy_a = self.client.get('/api/me/research').json()['study_policy']
        self.assertEqual(policy_a['policy_digest'], hashlib.sha256(policy_a['text'].encode('utf-8')).hexdigest())
        body = {'idempotency_key': 'stale-first-consent', 'accepted': True,
            'policy_version': policy_a['version'], 'policy_digest': policy_a['policy_digest']}
        self.enable(content='Consent text B under the same version.')
        rejected = self.client.post('/api/me/research/consents', json=body)
        self.assertEqual(rejected.status_code, 409, rejected.text)
        async def evidence():
            async with self.app.state.db.sessions() as db:
                return await db.get(ResearchParticipant, self.user_id), await db.get(ResearchCommand, (self.user_id, body['idempotency_key']))
        self.assertEqual(self.client.portal.call(evidence), (None, None))
        policy_b = self.client.get('/api/me/research').json()['study_policy']
        self.assertNotEqual(policy_b['policy_digest'], policy_a['policy_digest'])
        fresh_body = {**body, 'policy_digest': policy_b['policy_digest']}
        accepted = self.client.post('/api/me/research/consents', json=fresh_body)
        self.assertEqual(accepted.status_code, 200, accepted.text)
        self.assertEqual(accepted.json()['consent_text'], policy_b['text'])
        self.assertTrue(accepted.json()['participation_active'])
        self.post('withdrawals', 'digest-withdrawal')
        self.app.state.settings = self.settings
        self.assertEqual(self.client.post('/api/me/research/consents', json=fresh_body).json(), accepted.json())
        self.assertFalse(self.client.get('/api/me/research').json()['consented'])

    def test_policy_digest_requires_strict_lowercase_sha256_text(self):
        self.enable()
        body = {'idempotency_key': 'digest-validation-key', 'accepted': True, 'policy_version': 'study-1'}
        self.assertEqual(self.client.post('/api/me/research/consents', json=body).status_code, 422)
        for invalid in ('A' * 64, 'f' * 63, 'f' * 65, 'z' * 64, None, 1):
            self.assertEqual(self.client.post('/api/me/research/consents', json={**body, 'policy_digest': invalid}).status_code, 422)
        self.assertEqual(self.client.post('/api/me/research/consents', json={**body, 'policy_digest': '0' * 64}).status_code, 409)

    def test_concurrent_replay_restart_and_failed_receipt_roll_back(self):
        body = {'idempotency_key': 'concurrent-metadata', 'prior_knowledge': 'none'}
        token = self.client.cookies.get(self.settings.cookie_name)
        with TestClient(self.application(replace(self.settings, auto_migrate=False)), headers={'Origin': 'http://localhost:5173'}) as restarted:
            restarted.cookies.set(self.settings.cookie_name, token)
            with ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(lambda client: client.post('/api/me/research/metadata', json=body), (self.client, restarted)))
            self.assertEqual([value.status_code for value in results], [200, 200])
            self.assertEqual(results[0].json(), results[1].json())
            self.assertEqual(restarted.post('/api/me/research/metadata', json=body).json(), results[0].json())
        from unittest.mock import patch
        original = ResearchCommand.__init__
        def fail(instance, **values):
            original(instance, **values)
            raise RuntimeError('Receipt unavailable')
        with patch.object(ResearchCommand, '__init__', fail):
            with self.assertRaises(RuntimeError):
                self.post('metadata', 'failed-metadata-key', prior_knowledge='experienced')
        self.assertEqual(self.client.get('/api/me/research').json()['prior_knowledge'], 'none')
        async def receipt():
            async with self.app.state.db.sessions() as db:
                return await db.get(ResearchCommand, (self.user_id, 'failed-metadata-key'))
        self.assertIsNone(self.client.portal.call(receipt))

    def insert_game(self, user_id, game_id, events):
        async def insert():
            async with self.app.state.db.sessions.begin() as db:
                db.add(Game(id=game_id, mode='daily', scenario_id='practice-trend-rider', scenario_version=1, seed=12345, status='settled',
                            clock={}, context={'day': '2026-10-19', 'seed': 12345}, host_user_id=user_id))
                await db.flush()
                db.add(GameParticipant(id=game_id + '-me', game_id=game_id, user_id=user_id, display_name='Me', forfeited=False))
                db.add(GameParticipant(id=game_id + '-bot', game_id=game_id, bot_id='hodl-hannah', display_name='Bot', forfeited=False))
                await db.flush()
                stamp = now()
                for identifier, kind in events:
                    db.add(GameEvent(id=identifier, game_id=game_id, participant_id=game_id + '-me', tick=1, kind=kind, created_at=stamp,
                                     payload={'context': {'day': '2026-10-19', 'seed': 12345}, 'observed': {'cash': 10000}}))
                db.add(GameEvent(id=game_id + '-bot-event', game_id=game_id, participant_id=game_id + '-bot', tick=1, kind='order',
                                 payload={'secret': 'BOT_STRATEGY'}, created_at=stamp))
        self.client.portal.call(insert)

    def switch_user(self):
        self.client.cookies.clear()
        self.user_id = self.client.post('/api/session').json()['profile_id']

    def test_game_event_export_pages_owned_events_without_seeds_or_bot_records(self):
        self.insert_game(self.user_id, 'game-one', [('event-c', 'finish'), ('event-a', 'start'), ('event-b', 'order')])

        first = self.export('game-events', limit=2)
        second = self.export('game-events', limit=2, cursor=first.json()['next_cursor'])

        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual([row['id'] for row in first.json()['records']], ['event-a', 'event-b'])
        self.assertEqual([row['id'] for row in second.json()['records']], ['event-c'])
        self.assertIsNone(second.json()['next_cursor'])
        self.assertEqual(first.json()['records'][0]['payload'], {'context': {'day': '2026-10-19'}, 'observed': {'cash': 10000}})
        self.assertNotIn('12345', first.text + second.text)
        self.assertNotIn('BOT_STRATEGY', first.text + second.text)
        self.assertEqual(first.headers['cache-control'], 'no-store')
        self.assertIn('attachment;', first.headers['content-disposition'])

    def test_export_rejects_bad_limits_kinds_and_foreign_cursors(self):
        self.insert_game(self.user_id, 'game-one', [('event-a', 'start')])
        for limit in (0, 101):
            self.assertEqual(self.export('game-events', limit=limit).status_code, 422)
        self.assertEqual(self.export('learning-runs').status_code, 422)
        self.switch_user()
        self.assertEqual(self.export('game-events', cursor='event-a').status_code, 404)
        self.assertEqual(self.export('game-events').json()['records'], [])
        self.client.cookies.clear()
        self.assertEqual(self.export('game-events').status_code, 401)

    def test_campaign_and_quiz_exports_hold_only_the_players_records(self):
        attempt = self.client.post('/api/quizzes/attempts', json={'topic_id': 'chapter-1'}).json()
        question = attempt['questions'][0]
        self.client.post(f'/api/quizzes/attempts/{attempt["id"]}/answers',
                         json={'question_id': question['id'], 'option_id': question['options'][0]['id'], 'confidence': 'sure'})

        quizzes = self.export('quiz-attempts').json()['records']
        campaign = self.export('campaign-progress').json()

        self.assertEqual([row['id'] for row in quizzes], [attempt['id']])
        self.assertEqual(list(quizzes[0]['answers']), [question['id']])
        self.assertEqual(quizzes[0]['answers'][question['id']]['confidence'], 'sure')
        self.assertEqual(campaign['records'], [])
        self.switch_user()
        self.assertEqual(self.export('quiz-attempts').json()['records'], [])

    def test_migration_is_repeatable_and_preserves_populated_records(self):
        self.post('metadata', 'retained-metadata', prior_knowledge='experienced')
        async def migrate():
            async with self.app.state.db.engine.begin() as connection:
                tables = ('profiles', 'research_participants', 'research_commands')
                before = {table: (await connection.execute(text(f'SELECT * FROM {table} ORDER BY 1'))).all() for table in tables}
                await upgrade(connection)
                await upgrade(connection)
                after = {table: (await connection.execute(text(f'SELECT * FROM {table} ORDER BY 1'))).all() for table in tables}
                self.assertEqual(before, after)
        self.client.portal.call(migrate)


@unittest.skipUnless(os.getenv('TRADERS_EDGE_TEST_POSTGRES_URL'), 'Disposable PostgreSQL test URL not configured')
class ResearchPostgreSQLTests(ResearchTests):
    postgres = True


if __name__ == '__main__':
    unittest.main()
