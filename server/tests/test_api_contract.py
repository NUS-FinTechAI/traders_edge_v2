from datetime import datetime, timezone
import json
import os
import subprocess
import sys
import unittest
from unittest.mock import patch

from fastapi.encoders import jsonable_encoder

from app.api_schemas import GuestSession, UserProfile
from app.export_openapi import export_schema


class ApiContractTests(unittest.TestCase):
    def test_export_does_not_initialize_database_or_firebase(self):
        with patch('app.main.Database', side_effect=AssertionError('Database initialized')), \
                patch('firebase_admin.initialize_app', side_effect=AssertionError('Firebase initialized')):
            schema = export_schema()

        operations = [operation['operationId'] for item in schema['paths'].values()
                      for method, operation in item.items() if method in {'get', 'post', 'patch', 'delete'}]
        self.assertEqual(len(operations), len(set(operations)))
        self.assertIn('getProfile', operations)
        self.assertEqual(schema['paths']['/api/config']['get']['x-client-auth'], 'none')

    def test_export_is_identical_under_invalid_deployment_settings(self):
        expected = export_schema()
        environment = {**os.environ, 'APP_ENV': 'production', 'AUTH_MODE': 'invalid',
                       'DATABASE_URL': 'invalid', 'RESEARCH_ENABLED': 'true',
                       'RESEARCH_POLICY_VERSION': '', 'RESEARCH_POLICY_TEXT': ''}

        result = subprocess.run([sys.executable, '-m', 'app.export_openapi'], env=environment,
                                check=True, capture_output=True, text=True)

        self.assertEqual(json.loads(result.stdout), expected)

    def test_guest_response_model_preserves_existing_timestamp_serialization(self):
        payload = {'profile_id': 'guest', 'auth_mode': 'guest',
                   'expires_at': datetime(2026, 10, 10, tzinfo=timezone.utc)}

        response = GuestSession.model_validate(payload).model_dump(mode='json')

        self.assertEqual(response, jsonable_encoder(payload))

    def test_profile_schema_includes_game_progress_and_boolean_learning_only(self):
        schema = UserProfile.model_json_schema()

        self.assertEqual(schema['properties']['learning_only']['type'], 'boolean')
        self.assertTrue({'learning_xp', 'game_xp', 'player_level', 'player_level_policy', 'xp_basis'} <= set(schema['required']))
