from dataclasses import replace
import tempfile
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.config import Settings
from app.db import Profile, SessionToken
from app.main import create_app
from test_learning import fixture_catalog


class PublicAdventureTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.settings = Settings(database_url=f'sqlite+aiosqlite:///{self.temp.name}/test.db')
        self.content = fixture_catalog()
        self.app = create_app(self.settings, self.content)
        self.client = TestClient(self.app, headers={'Origin': 'http://localhost:5173'})
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.temp.cleanup()

    def test_anonymous_catalog_lists_all_chapters_and_levels_without_private_fields(self):
        response = self.client.get('/api/adventure/catalog')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.json()), {'chapters'})
        chapters = response.json()['chapters']
        self.assertEqual([chapter['order'] for chapter in chapters], list(range(1, 11)))
        for chapter, module in zip(chapters, self.content['modules']):
            self.assertEqual(set(chapter), {'module_id', 'title', 'order', 'description', 'introductory_assessment', 'levels'})
            self.assertEqual(len(chapter['levels']), len(module['lessons']))
            for level, lesson in zip(chapter['levels'], module['lessons']):
                self.assertEqual(level, {'id': lesson['id'], 'title': lesson['title'], 'objective': lesson['objective'], 'required_steps': len(lesson['questions']), 'bonus_steps': 0})

    def test_browsing_does_not_create_profile_or_session(self):
        response = self.client.get('/api/adventure/catalog')

        async def counts():
            async with self.app.state.db.sessions() as db:
                return [await db.scalar(select(func.count()).select_from(model)) for model in (Profile, SessionToken)]
        self.assertNotIn('set-cookie', response.headers)
        self.assertEqual(self.client.portal.call(counts), [0, 0])

    def test_public_catalog_enforces_production_publication_review(self):
        self.app.state.settings = replace(self.settings, environment='production')

        response = self.client.get('/api/adventure/catalog')

        self.assertEqual(response.status_code, 503)
        self.assertNotIn('chapters', response.json())

    def test_anonymous_level_start_is_rejected(self):
        response = self.client.post('/api/levels/m1-l1/runs', json={'idempotency_key': 'public-start-test'})
        self.assertEqual(response.status_code, 401)

    def test_anonymous_boss_start_is_rejected(self):
        response = self.client.post('/api/challenges', json={'mode': 'chapter_entry', 'module_id': 'm2', 'idempotency_key': 'public-boss-test'})
        self.assertEqual(response.status_code, 401)

    def test_anonymous_answer_submission_is_rejected(self):
        response = self.client.post('/api/learning-runs/unknown/steps/unknown/submit', json={'idempotency_key': 'public-answer-test', 'answer': {'acknowledged': True}})
        self.assertEqual(response.status_code, 401)

    def test_personal_progress_remains_private(self):
        response = self.client.get('/api/adventure')
        self.assertEqual(response.status_code, 401)

    def test_signing_in_does_not_bypass_chapter_prerequisites(self):
        self.content['modules'][1]['entry_tasks'] = [{'id': 'entry', 'type': 'instruction', 'text': 'Readiness check'}]
        self.client.post('/api/session')

        response = self.client.post('/api/levels/m2-l1/runs', json={'idempotency_key': 'locked-start-test'})

        self.assertEqual(response.status_code, 403)

    def test_interactive_preview_counts_steps_without_returning_tasks(self):
        module = self.content['modules'][0]
        module['entry_tasks'] = [{'private': 'entry'}]
        module['lessons'][0]['tasks'] = [{'private': 'answer'}] * 3
        module['lessons'][0]['bonus_tasks'] = [{'private': 'bonus'}]

        response = self.client.get('/api/adventure/catalog')

        chapter = response.json()['chapters'][0]
        self.assertTrue(chapter['introductory_assessment'])
        self.assertEqual(chapter['levels'][0]['required_steps'], 3)
        self.assertEqual(chapter['levels'][0]['bonus_steps'], 1)
        self.assertNotIn('private', response.text)
