from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
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
from app.db import Attempt, LearningRun, LearningRunCommand, now
from app.main import create_app
from app.migration_v10 import upgrade
from app.research_models import ResearchCommand, ResearchParticipant
from app.challenges import core
from app.challenges.models import ChallengeAttempt
from app.simulation import engine
from test_learning import fixture_catalog
from test_postgres_integration import checked_url
from test_simulation import order


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
        self.content = fixture_catalog()
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

    def test_real_paid_daily_retry_export_preserves_its_receipt_and_observations(self):
        from app.economy_models import EconomyAccount
        first = self.client.post('/api/challenges', json={'mode': 'daily', 'idempotency_key': 'research-daily-first'})
        self.assertEqual(first.status_code, 201, first.text)
        identifier = first.json()['id']
        abandoned = self.client.post('/api/challenges/' + identifier + '/abandon', json={'idempotency_key': 'research-daily-abandon'})
        self.assertEqual(abandoned.status_code, 200, abandoned.text)
        async def fund_fixture():
            async with self.app.state.db.sessions.begin() as db:
                (await db.get(EconomyAccount, self.user_id)).premium_balance = 10
        self.client.portal.call(fund_fixture)
        paid = self.client.post('/api/me/economy/daily-refresh', json={'idempotency_key': 'research-paid-refresh'})
        self.assertEqual(paid.status_code, 200, paid.text)
        retry = self.client.post('/api/challenges', json={'mode': 'daily', 'idempotency_key': 'research-daily-retry'})
        self.assertEqual(retry.status_code, 201, retry.text)
        second = retry.json()['id']
        advanced = self.client.post('/api/challenges/' + second + '/advance', json={'steps': 1, 'idempotency_key': 'research-daily-observe'})
        self.assertEqual(advanced.status_code, 200, advanced.text)
        exported = self.export('ai-challenges')
        self.assertEqual(exported.status_code, 200, exported.text)
        records = {record['id']: record for record in exported.json()['records']}
        self.assertFalse(records[identifier]['retry_context']['premium_retry'])
        self.assertTrue(records[second]['retry_context']['premium_retry'])
        self.assertEqual(records[second]['retry_context']['refresh_event_key'], 'refresh:research-paid-refresh')
        self.assertEqual(records[second]['attempt_number'], 2)
        self.assertEqual(records[second]['events'][0]['before']['tick'], 0)
        self.assertEqual(records[second]['events'][0]['after']['tick'], 1)
        self.assertNotIn('"seed"', exported.text)
        self.assertEqual(self.client.get('/api/me/economy').json()['premium_balance'], 0)

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

    def test_learning_run_export_preserves_first_retry_audit_and_observed_tasks_only(self):
        stamp = now()
        tasks = [{'id': f'step-{index}', 'type': 'choice', 'prompt': 'Observed' if index < 2 else 'UNSEEN_FUTURE_PROMPT',
            'options': [{'id': 'a', 'text': 'Observed option', 'nested': {'correct': 'PRIVATE_KEY'}}, {'id': 'b', 'text': 'Other option'}],
            'correct_option_id': 'PRIVATE_KEY', 'explanation': 'PRIVATE_FEEDBACK'} for index in range(3)]
        responses = [{'step_id': 'step-0', 'answer': {'option_id': 'b', 'confidence': 20}, 'correct': False},
                     {'step_id': 'step-0', 'answer': {'option_id': 'a', 'confidence': 70}, 'correct': True}]
        audit = {'tick': 10, 'engine_version': 1, 'session_fees': '1.00', 'price_limit_guarantees_fill': False,
            'no_order_reason': None, 'orders': [{'order_id': 'order-1', 'filled_quantity': 1, 'status': 'filled', 'limit_price': '40.00'}]}
        async def insert():
            async with self.app.state.db.sessions.begin() as db:
                db.add(LearningRun(id='owned-run', user_id=self.user_id, purpose='practice', module_id='m1', level_id='m1-l1',
                    content_version='edition', status='active', snapshot_json={'tasks': tasks, 'seed': 'PRIVATE_SEED'},
                    state_json={'position': 1, 'responses': responses, 'first_responses': {'step-0': responses[0]}, 'result': {'score_percent': 100}}))
                db.add(LearningRun(id='audit-run', user_id=self.user_id, purpose='practice', module_id='m5', level_id='m5-l1',
                    content_version='edition', status='completed', snapshot_json={'tasks': []},
                    state_json={'position': 0, 'responses': [{'step_id': 'audit', 'answer': {'audit': audit}, 'correct': True}], 'first_responses': {},
                        'result': {'score_percent': 100, 'profile': {'private': 'PRIVATE_PROFILE'}, 'feedback': 'PRIVATE_FEEDBACK'}}))
                await db.flush()
                db.add(LearningRunCommand(user_id=self.user_id, key='owned-run-receipt', run_id='owned-run', request_hash='a' * 64,
                    response={'progress': {'completed_steps': 1, 'total_steps': 3}, 'private': 'PRIVATE_RECEIPT'}, created_at=stamp))
        self.client.portal.call(insert)
        response = self.export('learning-runs')
        self.assertEqual(response.status_code, 200, response.text)
        records = {row['id']: row for row in response.json()['records']}
        run = records['owned-run']
        self.assertEqual([task['id'] for task in run['observed_tasks']], ['step-0', 'step-1'])
        self.assertEqual(run['first_responses']['step-0']['answer']['option_id'], 'b')
        self.assertEqual([entry['first_response'] for entry in run['responses']], [True, False])
        self.assertIsNone(run['result'])
        self.assertEqual(run['command_timestamps'][0]['progress']['completed_steps'], 1)
        self.assertEqual(records['audit-run']['responses'][0]['answer']['audit'], audit)
        for hidden in ('PRIVATE_', 'UNSEEN_FUTURE_PROMPT', 'correct_option_id', '"correct"'):
            self.assertNotIn(hidden, response.text)

    def test_real_diagnostic_submission_exports_first_answer_without_unseen_form(self):
        from app.content.catalog import load_catalog
        content = load_catalog()
        self.app.state.catalog = content
        module = content['modules'][0]
        started = self.client.post(f"/api/modules/{module['id']}/diagnostic-runs", json={'idempotency_key': 'real-diagnostic-start'})
        self.assertEqual(started.status_code, 200, started.text)
        task = module['entry_tasks'][0]
        wrong = next(option['id'] for option in task['options'] if option['id'] != task['correct_option_id'])
        submitted = self.client.post(f"/api/learning-runs/{started.json()['id']}/steps/{task['id']}/submit", json={
            'idempotency_key': 'real-diagnostic-response', 'answer': {'option_id': wrong, 'confidence': 90}})
        self.assertEqual(submitted.status_code, 200, submitted.text)
        exported = self.export('learning-runs').json()['records'][0]
        self.assertEqual(exported['first_responses'][task['id']]['answer']['option_id'], wrong)
        self.assertEqual(exported['responses'][0]['answer']['confidence'], 90)
        self.assertEqual([observed['id'] for observed in exported['observed_tasks']], [task['id'], module['entry_tasks'][1]['id']])
        self.assertIsNone(exported['result'])
        self.assertEqual(len(exported['command_timestamps']), 2)
        self.assertNotIn(module['entry_tasks'][2]['id'], str(exported))

    def test_challenge_export_actual_observations_plans_paid_retries_and_final_result(self):
        snapshot = core.new_snapshot(7, 'rising', 2)
        before = engine.public_view(snapshot['human'])
        payload = order(quantity=1)
        engine.submit_order(snapshot['human'], payload)
        core.record_event(snapshot, 'order', payload, before)
        snapshot['events'][0]['attempt_number'] = 2
        before_advance = engine.public_view(snapshot['human'])
        core.advance(snapshot, 1)
        core.record_event(snapshot, 'advance', {'steps': 1}, before_advance)
        snapshot['events'][1]['attempt_number'] = 2
        snapshot['research'] = {'premium_retry': True, 'daily_date': '2026-10-06', 'refresh_event_key': 'daily-refresh:receipt', 'secret': 'PRIVATE_RECEIPT'}
        snapshot['events'][0]['before']['seed'] = 'PRIVATE_SEED'
        snapshot['events'][0]['before']['history']['NORTH'] += ['UNSEEN_FUTURE_PRICE'] * 29
        snapshot['policy']['answer'] = 'PRIVATE_KEY'
        completed = deepcopy(snapshot)
        for _ in range(6):
            core.advance(completed, 5)
        result = core.complete(completed, 'I reviewed the entire common market and my planned actions.')
        async def insert():
            async with self.app.state.db.sessions.begin() as db:
                for identifier, state, status, outcome in [('active-ai', snapshot, 'active', result), ('finished-ai', completed, 'completed', result)]:
                    db.add(ChallengeAttempt(id=identifier, user_id=self.user_id, challenge_id='daily:2026-10-06', attempt_number=2,
                        mode='daily', module_id=None, version=core.VERSION, status=status, snapshot_json=state, result_json=outcome))
        self.client.portal.call(insert)
        response = self.export('ai-challenges')
        self.assertEqual(response.status_code, 200, response.text)
        records = {row['id']: row for row in response.json()['records']}
        active = records['active-ai']
        self.assertFalse(active['first_attempt'])
        self.assertIsNone(active['result'])
        self.assertEqual(active['retry_context'], {key: snapshot['research'][key] for key in ('premium_retry', 'daily_date', 'refresh_event_key')})
        self.assertEqual(active['events'][0]['payload']['plan'], payload['plan'])
        self.assertEqual(active['events'][0]['after']['orders'][0]['plan'], {**payload['plan'], 'max_loss': '1000.00'})
        self.assertEqual(len(active['events'][0]['before']['history']['NORTH']), 1)
        position = active['events'][1]['after']['positions'][0]
        self.assertEqual(position['unrealized_profit'], engine.money(engine.amount(position['value']) - engine.amount(position['cost'])))
        self.assertIn('weight_percent', position)
        self.assertIn('realized', position)
        self.assertEqual(len(records['finished-ai']['result']['leaderboard']), 3)
        for hidden in ('PRIVATE_', 'UNSEEN_FUTURE_PRICE', '"seed"', '"prices"', '"strategy"', '"agents"'):
            self.assertNotIn(hidden, response.text)

    def test_owned_export_keyset_pagination_limits_and_foreign_cursor(self):
        stamp = now()
        async def insert(user_id, identifiers):
            async with self.app.state.db.sessions.begin() as db:
                for identifier in identifiers:
                    db.add(Attempt(id=identifier, user_id=user_id, kind='lesson', target_id='m1-l1', idempotency_key=identifier,
                        request_hash='a' * 64, answers=[{'question_id': 'q1', 'option_id': 'a', 'confidence': 60, 'correct': 'PRIVATE_KEY'}],
                        reflection='My recorded rationale.', score=100, passed=True, result={'passed': True, 'private': 'PRIVATE_KEY'}, created_at=stamp))
        self.client.portal.call(insert, self.user_id, ['attempt-c', 'attempt-a', 'attempt-b'])
        first = self.export('learning-attempts', limit=2)
        self.assertEqual([row['id'] for row in first.json()['records']], ['attempt-a', 'attempt-b'])
        self.assertEqual(first.json()['next_cursor'], 'attempt-b')
        second = self.export('learning-attempts', limit=2, cursor='attempt-b')
        self.assertEqual([row['id'] for row in second.json()['records']], ['attempt-c'])
        self.assertIsNone(second.json()['next_cursor'])
        self.assertNotIn('PRIVATE_KEY', first.text)
        self.assertEqual(first.headers['cache-control'], 'no-store')
        self.assertIn('attachment;', first.headers['content-disposition'])
        for limit in (0, 101):
            self.assertEqual(self.export('learning-attempts', limit=limit).status_code, 422)
        self.assertEqual(self.export('unsupported-kind').status_code, 422)
        self.client.cookies.clear()
        foreign = self.client.post('/api/session').json()['profile_id']
        self.client.portal.call(insert, foreign, ['foreign-attempt'])
        self.assertEqual(self.export('learning-attempts', cursor='attempt-a').status_code, 404)
        self.assertEqual([row['id'] for row in self.export('learning-attempts').json()['records']], ['foreign-attempt'])
        self.client.cookies.clear()
        self.assertEqual(self.export('learning-attempts').status_code, 401)

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
