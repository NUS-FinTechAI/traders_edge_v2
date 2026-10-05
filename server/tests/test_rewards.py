import asyncio
from concurrent.futures import ThreadPoolExecutor
from dataclasses import FrozenInstanceError, replace
from datetime import date, timedelta
import tempfile
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import event, func, inspect, select

from app.config import Settings
from app.db import Attempt, Database, LearningActivity, LearningRun, LearningRunCommand, MasteredModule, Profile, RewardCommand, RewardGrant, SchemaVersion, XPLedger, now
from app.main import create_app
from app.migrations import MIGRATIONS
from app.rewards import CORE_MODULE_IDS, FOUNDATIONS_MODULE_IDS, REWARD_POLICY
from test_learning import fixture_catalog


class RewardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.settings = Settings(database_url=f'sqlite+aiosqlite:///{self.temp.name}/rewards.db')
        self.content = fixture_catalog()
        self.app = create_app(self.settings, self.content)
        self.client = TestClient(self.app, headers={'Origin': 'http://localhost:5173'})
        self.client.__enter__()
        self.user_id = self.client.post('/api/session').json()['profile_id']

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.temp.cleanup()

    def inventory(self):
        response = self.client.get('/api/me/rewards')
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def item(self, item_id):
        return next(item for item in self.inventory()['items'] if item['id'] == item_id)

    def claim(self, item_id='badge-first-lesson', key='claim-key-0001'):
        return self.client.post('/api/me/rewards/claims', json={'idempotency_key': key, 'item_id': item_id})

    def equip(self, key='equip-key-0001', **slots):
        return self.client.patch('/api/me/rewards/equipment', json={'idempotency_key': key, **slots})

    def seed_events(self, events):
        async def seed():
            async with self.app.state.db.sessions.begin() as db:
                for key, amount in events:
                    db.add(XPLedger(user_id=self.user_id, event_key=key, amount=amount, reason='Recorded learning check'))
        self.client.portal.call(seed)

    def seed_mastery(self, modules):
        async def seed():
            async with self.app.state.db.sessions.begin() as db:
                for module in modules:
                    attempt_id = 'attempt-' + module[:27]
                    db.add(Attempt(id=attempt_id, user_id=self.user_id, kind='assessment', target_id=module, idempotency_key=module, request_hash='a' * 64, answers=[], reflection='Recorded learning check', score=100, passed=True, result={'legacy': True}))
                    await db.flush()
                    db.add(MasteredModule(user_id=self.user_id, module_id=module, attempt_id=attempt_id))
        self.client.portal.call(seed)

    def counts(self):
        async def read():
            async with self.app.state.db.sessions() as db:
                return tuple([await db.scalar(select(func.count()).select_from(model)) for model in (RewardGrant, RewardCommand, XPLedger, Attempt, LearningActivity, LearningRun)])
        return self.client.portal.call(read)

    def test_frozen_finite_policy_and_get_purity(self):
        self.assertEqual(len(REWARD_POLICY), 6)
        with self.assertRaises(FrozenInstanceError):
            REWARD_POLICY[0].name = 'Changed'
        before = self.counts()
        for _ in range(2):
            inventory = self.inventory()
            self.assertEqual(len(inventory['items']), 6)
            self.assertEqual({item['status'] for item in inventory['items']}, {'locked'})
            self.assertEqual(inventory['equipment'], {'avatar_id': None, 'title_id': None})
            self.assertTrue(all(item['criteria'] and item['visual_key'] for item in inventory['items']))
            self.assertNotIn('asset_url', str(inventory))
        self.assertEqual(before, self.counts())

    def test_locked_unknown_and_invalid_claims_leave_no_state(self):
        before = self.counts()
        self.assertEqual(self.claim().status_code, 403)
        self.assertEqual(self.claim('invented').status_code, 404)
        for payload in ({'idempotency_key': 'short', 'item_id': 'badge-first-lesson'}, {'idempotency_key': 'valid-key', 'item_id': 123}, {'idempotency_key': 'valid-key', 'item_id': 'badge-first-lesson', 'xp': 100}):
            self.assertEqual(self.client.post('/api/me/rewards/claims', json=payload).status_code, 422)
        self.assertEqual(before, self.counts())

    def test_only_positive_lesson_review_events_qualify(self):
        self.seed_events([('lesson:zero', 0), ('review:negative', -1), ('bonus:one', 20), ('diagnostic:one', 20), ('login:one', 20), ('mastery:one', 50)])
        self.assertEqual({item['status'] for item in self.inventory()['items']}, {'locked'})
        self.seed_events([('lesson:legacy-check', 20), ('review:legacy-check', 10)])
        for item_id in ('badge-first-lesson', 'avatar-compass', 'badge-first-review'):
            self.assertEqual(self.item(item_id)['status'], 'eligible')
            result = self.claim(item_id, 'claim-' + item_id)
            self.assertEqual(result.status_code, 200, result.text)
            evidence = result.json()['item']['evidence']
            self.assertEqual(len(evidence), 1)
            self.assertIn(evidence[0]['event_key'], ('lesson:legacy-check', 'review:legacy-check'))
            self.assertNotIn('interactive', str(evidence))
            self.assertNotIn('baseline', str(evidence))

    def test_claim_replay_conflicts_and_already_owned_do_not_reward(self):
        self.seed_events([('lesson:recorded', 20)])
        before = self.client.get('/api/me/profile').json()
        counts = self.counts()
        first = self.claim()
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(first.json(), self.claim().json())
        self.assertEqual(first.json(), self.claim(key='claim-key-0002').json())
        self.assertEqual(self.claim('avatar-compass').status_code, 409)
        self.assertEqual(self.equip(key='claim-key-0001', avatar_id=None).status_code, 409)
        self.assertEqual(self.client.get('/api/me/profile').json(), before)
        after = self.counts()
        self.assertEqual(after[:2], (1, 2))
        self.assertEqual(after[2:], counts[2:])
        self.assertEqual(self.item('badge-first-lesson'), first.json()['item'])
        self.assertTrue(first.json()['item']['created_at'].endswith('+00:00'))

    def test_mastery_uses_explicit_ids_and_pins_all_evidence(self):
        self.seed_mastery(['unrelated-' + str(i) for i in range(9)])
        self.assertEqual(self.claim('badge-foundations').status_code, 403)
        self.seed_mastery(FOUNDATIONS_MODULE_IDS[:-1])
        self.assertEqual(self.item('badge-foundations')['status'], 'locked')
        self.seed_mastery(FOUNDATIONS_MODULE_IDS[-1:])
        for item_id in ('badge-foundations', 'title-foundations-complete'):
            response = self.claim(item_id, 'claim-' + item_id)
            self.assertEqual(response.status_code, 200, response.text)
            evidence = response.json()['item']['evidence']
            self.assertEqual([entry['module_id'] for entry in evidence], list(FOUNDATIONS_MODULE_IDS))
            self.assertTrue(all(entry['attempt_id'].startswith('attempt-') for entry in evidence))
        self.assertEqual(self.item('badge-core')['status'], 'locked')
        self.seed_mastery(CORE_MODULE_IDS[4:])
        result = self.claim('badge-core', 'core-key-0001').json()['item']
        self.assertEqual([entry['module_id'] for entry in result['evidence']], list(CORE_MODULE_IDS))
        self.assertEqual(result['rule_version'], '1')

    def test_equipment_type_ownership_null_omission_and_atomicity(self):
        self.seed_events([('lesson:one', 20)])
        self.assertEqual(self.equip(avatar_id='avatar-compass').status_code, 403)
        self.claim('avatar-compass')
        self.claim('badge-first-lesson', 'claim-badge-0001')
        self.seed_mastery(FOUNDATIONS_MODULE_IDS)
        self.claim('title-foundations-complete', 'claim-title-0001')
        before = self.client.get('/api/me/profile').json()
        first = self.equip(avatar_id='avatar-compass', title_id='title-foundations-complete')
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(first.json(), self.equip(avatar_id='avatar-compass', title_id='title-foundations-complete').json())
        self.assertEqual(self.equip(avatar_id='avatar-compass').status_code, 409)
        self.assertEqual(self.equip(key='wrong-type-key', avatar_id='badge-first-lesson').status_code, 422)
        self.assertEqual(self.equip(key='wrong-slot-key', title_id='avatar-compass').status_code, 422)
        self.assertEqual(self.equip(key='atomic-key-001', avatar_id=None, title_id='missing-title').status_code, 403)
        self.assertEqual(self.inventory()['equipment'], first.json()['equipment'])
        response = self.equip(key='unequip-key-01', avatar_id=None).json()
        self.assertEqual(response['equipment'], {'avatar_id': None, 'title_id': 'title-foundations-complete'})
        self.assertEqual(self.equip(key='unequip-key-01', title_id=None).status_code, 409)
        self.assertEqual(self.equip(key='unequip-key-02', title_id=None).json()['equipment'], {'avatar_id': None, 'title_id': None})
        self.assertEqual(self.client.get('/api/me/profile').json(), before)
        self.assertEqual(self.equip(key='bad-value-key', avatar_id=42).status_code, 422)

    def test_retirement_and_publication_do_not_break_replay_or_owned_equipment(self):
        self.seed_events([('lesson:one', 20)])
        claim = self.claim('avatar-compass').json()
        equipped = self.equip(avatar_id='avatar-compass').json()
        self.app.state.settings = replace(self.settings, environment='production')
        with patch('app.rewards.REWARD_POLICY', ()):
            self.assertEqual(self.claim('avatar-compass').json(), claim)
            self.assertEqual(self.equip(avatar_id='avatar-compass').json(), equipped)
            self.assertEqual(self.claim('avatar-compass', 'owned-new-key').json(), claim)
            self.assertEqual(self.equip(key='retired-equip-key', avatar_id='avatar-compass').status_code, 200)
            self.assertEqual(self.inventory()['items'], [claim['item']])
            self.assertEqual(self.claim('badge-first-lesson', 'retired-unknown').status_code, 404)
            self.assertEqual(self.claim('badge-first-lesson').status_code, 409)
        self.assertEqual(self.claim('badge-first-lesson', 'unpublished-key').status_code, 503)
        self.assertEqual(self.item('avatar-compass'), claim['item'])

    def test_owned_metadata_and_rule_version_remain_pinned(self):
        self.seed_events([('lesson:one', 20)])
        original = self.claim().json()['item']
        with patch('app.rewards.REWARD_POLICY', tuple(replace(item, name='Changed name', rule_version='2') for item in REWARD_POLICY)):
            self.assertEqual(self.item('badge-first-lesson'), original)
            self.assertEqual(self.claim().json()['item'], original)
            self.assertEqual(self.claim(key='owned-new-key').json()['item'], original)

    def test_restart_and_user_scoping(self):
        self.seed_events([('lesson:one', 20)])
        self.seed_days([now().date()])
        claimed = self.claim('avatar-compass').json()
        equipped = self.equip(avatar_id='avatar-compass').json()
        token = self.client.cookies.get(self.settings.cookie_name)
        with TestClient(create_app(self.settings, self.content), headers={'Origin': 'http://localhost:5173'}) as restarted:
            restarted.cookies.set(self.settings.cookie_name, token)
            self.assertEqual(restarted.post('/api/me/rewards/claims', json={'idempotency_key': 'claim-key-0001', 'item_id': 'avatar-compass'}).json(), claimed)
            self.assertEqual(restarted.get('/api/me/rewards').json()['equipment'], equipped['equipment'])
            restarted.cookies.clear()
            restarted.post('/api/session')
            self.assertEqual({item['status'] for item in restarted.get('/api/me/rewards').json()['items']}, {'locked'})
            self.assertEqual(restarted.post('/api/me/rewards/claims', json={'idempotency_key': 'claim-key-0001', 'item_id': 'avatar-compass'}).status_code, 403)
            self.assertEqual(restarted.patch('/api/me/rewards/equipment', json={'idempotency_key': 'equip-key-0001', 'avatar_id': 'avatar-compass'}).status_code, 403)
            self.assertEqual(restarted.get('/api/me/activity').json()['current_streak_days'], 0)
            self.assertEqual(restarted.get('/api/me/activity').json()['longest_streak_days'], 0)
            self.assertEqual(restarted.patch('/api/me/rewards/equipment', json={'idempotency_key': 'equip-key-0001', 'avatar_id': None}).status_code, 200)

    def test_concurrent_same_and_different_keys_create_one_grant(self):
        self.seed_events([('lesson:one', 20)])
        with ThreadPoolExecutor(max_workers=2) as pool:
            same = list(pool.map(lambda _: self.claim(), range(2)))
        self.assertEqual([result.status_code for result in same], [200, 200])
        self.assertEqual(same[0].json(), same[1].json())
        with ThreadPoolExecutor(max_workers=2) as pool:
            different = list(pool.map(lambda key: self.claim('avatar-compass', key), ('parallel-key-1', 'parallel-key-2')))
        self.assertEqual([result.status_code for result in different], [200, 200])
        self.assertEqual(different[0].json(), different[1].json())
        self.assertEqual(self.counts()[:2], (2, 3))
        with ThreadPoolExecutor(max_workers=2) as pool:
            equipped = list(pool.map(lambda _: self.equip(avatar_id='avatar-compass'), range(2)))
        self.assertEqual([result.status_code for result in equipped], [200, 200])
        self.assertEqual(equipped[0].json(), equipped[1].json())
        self.assertEqual(self.counts()[:2], (2, 4))

    def test_mutations_and_command_responses_roll_back_together(self):
        from app.rewards import remember
        self.seed_events([('lesson:one', 20)])
        before = self.counts()
        async def fail_after_flush(*args):
            await remember(*args)
            raise HTTPException(503, 'Injected failure after flush')
        with patch('app.rewards.remember', fail_after_flush):
            self.assertEqual(self.claim('avatar-compass').status_code, 503)
        self.assertEqual(self.counts(), before)
        self.assertEqual(self.claim('avatar-compass').status_code, 200)
        claimed = self.counts()
        with patch('app.rewards.remember', fail_after_flush):
            self.assertEqual(self.equip(avatar_id='avatar-compass').status_code, 503)
        self.assertEqual(self.counts(), claimed)
        self.assertIsNone(self.inventory()['equipment']['avatar_id'])
        self.assertEqual(self.equip(avatar_id='avatar-compass').status_code, 200)

    def test_equipment_replay_returns_original_without_reapplying_state(self):
        self.seed_events([('lesson:one', 20)])
        self.claim('avatar-compass')
        original = self.equip(avatar_id='avatar-compass').json()
        self.equip(key='unequip-new-key', avatar_id=None)
        with patch('app.rewards.REWARD_POLICY', ()), patch('app.rewards.learning_evidence', side_effect=AssertionError('Replay must not reevaluate evidence')):
            self.assertEqual(self.equip(avatar_id='avatar-compass').json(), original)
        self.assertIsNone(self.inventory()['equipment']['avatar_id'])

    def test_reward_commands_have_an_independent_namespace(self):
        lesson = self.content['modules'][0]['lessons'][0]
        body = {'idempotency_key': 'shared-key-0001', 'answers': [{'question_id': q['id'], 'option_id': 'protect'} for q in lesson['questions']], 'reflection': 'Keep essential spending available.'}
        learning = self.client.post('/api/lessons/m1-l1/complete', json=body)
        self.assertEqual(learning.status_code, 200, learning.text)
        claimed = self.claim(key='shared-key-0001')
        self.assertEqual(claimed.status_code, 200, claimed.text)
        self.assertEqual(self.client.post('/api/lessons/m1-l1/complete', json=body).json(), learning.json())
        self.assertEqual(self.claim(key='shared-key-0001').json(), claimed.json())

    def test_publication_gate_applies_to_fresh_claims(self):
        self.seed_events([('lesson:one', 20)])
        self.app.state.settings = replace(self.settings, environment='production')
        before = self.counts()
        self.assertEqual(self.claim().status_code, 503)
        self.assertEqual(self.counts(), before)
        self.content['review_status'] = 'approved'
        for module in self.content['modules']:
            module['review_status'] = 'approved'
            for lesson in module['lessons']:
                lesson['review_status'] = 'approved'
        self.assertEqual(self.claim().status_code, 200)

    def test_authentication_is_required(self):
        self.client.cookies.clear()
        self.assertEqual(self.client.get('/api/me/rewards').status_code, 401)
        self.assertEqual(self.client.get('/api/me/activity').status_code, 401)
        self.assertEqual(self.claim().status_code, 401)
        self.assertEqual(self.equip(avatar_id=None).status_code, 401)

    def test_inventory_reads_are_batched_owner_scoped(self):
        self.seed_mastery(CORE_MODULE_IDS)
        self.seed_events([('lesson:one', 20), ('review:one', 10)])
        statements = []
        def record(connection, cursor, statement, parameters, context, many):
            statements.append((statement, parameters))
        event.listen(self.app.state.db.engine.sync_engine, 'before_cursor_execute', record)
        try:
            self.inventory()
        finally:
            event.remove(self.app.state.db.engine.sync_engine, 'before_cursor_execute', record)
        for table in ('reward_grants', 'xp_ledger', 'mastered_modules'):
            reads = [(sql, params) for sql, params in statements if 'FROM ' + table in sql]
            self.assertEqual(len(reads), 1, statements)
            self.assertIn(self.user_id, reads[0][1])
        self.assertFalse(any(sql.lstrip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')) for sql, _ in statements))

    def seed_days(self, days):
        async def seed():
            async with self.app.state.db.sessions.begin() as db:
                db.add_all([LearningActivity(user_id=self.user_id, day=day.isoformat()) for day in days])
        self.client.portal.call(seed)

    def test_activity_all_history_streak_and_bounded_calendar(self):
        today = now().date()
        old = date(today.year - 2, 12, 29)
        self.seed_days([old + timedelta(days=i) for i in range(6)] + [today - timedelta(days=i) for i in (1, 2, 4)])
        response = self.client.get('/api/me/activity', params={'start_date': today.isoformat(), 'end_date': today.isoformat()})
        self.assertEqual(response.status_code, 200, response.text)
        value = response.json()
        self.assertEqual(value['basis'], 'days with rewarded learning events')
        self.assertEqual(value['timezone'], 'UTC')
        self.assertEqual(value['current_streak_days'], 2)
        self.assertEqual(value['longest_streak_days'], 6)
        self.assertEqual(value['days'], [{'date': today.isoformat(), 'active': False}])
        self.seed_days([today])
        self.assertEqual(self.client.get('/api/me/activity').json()['current_streak_days'], 3)
        year = self.client.get('/api/me/activity', params={'start_date': old.isoformat(), 'end_date': (old + timedelta(days=365)).isoformat()}).json()
        self.assertEqual(len(year['days']), 366)
        self.assertEqual(sum(day['active'] for day in year['days']), 6)

    def test_activity_empty_gaps_and_window_bounds(self):
        initial = self.client.get('/api/me/activity').json()
        self.assertEqual(initial['current_streak_days'], 0)
        self.assertEqual(initial['longest_streak_days'], 0)
        today = now().date()
        self.seed_days([today - timedelta(days=3), today - timedelta(days=4), today - timedelta(days=6)])
        value = self.client.get('/api/me/activity').json()
        self.assertEqual(value['current_streak_days'], 0)
        self.assertEqual(value['longest_streak_days'], 2)
        for start, end in (('2024-01-01', '2025-01-01'), ('2024-02-02', '2024-02-01'), ('not-a-date', '2024-01-01')):
            self.assertEqual(self.client.get('/api/me/activity', params={'start_date': start, 'end_date': end}).status_code, 422)
        self.assertEqual(len(self.client.get('/api/me/activity', params={'start_date': '2024-01-01', 'end_date': '2024-12-31'}).json()['days']), 366)

    def test_activity_only_changes_with_existing_rewarded_learning(self):
        self.seed_events([('bonus:one', 0), ('diagnostic:one', 0)])
        self.assertEqual(self.client.get('/api/me/activity').json()['longest_streak_days'], 0)
        lesson = self.content['modules'][0]['lessons'][0]
        body = {'idempotency_key': 'lesson-key-001', 'answers': [{'question_id': q['id'], 'option_id': 'risk'} for q in lesson['questions']], 'reflection': 'Keep essential spending available.'}
        self.assertFalse(self.client.post('/api/lessons/m1-l1/complete', json=body).json()['passed'])
        self.assertEqual(self.client.get('/api/me/activity').json()['longest_streak_days'], 0)
        body['idempotency_key'] = 'lesson-key-002'
        for answer in body['answers']:
            answer['option_id'] = 'protect'
        self.assertTrue(self.client.post('/api/lessons/m1-l1/complete', json=body).json()['passed'])
        before = self.client.get('/api/me/activity').json()
        self.assertEqual(before['current_streak_days'], 1)
        self.claim('avatar-compass')
        self.equip(avatar_id='avatar-compass')
        self.assertEqual(self.client.get('/api/me/activity').json(), before)


class RewardMigrationTests(unittest.TestCase):
    def test_populated_v3_upgrade_and_repeatable_schema_preserve_evidence(self):
        async def exercise(directory):
            from app.migration_v1 import profiles
            from app.migration_v4 import upgrade
            from app.db import AggregateEvent, JournalEntry, LessonCompletion, MasteredModule, ReviewItem, SessionToken, SimulationSession
            from app.simulation import engine
            from app.simulation.api import SimulationCommand
            from sqlalchemy import MetaData, Table
            database = Database(Settings(database_url=f'sqlite+aiosqlite:///{directory}/upgrade.db'))
            with patch('app.migrations.MIGRATIONS', MIGRATIONS[:3]):
                await database.migrate()
            async with database.sessions.begin() as db:
                await db.execute(profiles.insert().values(id='legacy', display_name='Learner', leaderboard_opt_in=False, analytics_opt_in=False, created_at=now()))
                db.add(Attempt(id='legacy-attempt', user_id='legacy', kind='lesson', target_id='m01-l01', idempotency_key='legacy-key', request_hash='a' * 64, answers=[{'recorded': True}], reflection='Recorded evidence', score=100, passed=True, result={'xp_awarded': 20}))
                db.add(LearningRun(id='legacy-run', user_id='legacy', purpose='practice', module_id='module', level_id='level', content_version='v1', status='completed', snapshot_json={'pinned': 'private'}, state_json={'result': {'attempt_id': 'legacy-attempt'}}))
                await db.flush()
                db.add(LearningRunCommand(user_id='legacy', key='run-key', run_id='legacy-run', request_hash='b' * 64, response={'original': True}))
                db.add(XPLedger(user_id='legacy', event_key='lesson:m01-l01', amount=20, reason='Recorded reward'))
                saved_market = engine.new_session(17, 'sideways', 30)
                db.add(SimulationSession(id='legacy-simulation', user_id='legacy', mode='guided', scenario_kind='sideways', version=engine.VERSION, snapshot_json=saved_market))
                db.add_all([
                    SessionToken(token_hash='c' * 64, user_id='legacy', expires_at=now() + timedelta(days=1)),
                    LessonCompletion(user_id='legacy', lesson_id='m01-l01', attempt_id='legacy-attempt'),
                    MasteredModule(user_id='legacy', module_id='module', attempt_id='legacy-attempt'),
                    ReviewItem(id='legacy-review', user_id='legacy', lesson_id='m01-l01', due_at=now()),
                    LearningActivity(user_id='legacy', day='2026-10-01'),
                    JournalEntry(id='legacy-journal', user_id='legacy', lesson_id='m01-l01', text='Keep the recorded reasoning.'),
                    AggregateEvent(day='2026-10-01', kind='lesson_completed', count=1),
                ])
                await db.flush()
                saved_response = {'id': 'legacy-simulation', 'mode': 'guided', **engine.public_view(saved_market)}
                db.add(SimulationCommand(user_id='legacy', key='simulation-key', session_id='legacy-simulation', request_hash='d' * 64, response=saved_response))
            def original_rows(connection, columns=None):
                tables = {name: Table(name, MetaData(), autoload_with=connection) for name in inspect(connection).get_table_names() if name != 'schema_versions'}
                columns = columns or {name: list(table.columns.keys()) for name, table in tables.items()}
                rows = {name: [dict(row) for row in connection.execute(select(*(tables[name].c[column] for column in names)).order_by(*tables[name].primary_key.columns)).mappings()] for name, names in columns.items()}
                return columns, rows
            async with database.engine.connect() as connection:
                old_columns, old_rows = await connection.run_sync(original_rows)
            self.assertEqual(len(old_rows), 14)
            self.assertTrue(all(len(rows) == 1 for rows in old_rows.values()))
            with self.assertRaises(RuntimeError):
                await database.check_schema()
            async with database.engine.connect() as connection:
                before = await connection.run_sync(lambda c: set(inspect(c).get_table_names()))
            await database.migrate()
            statements = []
            def record(connection, cursor, statement, parameters, context, many):
                statements.append(statement)
            event.listen(database.engine.sync_engine, 'before_cursor_execute', record)
            try:
                await database.migrate()
                async with database.engine.begin() as connection:
                    await upgrade(connection)
                    await upgrade(connection)
                    after, columns, grant_pk, command_pk = await connection.run_sync(lambda c: (set(inspect(c).get_table_names()), inspect(c).get_columns('profiles'), inspect(c).get_pk_constraint('reward_grants'), inspect(c).get_pk_constraint('reward_commands')))
                    for model in (RewardGrant, RewardCommand):
                        actual = await connection.run_sync(lambda c: inspect(c).get_columns(model.__tablename__))
                        self.assertEqual({column['name'] for column in actual}, set(model.__table__.columns.keys()))
                        self.assertTrue(all(not column['nullable'] for column in actual))
                        foreign_keys = await connection.run_sync(lambda c: inspect(c).get_foreign_keys(model.__tablename__))
                        self.assertEqual([(key['constrained_columns'], key['referred_table']) for key in foreign_keys], [(['user_id'], 'profiles')])
            finally:
                event.remove(database.engine.sync_engine, 'before_cursor_execute', record)
            self.assertFalse(any(statement.lstrip().upper().startswith(('INSERT', 'UPDATE', 'DELETE', 'ALTER', 'CREATE', 'DROP')) for statement in statements))
            self.assertEqual(after - before, {'reward_grants', 'reward_commands'})
            self.assertEqual({column['name'] for column in columns if column['name'].startswith('equipped_')}, {'equipped_avatar_id', 'equipped_title_id'})
            self.assertTrue(all(column['nullable'] for column in columns if column['name'].startswith('equipped_')))
            self.assertEqual(grant_pk['constrained_columns'], ['user_id', 'item_id'])
            self.assertEqual(command_pk['constrained_columns'], ['user_id', 'key'])
            await database.check_schema()
            async with database.engine.connect() as connection:
                _, upgraded_rows = await connection.run_sync(lambda sync: original_rows(sync, old_columns))
            self.assertEqual(upgraded_rows, old_rows)
            async with database.sessions() as db:
                self.assertEqual(list(await db.scalars(select(SchemaVersion.version).order_by(SchemaVersion.version))), [1, 2, 3, 4])
                self.assertEqual((await db.get(Attempt, 'legacy-attempt')).answers, [{'recorded': True}])
                self.assertEqual((await db.get(Attempt, 'legacy-attempt')).result, {'xp_awarded': 20})
                self.assertEqual((await db.get(LearningRun, 'legacy-run')).snapshot_json, {'pinned': 'private'})
                self.assertEqual((await db.get(LearningRun, 'legacy-run')).state_json, {'result': {'attempt_id': 'legacy-attempt'}})
                self.assertEqual((await db.get(LearningRunCommand, ('legacy', 'run-key'))).response, {'original': True})
                self.assertEqual((await db.get(XPLedger, ('legacy', 'lesson:m01-l01'))).amount, 20)
                profile = await db.get(Profile, 'legacy')
                self.assertIsNone(profile.equipped_avatar_id)
                self.assertIsNone(profile.equipped_title_id)
                self.assertEqual(await db.scalar(select(func.count()).select_from(RewardGrant)), 0)
                self.assertEqual(await db.scalar(select(func.count()).select_from(RewardCommand)), 0)
            await database.engine.dispose()
        with tempfile.TemporaryDirectory() as directory:
            asyncio.run(exercise(directory))
