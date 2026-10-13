import unittest

from pydantic import ValidationError

from app.api_schemas.order_schema import SubmitOrder
from test_simulation import order


class OrderSchemaTests(unittest.TestCase):
    def test_nested_order_accepts_only_learner_supplied_fields(self):
        payload = {'idempotency_key': 'nested-order-key', 'order': order(quantity=1)}

        command = SubmitOrder.model_validate(payload)

        self.assertEqual(command.order.model_dump(), {**payload['order'], 'price': None})

    def test_nested_order_rejects_server_owned_fields(self):
        for field, value in {'id': 'forged', 'status': 'filled', 'filled': 1,
                             'remaining': 0, 'submitted_tick': 0, 'triggered': True}.items():
            with self.subTest(field=field):
                payload = {'idempotency_key': 'nested-order-key', 'order': {**order(), field: value}}

                with self.assertRaises(ValidationError) as error:
                    SubmitOrder.model_validate(payload)

                self.assertEqual(error.exception.errors()[0]['loc'], ('order', field))
                self.assertEqual(error.exception.errors()[0]['type'], 'extra_forbidden')

    def test_nested_order_rejects_an_incomplete_plan(self):
        payload = {'idempotency_key': 'nested-order-key', 'order': order(plan={})}

        with self.assertRaises(ValidationError) as error:
            SubmitOrder.model_validate(payload)

        self.assertEqual({item['loc'] for item in error.exception.errors()}, {
            ('order', 'plan', field) for field in ('reason', 'risk', 'exit', 'size_reason', 'max_loss')
        })
