import unittest

from app.db import Profile
from app.learning import profile_data
from app.progression import progress

import test_learning as fixtures


class GameXPTests(unittest.TestCase):
    setUp = fixtures.LearningTests.setUp
    tearDown = fixtures.LearningTests.tearDown
    body = fixtures.LearningTests.body

    def test_login_xp_is_player_progress_but_not_learning_evidence(self):
        before = self.client.get('/api/me/activity').json()
        self.client.patch('/api/me/profile', json={'leaderboard_opt_in': True})
        claim = self.client.post('/api/me/economy/login-claims', json={'idempotency_key': 'daily-login-claim'})
        self.assertEqual(claim.status_code, 200, claim.text)
        profile = self.client.get('/api/me/profile').json()
        self.assertEqual((profile['xp'], profile['learning_xp'], profile['game_xp']), (5, 0, 5))
        self.assertEqual(profile['player_level'], 1)
        self.assertFalse(profile['learning_only'])
        self.assertEqual(self.client.get('/api/leaderboard').json()['entries'], [])
        self.assertEqual(self.client.get('/api/me/activity').json(), before)
        inventory = self.client.get('/api/me/rewards').json()['items']
        self.assertEqual(next(item for item in inventory if item['id'] == 'badge-first-lesson')['status'], 'locked')
        lesson = self.content['modules'][0]['lessons'][0]
        completed = self.client.post('/api/lessons/' + lesson['id'] + '/complete', json=self.body(lesson['questions']))
        self.assertEqual(completed.status_code, 200, completed.text)
        profile = self.client.get('/api/me/profile').json()
        self.assertEqual((profile['xp'], profile['learning_xp'], profile['game_xp']), (25, 20, 5))
        self.assertEqual(self.client.get('/api/leaderboard').json()['entries'][0]['xp'], 20)
        self.assertEqual(self.client.post('/api/me/economy/login-claims', json={'idempotency_key': 'daily-login-claim'}).json(), claim.json())

    def test_profile_uses_one_current_xp_snapshot_after_a_concurrent_reward(self):
        user_id = self.client.get('/api/me/profile').json()['id']
        async def earlier():
            async with self.app.state.db.sessions() as db:
                return await progress(db, user_id)
        stale_progress = self.client.portal.call(earlier)
        self.assertEqual(stale_progress[2], 0)
        self.client.post('/api/me/economy/login-claims', json={'idempotency_key': 'concurrent-login-key'})
        async def projected():
            async with self.app.state.db.sessions() as db:
                return await profile_data(db, await db.get(Profile, user_id), stale_progress)
        profile = self.client.portal.call(projected)
        self.assertEqual((profile['xp'], profile['learning_xp'], profile['game_xp']), (5, 0, 5))
