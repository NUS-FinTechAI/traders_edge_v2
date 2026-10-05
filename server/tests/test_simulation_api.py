from concurrent.futures import ThreadPoolExecutor
import unittest
import tempfile
from fastapi.testclient import TestClient
from app.main import create_app
from app.config import Settings
from app.db import Database
from app.migrations import initial_schema
from sqlalchemy import text

from app.db import SimulationSession
import test_learning as learning_fixtures
from test_simulation import order


class SimulationAPITests(unittest.TestCase):
    tearDown = learning_fixtures.LearningTests.tearDown
    body = learning_fixtures.LearningTests.body
    complete_module = learning_fixtures.LearningTests.complete_module
    def setUp(self):
        learning_fixtures.LearningTests.setUp(self)

    def unlock(self, count=4):
        for index in range(count):
            self.complete_module(index)

    def start(self, key='create-guided-session', mode='guided'):
        return self.client.post('/api/simulations', json={'mode': mode, 'idempotency_key': key})

    def test_mastery_required_even_with_forged_client_mode(self):
        self.assertEqual(self.start().status_code, 403)
        self.unlock()
        self.assertEqual(self.start(mode='endless').status_code, 403)
        self.assertEqual(self.start().status_code, 201)
        self.assertEqual(self.start(mode='multiplayer').status_code, 422)

    def test_start_retry_persistence_and_private_future(self):
        self.unlock()
        first = self.start()
        self.assertEqual(first.status_code, 201, first.text)
        view = first.json()
        self.assertEqual(self.start().json(), view)
        self.assertEqual(len(self.client.get('/api/simulations').json()['sessions']), 1)
        self.assertEqual(self.start(mode='endless').status_code, 409)
        self.assertNotIn('seed', str(view))
        self.assertNotIn('scenario_kind', str(view))
        self.assertEqual([len(v) for v in view['history'].values()], [1] * 4)
        self.assertEqual(self.client.get('/api/simulations/' + view['id']).json()['cash'], '10000.00')
        self.client.cookies.clear()
        self.client.post('/api/session')
        self.assertEqual(self.client.get('/api/simulations/' + view['id']).status_code, 404)
        self.assertEqual(self.client.get('/api/simulations').json()['sessions'], [])

    def test_concurrent_advance_is_idempotent_and_other_action_conflicts(self):
        self.unlock()
        sid = self.start().json()['id']
        path = f'/api/simulations/{sid}/advance'
        body = {'steps': 5, 'idempotency_key': 'advance-retry-key'}
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: self.client.post(path, json=body), range(2)))
        self.assertEqual([r.status_code for r in results], [200, 200])
        self.assertEqual(results[0].json(), results[1].json())
        self.assertEqual(self.client.get('/api/simulations/' + sid).json()['tick'], 5)
        self.assertEqual(self.client.post(path, json={**body, 'steps': 1}).status_code, 409)
        request = {**order(quantity=1), 'idempotency_key': body['idempotency_key']}
        self.assertEqual(self.client.post(f'/api/simulations/{sid}/orders', json=request).status_code, 409)

    def test_plan_order_retry_cancel_and_reflection_do_not_award_trading_xp(self):
        self.unlock()
        xp = self.client.get('/api/me/profile').json()['xp']
        sid = self.start().json()['id']
        base = f'/api/simulations/{sid}'
        body = {**order(type='limit', price='1', quantity=1), 'idempotency_key': 'planned-order-key'}
        self.assertEqual(self.client.post(base + '/orders', json={**body, 'plan': {}}).status_code, 422)
        accepted = self.client.post(base + '/orders', json=body)
        self.assertEqual(accepted.status_code, 200, accepted.text)
        self.assertEqual(self.client.post(base + '/orders', json=body).json(), accepted.json())
        cancelled = self.client.post(base + '/orders/order-1/cancel', json={'idempotency_key': 'cancel-order-key'})
        self.assertEqual(cancelled.json()['orders'][0]['status'], 'cancelled')
        reflection = {'idempotency_key': 'finished-review-key', 'reflection': 'I chose to observe without executing a trade because I did not have enough information.'}
        self.assertEqual(self.client.post(base + '/debrief', json=reflection).status_code, 422)
        for n in range(2):
            self.client.post(base + '/advance', json={'steps': 5, 'idempotency_key': f'advance-steps-{n}'})
        finished = self.client.post(base + '/debrief', json=reflection)
        self.assertTrue(finished.json()['finished'])
        self.assertEqual(finished.json(), self.client.post(base + '/debrief', json=reflection).json())
        self.assertEqual(finished.json()['fills'], [])
        self.assertEqual(self.client.get('/api/me/profile').json()['xp'], xp)
        self.assertEqual(self.client.post(base + '/orders', json={**body, 'idempotency_key': 'another-order-key'}).status_code, 422)

    def test_extreme_amounts_return_validation_error_without_an_order(self):
        self.unlock()
        sid = self.start().json()['id']
        path = f'/api/simulations/{sid}/orders'
        payload = {**order(type='limit', price='1e1000', quantity=1), 'idempotency_key': 'extreme-price-key'}
        self.assertEqual(self.client.post(path, json=payload).status_code, 422)
        payload['price'] = '40'
        payload['plan']['max_loss'] = '1e1000'
        self.assertEqual(self.client.post(path, json=payload).status_code, 422)
        self.assertEqual(self.client.get('/api/simulations/' + sid).json()['orders'], [])

    def test_saved_orders_and_command_replay_survive_restart(self):
        self.unlock()
        sid = self.start().json()['id']
        path = f'/api/simulations/{sid}/orders'
        body = {**order(quantity=1), 'idempotency_key': 'restart-order-key'}
        before = self.client.post(path, json=body).json()
        token = self.client.cookies.get(self.settings.cookie_name)
        with TestClient(create_app(self.settings, self.content), headers={'Origin': 'http://localhost:5173'}) as restarted:
            restarted.cookies.set(self.settings.cookie_name, token)
            self.assertEqual(restarted.post(path, json=body).json(), before)
            self.assertEqual(len(restarted.get('/api/simulations/' + sid).json()['orders']), 1)

    def test_version_one_database_upgrades_without_losing_profiles(self):
        async def upgrade():
            with tempfile.TemporaryDirectory() as directory:
                db = Database(Settings(database_url=f'sqlite+aiosqlite:///{directory}/upgrade.db'))
                async with db.engine.begin() as connection:
                    await initial_schema(connection)
                    await connection.execute(text("INSERT INTO schema_versions (version, applied_at) VALUES (1, CURRENT_TIMESTAMP)"))
                    await connection.execute(text("INSERT INTO profiles (id, display_name, leaderboard_opt_in, analytics_opt_in, created_at) VALUES ('kept', 'Learner', 0, 0, CURRENT_TIMESTAMP)"))
                await db.migrate()
                await db.migrate()
                await db.check_schema()
                async with db.engine.connect() as connection:
                    self.assertEqual((await connection.execute(text("SELECT id FROM profiles"))).scalar(), 'kept')
                    self.assertEqual((await connection.execute(text("SELECT COUNT(*) FROM simulation_commands"))).scalar(), 0)
                await db.engine.dispose()
        self.client.portal.call(upgrade)

    def test_resume_cap_and_snapshot_version_fail_closed(self):
        self.unlock()
        first = self.start().json()
        self.assertEqual(self.start(key='second-session-key').status_code, 201)
        self.assertEqual(self.start(key='third-session-key').status_code, 201)
        self.assertEqual(self.start(key='fourth-session-key').status_code, 409)
        async def future_version():
            async with self.app.state.db.sessions.begin() as db:
                session = await db.get(SimulationSession, first['id'])
                session.version = 99
        self.client.portal.call(future_version)
        self.assertEqual(self.client.get('/api/simulations/' + first['id']).status_code, 409)


if __name__ == '__main__':
    unittest.main()
