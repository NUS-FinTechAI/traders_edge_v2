from copy import deepcopy
from dataclasses import replace
import os
from unittest.mock import patch
import unittest
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db import LearningRun, LearningRunCommand, LessonCompletion, MasteredModule, SimulationSession, XPLedger
from app.config import Settings
from app.gameplay import ChapterAccess
from app.main import create_app
from app.simulation import engine
import test_interactive as fixtures
from test_simulation import order as generic_order


def order(**changes):
    request = generic_order(**changes)
    if 'plan' not in changes:
        request['plan']['max_loss'] = '50.00'
    return request


class ScenarioSetTests(unittest.TestCase):
    postgres = False
    key = fixtures.InteractiveTests.key
    start = fixtures.InteractiveTests.start
    answer = fixtures.InteractiveTests.answer
    submit = fixtures.InteractiveTests.submit
    finish = fixtures.InteractiveTests.finish
    baseline = fixtures.InteractiveTests.baseline

    def setUp(self):
        self.schema = None
        if self.postgres:
            import psycopg
            from psycopg import sql
            from test_postgres_integration import checked_url
            self.base_url = checked_url(os.environ['TRADERS_EDGE_TEST_POSTGRES_URL'])
            self.schema = 'traders_edge_qa_scenario_set_' + uuid.uuid4().hex
            with psycopg.connect(self.base_url.set(drivername='postgresql').render_as_string(hide_password=False), autocommit=True) as connection:
                connection.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(self.schema)))
            url = self.base_url.update_query_dict({'options': f'-csearch_path={self.schema}'}).render_as_string(hide_password=False)
            with patch('test_interactive.Settings', return_value=Settings(database_url=url)):
                fixtures.InteractiveTests.setUp(self)
        else:
            fixtures.InteractiveTests.setUp(self)
        baseline = self.baseline()
        self.user_id = baseline['result']['profile']['id']
        self.module = self.content['modules'][8]
        self.mid = self.module['id']
        async def prepare():
            async with self.app.state.db.sessions.begin() as db:
                for module in self.content['modules'][:8]:
                    db.add(MasteredModule(user_id=self.user_id, module_id=module['id'], attempt_id=baseline['result']['attempt_id']))
                for lesson in self.module['lessons'][:2]:
                    db.add(LessonCompletion(user_id=self.user_id, lesson_id=lesson['id'], attempt_id=baseline['result']['attempt_id']))
        self.client.portal.call(prepare)
        self.baseline()
        self.lesson = self.module['lessons'][2]
        self.run = self.start('levels/m09-l03/runs')
        self.path = self.run['scenario_set']['url']

    def tearDown(self):
        try:
            fixtures.InteractiveTests.tearDown(self)
        finally:
            if self.schema:
                import psycopg
                from psycopg import sql
                with psycopg.connect(self.base_url.set(drivername='postgresql').render_as_string(hide_password=False), autocommit=True) as connection:
                    connection.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(self.schema)))

    def ready(self):
        for task in self.lesson['tasks'][:-1]:
            self.run = self.submit(self.run, task)

    def bind(self, key=None):
        identifier = self.view['current_case_id'] if hasattr(self, 'view') else 'path-1'
        body = {'idempotency_key': key or self.key(), 'case_id': identifier}
        result = self.client.post(self.path, json=body)
        self.assertEqual(result.status_code, 200, result.text)
        self.view = result.json()
        self.base = '/api/simulations/' + self.view['session']['id']
        return self.view

    def advance(self, steps):
        response = self.client.post(self.base + '/advance', json={'steps': steps, 'idempotency_key': self.key()})
        self.assertEqual(response.status_code, 200, response.text)
        self.view['session'] = response.json()
        return response.json()

    def final(self):
        while self.view['session']['tick'] < 19:
            self.advance(min(5, 19 - self.view['session']['tick']))

    def audit(self, **changes):
        view = self.client.get(self.path).json()['session']
        return {'case_id': view['scenario_set_policy']['case_id'], 'tick': view['tick'],
                'engine_version': view['version'], 'observation_token': view['observation_token'],
                'orders': [{'order_id': row['id'], 'status': row['status'], 'requested_quantity': row['quantity'],
                            'filled_quantity': row['filled'], 'remaining_quantity': row['remaining']} for row in view['orders']],
                'positions': [{'symbol': row['symbol'], 'quantity': row['quantity']} for row in view['positions']],
                'cash': view['cash'], 'session_fees': view['fees'], 'benchmark_value': view['benchmark_value'],
                'benchmark_is_gross': True, 'profit_proves_process': False, 'planned_loss_is_guaranteed': False,
                'no_order_reason': None if view['orders'] else 'no_thesis_supplied', **changes}

    def review(self, **changes):
        body = {'idempotency_key': self.key(), 'audit': self.audit(**changes)}
        response = self.client.post(self.path + '/review', json=body)
        self.assertEqual(response.status_code, 200, response.text)
        self.view = response.json()
        return self.view

    def saved(self):
        async def read():
            async with self.app.state.db.sessions() as db:
                run = await db.get(LearningRun, self.run['id'])
                sessions = list((await db.scalars(select(SimulationSession).where(SimulationSession.user_id == self.user_id).order_by(SimulationSession.id))).all())
                commands = list((await db.scalars(select(LearningRunCommand).where(LearningRunCommand.run_id == run.id))).all())
                rewards = list((await db.scalars(select(XPLedger).where(XPLedger.user_id == self.user_id, XPLedger.event_key == 'lesson:m09-l03'))).all())
                return {'run': deepcopy(run.state_json), 'snapshot': deepcopy(run.snapshot_json), 'status': run.status,
                        'sessions': [deepcopy(session.snapshot_json) for session in sessions],
                        'commands': len(commands), 'rewards': len(rewards)}
        return self.client.portal.call(read)

    def change_market(self, mutate):
        sid = self.view['session']['id']
        async def change():
            async with self.app.state.db.sessions.begin() as db:
                session = await db.get(SimulationSession, sid)
                state = deepcopy(session.snapshot_json)
                mutate(state)
                session.snapshot_json = state
        self.client.portal.call(change)

    def test_four_real_paths_allow_no_order_reviews_and_award_only_once_at_the_end(self):
        self.ready()
        profiles = []
        for index in range(4):
            view = self.bind()
            self.assertEqual(view['current_case_id'], f'path-{index + 1}')
            self.assertEqual(view['session']['total_ticks'], 20)
            self.assertEqual([len(series) for series in view['session']['history'].values()], [1] * 4)
            self.final()
            done = self.review()
            profiles.append(done['completed_cases'][-1]['generator_profile'])
            self.assertEqual(done['run']['status'], 'completed' if index == 3 else 'active')
            self.assertEqual(self.saved()['rewards'], int(index == 3))
            self.assertIsNone(done['session'])
        self.assertEqual(set(profiles), set(engine.KINDS))
        self.assertEqual(done['run']['result']['xp_awarded'], 20)
        self.assertTrue(done['run']['result']['standard_star'])
        self.assertFalse(done['run']['result']['bonus_star'])
        self.assertEqual(done['run']['result']['profile']['game_xp'], 0)
        self.assertEqual(len(self.client.get('/api/simulations').json()['sessions']), 4)
        self.assertTrue(all(row['learning_run_id'] == self.run['id'] for row in self.client.get('/api/simulations').json()['sessions']))

    def test_bind_withholds_private_profile_schedule_seed_and_future_path(self):
        before = self.client.post(self.path, json={'idempotency_key': self.key(), 'case_id': 'path-1'})
        self.assertEqual(before.status_code, 409)
        self.ready()
        view = self.bind()
        text = str(view)
        for hidden in ('generator_profile', 'scenario_forms', 'seed', "'kind'", "'prices'", "'liquidity'"):
            self.assertNotIn(hidden, text)
        self.assertEqual(view['policy']['max_order_quantity'], 5)
        self.assertEqual(view['policy']['max_asset_units'], 10)
        self.assertEqual(view['policy']['max_planned_loss'], '100.00')
        self.assertEqual(view['session']['orders'], [])
        self.assertEqual(self.bind()['session']['id'], view['session']['id'])

    def test_boss_access_cannot_replace_first_eight_structured_mastery_checks(self):
        self.ready()
        attempt = self.client.post('/api/challenges', json={'mode': 'chapter_entry', 'module_id': self.mid, 'idempotency_key': self.key()})
        self.assertEqual(attempt.status_code, 201, attempt.text)
        async def revoke():
            async with self.app.state.db.sessions.begin() as db:
                await db.delete(await db.get(MasteredModule, (self.user_id, self.content['modules'][0]['id'])))
                db.add(ChapterAccess(user_id=self.user_id, module_id=self.mid, attempt_id=attempt.json()['id']))
        self.client.portal.call(revoke)
        before = self.saved()

        denied = self.client.post(self.path, json={'idempotency_key': self.key(), 'case_id': 'path-1'})

        self.assertEqual(denied.status_code, 403)
        self.assertEqual(len(denied.json()['detail']['prerequisite_module_ids']), 8)
        self.assertEqual(self.saved(), before)

    def test_ordinary_orders_enforce_written_plan_declared_loss_size_and_pending_units(self):
        self.ready()
        self.bind()
        for changed in ({'plan': {}}, {'quantity': 6}, {'plan': {**order()['plan'], 'max_loss': '101'}},
                        {'plan': {**order()['plan'], 'max_loss': 'invalid'}}):
            before = self.saved()
            invalid = self.client.post(self.base + '/orders/submit', json={'idempotency_key': self.key(), 'order': order(**changed)})
            self.assertEqual(invalid.status_code, 422, invalid.text)
            self.assertEqual(self.saved(), before)
        for _ in range(2):
            accepted = self.client.post(self.base + '/orders/submit', json={'idempotency_key': self.key(), 'order': order(quantity=5, type='limit', price='1.00')})
            self.assertEqual(accepted.status_code, 200, accepted.text)
        capped = self.client.post(self.base + '/orders/submit', json={'idempotency_key': self.key(), 'order': order(quantity=1)})
        self.assertEqual(capped.status_code, 422, capped.text)
        self.assertEqual(self.client.post(self.base + '/debrief', json={'idempotency_key': self.key(), 'reflection': 'A raw reflection must not complete this integrated lesson.'}).status_code, 409)

    def test_eight_cancelled_orders_reach_the_case_cap_and_still_allow_observation_and_audit(self):
        self.ready()
        self.bind()
        self.assertEqual(self.view['policy']['max_orders'], 8)
        for number in range(1, 9):
            placed = self.client.post(self.base + '/orders/submit', json={'idempotency_key': self.key(), 'order': order(quantity=1, type='limit', price='1.00')})
            self.assertEqual(placed.status_code, 200, placed.text)
            cancelled = self.client.post(self.base + f'/orders/order-{number}/cancel', json={'idempotency_key': self.key()})
            self.assertEqual(cancelled.status_code, 200, cancelled.text)
        before = self.saved()

        denied = self.client.post(self.base + '/orders/submit', json={'idempotency_key': self.key(), 'order': order(quantity=1)})

        self.assertEqual(denied.status_code, 422, denied.text)
        self.assertEqual(self.saved(), before)
        self.final()
        reviewed = self.review()
        self.assertEqual(reviewed['issues'], [])
        self.assertEqual(len(reviewed['completed_cases'][0]['audit']['orders']), 8)

    def test_accurate_audit_of_real_fills_and_expired_remainders_passes_without_a_profit_grade(self):
        self.ready()
        self.bind()
        for requested in (order(quantity=3), order(quantity=2, type='limit', price='1.00')):
            placed = self.client.post(self.base + '/orders/submit', json={'idempotency_key': self.key(), 'order': requested})
            self.assertEqual(placed.status_code, 200, placed.text)
        self.final()
        self.assertTrue(self.view['session']['fills'])
        self.assertEqual(self.view['session']['orders'][1]['status'], 'expired')

        done = self.review()

        self.assertEqual(done['issues'], [])
        self.assertEqual(len(done['completed_cases']), 1)
        self.assertEqual(self.saved()['rewards'], 0)

    def test_forged_reconciliation_preserves_first_answer_and_permits_specific_correction(self):
        self.ready()
        self.bind()
        self.final()
        wrong = self.review(cash='9999.00', no_order_reason=None, benchmark_is_gross=False)
        self.assertEqual({issue['code'] for issue in wrong['issues']}, {'cash', 'no_order_reason', 'benchmark_basis'})
        self.assertEqual(wrong['completed_cases'], [])
        first = self.saved()['run']['scenario_first_responses']['path-1']

        corrected = self.review()

        self.assertEqual(len(corrected['completed_cases']), 1)
        self.assertEqual(self.saved()['run']['scenario_first_responses']['path-1'], first)
        self.assertFalse(first['correct'])

    def test_stale_and_same_tick_changed_observations_reject_before_any_audit_evidence(self):
        self.ready()
        self.bind()
        stale = self.audit()
        placed = self.client.post(self.base + '/orders/submit', json={'idempotency_key': self.key(), 'order': order(quantity=1, type='limit', price='1.00')})
        self.assertEqual(placed.status_code, 200, placed.text)
        before = self.saved()
        for audit in (stale, {**self.audit(), 'case_id': 'path-2'}):
            response = self.client.post(self.path + '/review', json={'idempotency_key': self.key(), 'audit': audit})
            self.assertEqual(response.status_code, 409, response.text)
            self.assertEqual(self.saved(), before)

    def test_a_profitable_recorded_size_breach_cannot_pass_an_otherwise_accurate_audit(self):
        self.ready()
        self.bind()
        def unsafe_import(state):
            engine.submit_order(state, order(quantity=6))
            state['prices']['NORTH'][-1] = '80.00'
            for steps in (5, 5, 5, 4):
                engine.advance(state, steps)
        self.change_market(unsafe_import)
        observed = self.client.get(self.path).json()['session']
        self.assertGreater(engine.amount(observed['equity']), 10000)

        refused = self.review()

        self.assertIn('order_policy', {issue['code'] for issue in refused['issues']})
        self.assertEqual(refused['completed_cases'], [])
        self.assertEqual(self.saved()['rewards'], 0)

    def test_exact_bind_and_review_replay_survive_retired_engine_and_publication(self):
        self.ready()
        key = self.key()
        first = deepcopy(self.bind(key))
        self.final()
        body = {'idempotency_key': self.key(), 'audit': self.audit()}
        reviewed = self.client.post(self.path + '/review', json=body)
        self.assertEqual(reviewed.status_code, 200, reviewed.text)
        with patch('app.simulation.engine.VERSION', 999), patch('app.simulation.scenario_sets.runs.pinned_publication', side_effect=AssertionError('Fresh gate reached')):
            self.assertEqual(self.client.post(self.path, json={'idempotency_key': key, 'case_id': 'path-1'}).json(), first)
            self.assertEqual(self.client.post(self.path + '/review', json=body).json(), reviewed.json())

    def test_restart_resumes_the_same_market_and_owned_reads_reject_another_guest(self):
        self.ready()
        view = self.bind()
        self.advance(5)
        expected = self.client.get(self.path).json()
        with TestClient(create_app(self.settings, self.content), headers={'Origin': 'http://localhost:5173'}) as restarted:
            restarted.cookies.update(self.client.cookies)
            self.assertEqual(restarted.get(self.path).json(), expected)
            self.assertEqual(restarted.get(self.base).json()['history'], expected['session']['history'])
        with TestClient(create_app(self.settings, self.content), headers={'Origin': 'http://localhost:5173'}) as another:
            another.post('/api/session')
            self.assertEqual(another.get(self.path).status_code, 403)
            self.assertEqual(another.get('/api/simulations/' + view['session']['id']).status_code, 404)

    def test_lost_reciprocal_link_rejects_plain_reads_and_cannot_create_another_case(self):
        self.ready()
        self.bind()
        async def corrupt():
            async with self.app.state.db.sessions.begin() as db:
                run = await db.get(LearningRun, self.run['id'])
                state = deepcopy(run.state_json)
                state['scenario_sessions'] = {}
                run.state_json = state
        self.client.portal.call(corrupt)
        before = self.saved()

        self.assertEqual(self.client.get(self.base).status_code, 409)
        self.assertEqual(self.client.post(self.path, json={'idempotency_key': self.key(), 'case_id': 'path-1'}).status_code, 409)

        self.assertEqual(self.saved(), before)

    def test_session_cap_denies_binding_without_an_orphan_or_learning_receipt(self):
        self.ready()
        for _ in range(3):
            created = self.client.post('/api/simulations', json={'idempotency_key': self.key()})
            self.assertEqual(created.status_code, 201, created.text)
        before = self.saved()

        denied = self.client.post(self.path, json={'idempotency_key': self.key(), 'case_id': 'path-1'})

        self.assertEqual(denied.status_code, 409)
        self.assertEqual(self.saved(), before)

    def test_finish_failure_rolls_back_case_review_learning_reward_and_receipt(self):
        self.ready()
        for _ in range(3):
            self.bind()
            self.final()
            self.review()
        self.bind()
        self.final()
        before = self.saved()
        with patch('app.simulation.scenario_sets.runs.finish_run', side_effect=RuntimeError('Injected finish failure')):
            with self.assertRaisesRegex(RuntimeError, 'Injected finish'):
                self.review()
        self.assertEqual(self.saved(), before)

    def test_unapproved_case_blocks_fresh_reads_and_orders_but_preserves_committed_bind_replay(self):
        self.ready()
        key = self.key()
        first = deepcopy(self.bind(key))
        self.app.state.settings = replace(self.settings, environment='production')
        before = self.saved()

        self.assertEqual(self.client.get(self.path).status_code, 503)
        self.assertEqual(self.client.get(self.base).status_code, 503)
        self.assertEqual(self.client.post(self.base + '/advance', json={'idempotency_key': self.key(), 'steps': 1}).status_code, 503)
        self.assertEqual(self.client.post(self.path, json={'idempotency_key': key, 'case_id': 'path-1'}).json(), first)

        self.assertEqual(self.saved(), before)

    def test_stripped_case_policy_still_rejects_plain_route_mutations_through_reverse_link(self):
        self.ready()
        self.bind()
        self.change_market(lambda state: state.pop('scenario_set_policy'))
        before = self.saved()

        self.assertEqual(self.client.get(self.base).status_code, 409)
        self.assertEqual(self.client.post(self.base + '/advance', json={'idempotency_key': self.key(), 'steps': 1}).status_code, 409)

        self.assertEqual(self.saved(), before)

    def test_closed_path_rejects_fresh_commands_while_next_path_keeps_its_own_snapshot(self):
        self.ready()
        self.bind()
        prior_base = self.base
        self.final()
        self.review()
        next_path = self.bind()
        before = self.saved()

        self.assertEqual(self.client.post(prior_base + '/advance', json={'idempotency_key': self.key(), 'steps': 1}).status_code, 409)

        self.assertEqual(self.saved(), before)
        self.assertEqual(self.client.get(self.path).json()['session']['id'], next_path['session']['id'])

    def test_two_workers_share_one_case_and_replay_one_final_lesson_award(self):
        from concurrent.futures import ThreadPoolExecutor
        self.ready()
        for _ in range(3):
            self.bind()
            self.final()
            self.review()
        with TestClient(create_app(replace(self.settings, auto_migrate=False), self.content), headers={'Origin': 'http://localhost:5173'}) as worker:
            worker.cookies.update(self.client.cookies)
            bodies = [{'idempotency_key': self.key(), 'case_id': 'path-4'} for _ in range(2)]
            with ThreadPoolExecutor(max_workers=2) as pool:
                bound = list(pool.map(lambda pair: pair[0].post(self.path, json=pair[1]), zip((self.client, worker), bodies)))
            self.assertEqual([result.status_code for result in bound], [200, 200])
            self.assertEqual(bound[0].json()['session']['id'], bound[1].json()['session']['id'])
            self.view = bound[0].json()
            self.base = '/api/simulations/' + self.view['session']['id']
            self.final()
            body = {'idempotency_key': self.key(), 'audit': self.audit()}
            with ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(lambda client: client.post(self.path + '/review', json=body), (self.client, worker)))
            self.assertEqual([result.status_code for result in results], [200, 200])
            self.assertEqual(results[0].json(), results[1].json())
            self.assertEqual(results[0].json()['run']['result']['xp_awarded'], 20)
            self.assertEqual(len(self.saved()['sessions']), 4)
            self.assertEqual(self.saved()['rewards'], 1)

    def test_uncommitted_bind_retry_cannot_start_the_next_case_after_another_tab_reviews(self):
        self.ready()
        pending = {'idempotency_key': self.key(), 'case_id': 'path-1'}
        with TestClient(create_app(replace(self.settings, auto_migrate=False), self.content), headers={'Origin': 'http://localhost:5173'}) as other_tab:
            other_tab.cookies.update(self.client.cookies)
            self.bind()
            self.final()
            self.review()
            before = self.saved()

            stale = other_tab.post(self.path, json=pending)

        self.assertEqual(stale.status_code, 409, stale.text)
        self.assertEqual(self.saved(), before)
        self.assertEqual(list(before['run']['scenario_sessions']), ['path-1'])

    def test_evidence_exports_preserve_each_case_first_audit_and_observed_reconciliation(self):
        self.ready()
        self.bind()
        self.final()
        self.review(cash='9999.00')
        self.review()
        for _ in range(3):
            self.bind()
            self.final()
            self.review()

        run_response = self.client.get('/api/me/research/export/learning-runs')
        attempt_response = self.client.get('/api/me/research/export/learning-attempts')

        self.assertEqual(run_response.status_code, 200, run_response.text)
        run = next(row for row in run_response.json()['records'] if row['id'] == self.run['id'])
        case_rows = [row for row in run['responses'] if 'case_id' in row]
        self.assertEqual([row['case_id'] for row in case_rows], ['path-1', 'path-1', 'path-2', 'path-3', 'path-4'])
        self.assertEqual([row['case_response_number'] for row in case_rows], [1, 2, 1, 1, 1])
        self.assertEqual([row['case_first_response'] for row in case_rows], [True, False, True, True, True])
        self.assertEqual([row['answer']['audit']['cash'] for row in case_rows[:2]], ['9999.00', '10000.00'])
        self.assertEqual(run['scenario_first_responses']['path-1']['answer']['audit']['cash'], '9999.00')
        self.assertEqual(run['scenario_first_responses']['path-2']['answer']['audit']['cash'], '10000.00')
        self.assertTrue(all(row['progress'] for row in run['command_timestamps']))
        self.assertEqual(attempt_response.status_code, 200, attempt_response.text)
        attempt = next(row for row in attempt_response.json()['records'] if row['run_id'] == self.run['id'])
        audits = [row for row in attempt['answers'] if 'case_id' in row]
        self.assertEqual([row['case_response_number'] for row in audits], [1, 2, 1, 1, 1])
        self.assertEqual(audits[2]['answer']['audit']['positions'], [])
        self.assertTrue(audits[2]['answer']['audit']['benchmark_is_gross'])
        for response in (run_response, attempt_response):
            for hidden in ('"seed"', 'scenario_forms', 'scenario_set_binding', '"prices"', '"liquidity"', '"generator_profile"'):
                self.assertNotIn(hidden, response.text)


@unittest.skipUnless(os.getenv('TRADERS_EDGE_TEST_POSTGRES_URL'), 'Disposable PostgreSQL test URL not configured')
class ScenarioSetPostgreSQLTests(ScenarioSetTests):
    postgres = True


if __name__ == '__main__':
    unittest.main()
