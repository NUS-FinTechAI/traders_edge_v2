from dataclasses import replace
import json
from pathlib import Path
import tempfile
import unittest

from app.content.bundle import AWAITING_REVIEW, load_review
from app.content.checks import ContentError
from app.content.validate import without_bonus_missions
from progression_fixtures import AppCase, fixture_content


class ContentReviewGateTests(AppCase):
    def in_production(self, status):
        self.app.state.settings = replace(self.settings, environment='production')
        self.app.state.content = replace(fixture_content(), review_status=status)

    def test_production_refuses_gameplay_until_content_is_approved(self):
        self.in_production('authored_requires_independent_review')

        responses = [self.client.get('/api/campaign/levels/ch1-l1'), self.client.post('/api/games', json={'mode': 'practice'}),
                     self.client.post('/api/quizzes/attempts', json={'topic_id': 'chapter-1'}), self.client.post('/api/lobbies', json={}),
                     self.client.get('/api/daily')]

        self.assertEqual([response.status_code for response in responses], [503] * 5)
        self.assertEqual({response.json()['detail'] for response in responses}, {AWAITING_REVIEW})

    def test_production_serves_gameplay_once_content_is_approved(self):
        self.in_production('approved')

        self.assertEqual(self.client.post('/api/games', json={'mode': 'practice'}).status_code, 201)

    def test_development_serves_unreviewed_content(self):
        self.assertEqual(self.content.review_status, 'authored_requires_independent_review')
        self.assertEqual(self.client.post('/api/games', json={'mode': 'practice'}).status_code, 201)


class ReviewFileTests(unittest.TestCase):
    def write(self, data):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = Path(directory.name) / 'review.json'
        path.write_text(json.dumps(data))
        return path

    def test_shipped_review_file_records_that_content_awaits_review(self):
        self.assertEqual(load_review(), 'authored_requires_independent_review')

    def test_unknown_status_is_rejected(self):
        with self.assertRaisesRegex(ContentError, 'review.json.status'):
            load_review(self.write({'status': 'looks-fine', 'notes': 'No reviewer.'}))

    def test_missing_file_is_rejected(self):
        with self.assertRaisesRegex(ContentError, 'is missing'):
            load_review(Path(tempfile.gettempdir()) / 'no-such-review.json')


class BonusMissionCheckTests(unittest.TestCase):
    def scenarios(self, bonus):
        missions = {'basic': [{'id': 'm1'}], 'bonus': [{'id': 'b1'}] if bonus else []}
        return {'practice-trend-rider': {'balance': 'lesson', 'missions': missions},
                'practice-free-play': {'balance': None, 'missions': {'basic': [{'id': 'm1'}], 'bonus': []}}}

    def test_lesson_and_campaign_scenarios_without_bonus_missions_are_listed(self):
        self.assertEqual(without_bonus_missions(fixture_content(), self.scenarios(bonus=False)), ['practice-trend-rider'])

    def test_scenarios_with_bonus_missions_or_outside_the_campaign_pass(self):
        self.assertEqual(without_bonus_missions(fixture_content(), self.scenarios(bonus=True)), [])
