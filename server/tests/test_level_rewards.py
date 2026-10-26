from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace

from fastapi.testclient import TestClient

from app.main import create_app
from app.player import ledger
from progression_fixtures import AppCase


class LevelRewardTests(AppCase):
    def earn(self, xp):
        async def award(db):
            await ledger.award_xp(db, self.user_id, f'fixture:{xp}', xp, 'Fixture XP', self.now)
        self.run_db(award)

    def test_schedule_increases_every_five_levels_and_caps_at_thirty(self):
        rewards = self.client.get('/api/me/level-rewards').json()

        self.assertEqual([entry['level'] for entry in rewards], list(range(2, 51)))
        for level, expected in [(2, 5), (5, 5), (6, 10), (10, 10), (11, 15), (20, 20),
                                (21, 25), (25, 25), (26, 30), (50, 30)]:
            self.assertEqual(rewards[level - 2]['amount'], expected)
        self.assertTrue(all(entry['status'] == 'locked' for entry in rewards))

    def test_claiming_a_locked_level_leaves_the_wallet_unchanged(self):
        response = self.client.post('/api/me/level-rewards/claim', json={'level': 2})

        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.client.get('/api/me').json()['wallet']['gems'], 0)

    def test_reward_notifications_remain_until_claimed_and_preserve_other_notifications(self):
        self.earn(225)
        before = self.client.get('/api/me').json()['unread_unlocks']
        first = self.client.post('/api/me/level-rewards/claim', json={'level': 2}).json()['player']['unread_unlocks']
        last = self.client.post('/api/me/level-rewards/claim', json={}).json()['player']['unread_unlocks']

        def pending(notices):
            return [notice['item_id'] for notice in notices if notice['category'] == 'level_rewards']

        self.assertEqual(pending(before), ['2', '3'])
        self.assertEqual(pending(first), ['3'])
        self.assertEqual(pending(last), [])
        self.assertEqual(last, [notice for notice in before if notice['category'] != 'level_rewards'])

    def test_viewing_or_acknowledging_rewards_does_not_clear_claim_notifications(self):
        self.earn(100)
        self.client.get('/api/me/level-rewards')
        response = self.client.post('/api/me/unlocks/seen', json={
            'unlocks': [{'category': 'level_rewards', 'item_id': '2'}]})

        self.assertEqual(response.status_code, 403)
        notices = self.client.get('/api/me').json()['unread_unlocks']
        self.assertIn({'category': 'level_rewards', 'group': 'levels', 'item_id': '2'}, notices)

    def test_individual_claim_persists_and_cannot_pay_twice(self):
        self.earn(100)
        first = self.client.post('/api/me/level-rewards/claim', json={'level': 2}).json()
        repeat = self.client.post('/api/me/level-rewards/claim', json={'level': 2}).json()

        self.assertEqual((first['gems'], repeat['gems']), (5, 0))
        self.assertEqual(repeat['player']['wallet']['gems'], 5)
        self.assertEqual(repeat['player']['xp'], 100)
        self.assertEqual(self.client.get('/api/me/level-rewards').json()[0]['status'], 'claimed')

    def test_claim_all_recovers_skipped_levels_without_repeating_individual_claims(self):
        self.earn(750)
        self.client.post('/api/me/level-rewards/claim', json={'level': 3})
        claim = self.client.post('/api/me/level-rewards/claim', json={}).json()
        repeat = self.client.post('/api/me/level-rewards/claim', json={}).json()

        self.assertEqual(claim['gems'], 25)
        self.assertEqual(claim['player']['wallet']['gems'], 30)
        self.assertEqual(repeat['gems'], 0)
        self.assertEqual([entry['status'] for entry in claim['rewards'][:6]], ['claimed'] * 5 + ['locked'])

    def test_claims_are_scoped_to_the_signed_in_player(self):
        self.earn(100)
        self.switch_user()
        response = self.client.post('/api/me/level-rewards/claim', json={}).json()

        self.assertEqual(response['gems'], 0)
        self.assertEqual(response['player']['wallet']['gems'], 0)

    def test_max_level_claims_every_reward_once_and_ignores_excess_xp(self):
        self.earn(10**7)
        claim = self.client.post('/api/me/level-rewards/claim', json={}).json()
        repeat = self.client.post('/api/me/level-rewards/claim', json={}).json()

        self.assertEqual(claim['gems'], 1120)
        self.assertEqual(claim['player']['level'], 50)
        self.assertEqual(len(claim['rewards']), 49)
        self.assertTrue(all(entry['status'] == 'claimed' for entry in claim['rewards']))
        self.assertEqual(repeat['gems'], 0)

    def test_concurrent_claims_and_restart_preserve_one_payment_per_level(self):
        self.earn(100)
        token = self.client.cookies.get(self.settings.cookie_name)
        app = create_app(replace(self.settings, auto_migrate=False), self.content)
        with TestClient(app, headers={'Origin': 'http://localhost:5173'}) as restarted:
            restarted.cookies.set(self.settings.cookie_name, token)
            with ThreadPoolExecutor(max_workers=2) as pool:
                responses = list(pool.map(lambda client: client.post('/api/me/level-rewards/claim', json={}),
                                          (self.client, restarted)))
            self.assertEqual([response.status_code for response in responses], [200, 200])
            self.assertEqual(sorted(response.json()['gems'] for response in responses), [0, 5])
            self.assertEqual(restarted.get('/api/me').json()['wallet']['gems'], 5)
            self.assertEqual(restarted.post('/api/me/level-rewards/claim', json={}).json()['gems'], 0)

    def test_old_entitlements_and_claimed_gems_survive_weekly_reset(self):
        self.earn(100)
        self.now += timedelta(days=14)
        claim = self.client.post('/api/me/level-rewards/claim', json={}).json()
        self.now += timedelta(days=7)

        self.assertEqual(claim['gems'], 5)
        self.assertEqual(self.client.get('/api/me').json()['wallet']['gems'], 5)

    def test_out_of_range_claims_are_rejected(self):
        for level in (0, 1, 51, -1):
            with self.subTest(level=level):
                response = self.client.post('/api/me/level-rewards/claim', json={'level': level})
                self.assertEqual(response.status_code, 422)

    def test_rewards_require_authentication(self):
        self.client.cookies.clear()
        self.assertEqual(self.client.get('/api/me/level-rewards').status_code, 401)
        self.assertEqual(self.client.post('/api/me/level-rewards/claim', json={}).status_code, 401)
