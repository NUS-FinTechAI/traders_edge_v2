from copy import deepcopy
import unittest

from sqlalchemy import select

from app.challenges.api import response
from app.challenges.models import ChallengeAttempt, ChallengeCommand
from app.export_openapi import export_schema
import test_learning as fixtures
from test_simulation import order


class ChallengeSchemaTests(unittest.TestCase):
    def test_every_challenge_operation_declares_its_success_response(self):
        schema = export_schema()
        operations = []
        for path, item in schema['paths'].items():
            if not path.startswith('/api/challenges'):
                continue
            for method, operation in item.items():
                if method not in {'get', 'post'}:
                    continue
                operations.append(operation['operationId'])
                expected = 'ChallengeListResponse' if operation['operationId'] == 'listChallenges' else 'ChallengeResponse'
                status = '201' if operation['operationId'] == 'startChallenge' else '200'
                with self.subTest(operation=operation['operationId']):
                    self.assertEqual(operation['responses'][status]['content']['application/json']['schema'],
                                     {'$ref': '#/components/schemas/' + expected})
        self.assertEqual(len(operations), 8)


class ChallengeResponseTests(unittest.TestCase):
    setUp = fixtures.LearningTests.setUp
    tearDown = fixtures.LearningTests.tearDown

    def start(self, key='contract-start-key'):
        result = self.client.post('/api/challenges', json={'mode': 'chapter_entry',
            'module_id': 'm2', 'idempotency_key': key})
        self.assertEqual(result.status_code, 201, result.text)
        return result.json()

    def command(self, identifier, operation, key, **payload):
        body = {'idempotency_key': key, **payload}
        result = self.client.post(f'/api/challenges/{identifier}/{operation}', json=body)
        self.assertEqual(result.status_code, 200, result.text)

        async def receipt():
            async with self.app.state.db.sessions() as db:
                return (await db.get(ChallengeCommand, (self.owner_id, key))).response

        self.assertEqual(result.json(), self.client.portal.call(receipt))
        self.assertEqual(self.client.post(f'/api/challenges/{identifier}/{operation}', json=body).json(), result.json())
        return result.json()

    def identify_owner(self, identifier):
        async def owner():
            async with self.app.state.db.sessions() as db:
                return (await db.get(ChallengeAttempt, identifier)).user_id
        self.owner_id = self.client.portal.call(owner)

    def test_start_read_and_list_preserve_public_projection_and_hide_private_state(self):
        started = self.start()
        identifier = started['id']

        async def saved():
            async with self.app.state.db.sessions() as db:
                attempt = await db.get(ChallengeAttempt, identifier)
                return response(attempt), deepcopy(attempt.snapshot_json)
        projected, private = self.client.portal.call(saved)
        resumed = self.client.get('/api/challenges/' + identifier)
        listed = self.client.get('/api/challenges')

        self.assertEqual(started, projected)
        self.assertEqual(resumed.json(), started)
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(set(listed.json()['attempts'][0]),
                         {'id', 'challenge_id', 'mode', 'module_id', 'status', 'created_at', 'updated_at'})
        self.assertEqual(listed.json()['attempts'][0]['id'], identifier)
        self.assertIn('prices', private['human'])
        self.assertEqual(set(started['opponents'][0]), {'id', 'display_name', 'tick'})
        self.assertIsNone(started['result'])
        self.assertEqual([len(prices) for prices in started['player']['history'].values()], [1] * 4)
        for forbidden in ('seed', 'prices', 'liquidity', 'events', 'agents', 'approved', 'research'):
            self.assertNotIn(forbidden, started)
            self.assertNotIn(forbidden, started['player'])
        self.assertNotIn('strategy', started['opponents'][0])
        self.assertNotIn('state', started['opponents'][0])

    def test_order_cancel_advance_and_completion_match_committed_receipts(self):
        started = self.start()
        identifier = started['id']
        self.identify_owner(identifier)
        placed = self.command(identifier, 'orders', 'contract-order-key',
            order=order(type='limit', price='1', quantity=1))
        self.command(identifier, 'orders/' + placed['player']['orders'][0]['id'] + '/cancel', 'contract-cancel-key')
        self.command(identifier, 'orders', 'contract-market-key', order=order(quantity=1))
        for index in range(6):
            advanced = self.command(identifier, 'advance', f'contract-advance-{index}', steps=5)
        self.assertTrue(advanced['player']['fills'])
        self.assertTrue(advanced['player']['positions'])
        self.assertIsNone(advanced['result'])

        completed = self.command(identifier, 'complete', 'contract-complete-key',
            reflection='I compared the final value with costs and my original written plan.')

        self.assertEqual(completed['status'], 'completed')
        self.assertEqual(completed['result']['final_tick'], 29)
        self.assertEqual(set(completed['result']['leaderboard'][0]),
                         {'participant_id', 'display_name', 'profit', 'final_value', 'fees', 'rank'})
        self.assertEqual(completed['result']['awards']['awarded'], {'stocks': 0, 'premium': 0, 'xp': 20})
        self.assertEqual(self.client.get('/api/challenges/' + identifier).json(), completed)

    def test_abandonment_has_no_result_and_preserves_its_receipt(self):
        identifier = self.start()['id']
        self.identify_owner(identifier)

        abandoned = self.command(identifier, 'abandon', 'contract-abandon-key')

        self.assertEqual(abandoned['status'], 'abandoned')
        self.assertIsNone(abandoned['result'])
        self.assertEqual(self.client.get('/api/challenges/' + identifier).json(), abandoned)

    def test_historical_start_receipt_replays_without_current_schema_normalization(self):
        identifier = self.start()['id']
        self.identify_owner(identifier)

        async def historical_receipt():
            async with self.app.state.db.sessions.begin() as db:
                receipt = await db.get(ChallengeCommand, (self.owner_id, 'contract-start-key'))
                historical = {**receipt.response, 'legacy_field': '  preserved verbatim  '}
                receipt.response = historical
                attempt = await db.get(ChallengeAttempt, identifier)
                attempt.version = 'retired'
                return historical
        expected = self.client.portal.call(historical_receipt)

        self.assertEqual(self.start(), expected)
        self.assertEqual(self.client.get('/api/challenges/' + identifier).status_code, 409)

    def test_historical_mutation_receipt_replays_without_current_schema_normalization(self):
        identifier = self.start()['id']
        self.identify_owner(identifier)
        self.command(identifier, 'advance', 'contract-legacy-key', steps=1)

        async def historical_receipt():
            async with self.app.state.db.sessions.begin() as db:
                receipt = await db.get(ChallengeCommand, (self.owner_id, 'contract-legacy-key'))
                historical = {**receipt.response, 'legacy_field': '  preserved verbatim  '}
                receipt.response = historical
                attempt = await db.get(ChallengeAttempt, identifier)
                attempt.version = 'retired'
                return historical
        expected = self.client.portal.call(historical_receipt)

        replayed = self.client.post(f'/api/challenges/{identifier}/advance', json={
            'idempotency_key': 'contract-legacy-key', 'steps': 1})

        self.assertEqual(replayed.status_code, 200)
        self.assertEqual(replayed.json(), expected)
        self.assertEqual(self.client.post(f'/api/challenges/{identifier}/advance', json={
            'idempotency_key': 'contract-legacy-key', 'steps': 2}).status_code, 409)
