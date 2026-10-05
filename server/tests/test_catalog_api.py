"""Exercise the authored catalog through the public API and authoritative grading."""
import tempfile
import unittest

from fastapi.testclient import TestClient

from app.config import Settings
from app.content.catalog import load_catalog
from app.main import create_app


class CatalogAPITests(unittest.TestCase):
    def test_all_authored_learning_paths_grade_and_unlock_without_key_leaks(self):
        private_catalog = load_catalog()
        with tempfile.TemporaryDirectory() as directory:
            app = create_app(Settings(database_url=f'sqlite+aiosqlite:///{directory}/catalog.db'))
            with TestClient(app, headers={'Origin': 'http://localhost:5173'}) as client:
                self.assertEqual(client.post('/api/session').status_code, 200)
                for module in private_catalog['modules']:
                    for lesson in module['lessons']:
                        response = client.get(f"/api/lessons/{lesson['id']}")
                        self.assertEqual(response.status_code, 200, response.text)
                        self.assertNotIn('correct_option_id', response.text)
                        self.assertNotIn('critical', response.json()['lesson']['questions'][0])
                        self.assertEqual(len(response.json()['lesson']['learning_cycle']), 9)
                        body = {'idempotency_key': lesson['id'] + '-practice', 'answers': [{'question_id': q['id'], 'option_id': q['correct_option_id']} for q in lesson['questions']], 'reflection': 'I would protect essential needs and explain the uncertainty before acting.'}
                        response = client.post(f"/api/lessons/{lesson['id']}/complete", json=body)
                        self.assertEqual(response.status_code, 200, response.text)
                        self.assertTrue(response.json()['passed'])
                    public = client.get(f"/api/modules/{module['id']}/assessment")
                    self.assertEqual(public.status_code, 200)
                    self.assertNotIn('correct_option_id', public.text)
                    body = {'idempotency_key': module['id'] + '-assessment', 'answers': [{'question_id': q['id'], 'option_id': q['correct_option_id']} for q in module['assessment']], 'reflection': 'A favorable outcome alone does not demonstrate good decision-making.'}
                    response = client.post(f"/api/modules/{module['id']}/assessment", json=body)
                    self.assertEqual(response.status_code, 200, response.text)
                    self.assertTrue(response.json()['passed'])
                profile = client.get('/api/me/profile').json()
                self.assertEqual(len(profile['completed_lesson_ids']), 30)
                self.assertEqual(len(profile['mastered_module_ids']), 10)
                self.assertEqual(profile['xp'], 1100)
                self.assertEqual(len(client.get('/api/reviews').json()['reviews']), 30)
                self.assertTrue(client.get('/api/archive').json()['terms'])
