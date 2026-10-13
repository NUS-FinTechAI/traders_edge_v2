from types import SimpleNamespace
import unittest

from pydantic import ValidationError

from app.export_openapi import export_schema
from app.api_schemas.learning_run_schema import LearningRunResponse
from app.api_schemas.simulation_schema import BoundSimulationResponse
from app.api_schemas.shared_schema import Command
from app.api_schemas.economy_schema import Command as EconomyCommand
from app.simulation import api, engine
from app.simulation.bindings import BINDING, public_binding


def completed_run():
    return {
        'id': 'run-one', 'purpose': 'diagnostic', 'module_id': 'module-one',
        'level_id': None, 'content_version': '2026-10-04.4', 'status': 'completed',
        'current_step': None, 'feedback': [],
        'progress': {'completed_steps': 1, 'total_steps': 1},
        'result': {
            'attempt_id': 'attempt-one', 'passed': None, 'score_percent': 0,
            'critical_items_passed': False, 'standard_star': False,
            'bonus_star': False, 'xp_awarded': 0,
            'profile': {
                'id': 'owner', 'display_name': 'Learner', 'leaderboard_opt_in': False,
                'analytics_opt_in': False, 'xp': 0, 'completed_lesson_ids': [],
                'mastered_module_ids': [], 'activity_days': [], 'activity_timezone': 'UTC',
                'due_review_count': 0, 'learning_only': True,
            },
        },
    }


class LearningResponseContractTests(unittest.TestCase):
    def test_shared_commands_do_not_add_fields_to_historical_hash_payloads(self):
        command = Command(idempotency_key='saved-command')

        payload = command.model_dump(exclude={'idempotency_key'})

        self.assertEqual(payload, {})

    def test_economy_commands_retain_the_required_policy_default(self):
        command = EconomyCommand(idempotency_key='saved-command')

        payload = command.model_dump(exclude={'idempotency_key'})

        self.assertEqual(payload, {'policy_version': '1'})

    def test_historical_profile_snapshot_serializes_without_new_economy_fields(self):
        receipt = completed_run()

        serialized = LearningRunResponse.model_validate(receipt).model_dump(mode='json', exclude_unset=True)

        self.assertEqual(serialized, receipt)

    def test_historical_tokenless_audit_feedback_preserves_absent_and_null_fields(self):
        receipt = completed_run()
        receipt['feedback'] = [{
            'step_id': 'audit', 'correct': False, 'explanation': 'Review recorded facts.',
            'issues': [{'code': 'session_fees', 'message': 'Check fees.', 'expected': '0.00'}],
            'audited_observation': {
                'tick': 10, 'engine_version': 1, 'orders': [], 'session_fees': '0.00',
                'price_limit_guarantees_fill': False, 'no_order_reason': None,
            },
            'observation_phase': 'before_finish_cancellation',
        }]

        serialized = LearningRunResponse.model_validate(receipt).model_dump(mode='json', exclude_unset=True)

        self.assertEqual(serialized, receipt)

    def test_current_bound_public_view_serializes_without_changing_response(self):
        state = engine.new_session(17, ticks=30)
        state['bound_policy'] = {
            **public_binding(BINDING), 'run_id': 'run-one', 'session_id': 'session-one',
            'content_version': '2026-10-04.4', 'rubric_version': 'interactive-2',
            'unit_price_cap': engine.quote(state, 'NORTH')['ask'],
        }
        receipt = api.response(SimpleNamespace(id='session-one', mode='guided', updated_at=None, snapshot_json=state))

        serialized = BoundSimulationResponse.model_validate(receipt).model_dump(mode='json', exclude_unset=True)

        self.assertEqual(serialized, receipt)

    def test_choice_task_cannot_omit_its_options(self):
        receipt = completed_run()
        receipt.update(status='active', result=None, current_step={'id': 'choice', 'type': 'choice', 'prompt': 'Choose.'})

        with self.assertRaises(ValidationError):
            LearningRunResponse.model_validate(receipt)

    def test_learning_and_bound_simulation_routes_declare_success_models(self):
        schema = export_schema()
        expected = {'startDiagnosticRun', 'startLevelRun', 'getLearningRun', 'submitLearningStep',
                    'startAssessmentRun', 'startReviewRun', 'bindLearningSimulation',
                    'resumeLearningSimulation', 'reviewLearningSimulation'}

        operations = {operation['operationId']: operation for path in schema['paths'].values()
                      for method, operation in path.items() if method in {'get', 'post'}}

        for name in expected:
            with self.subTest(operation=name):
                self.assertIn('$ref', operations[name]['responses']['200']['content']['application/json']['schema'])
