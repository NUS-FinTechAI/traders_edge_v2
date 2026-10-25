from app.player import ledger
from progression_fixtures import AppCase


class UnlockNotificationTests(AppCase):
    def unread(self):
        response = self.client.get('/api/me')
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['unread_unlocks']

    def grant(self, item_id):
        async def award(db):
            await ledger.grant(db, self.user_id, item_id, self.content.cosmetics, [], self.now)
        self.run_db(award)

    def seen(self, item_id, category='cosmetics'):
        return self.client.post('/api/me/unlocks/seen', json={'unlocks': [{'category': category, 'item_id': item_id}]})

    def test_starter_cosmetics_and_free_themes_have_no_notifications(self):
        self.assertEqual(self.unread(), [])

    def test_purchased_cosmetic_appears_as_unread_in_its_gallery(self):
        item = next(item for item in self.content.cosmetics.shop() if item['kind'] == 'avatar')

        async def fund(db):
            await ledger.credit(db, self.user_id, 'test-funds', self.now, stocks=10000, gems=10000)
        self.run_db(fund)

        response = self.client.post('/api/shop/purchase', json={'item_id': item['id']})

        self.assertEqual(response.status_code, 200, response.text)
        notice = {'category': 'cosmetics', 'group': 'avatars', 'item_id': item['id']}
        self.assertIn(notice, response.json()['player']['unread_unlocks'])
        self.assertIn(notice, self.unread())

    def test_progression_reward_appears_without_a_purchase(self):
        self.play_preview('ch1')
        for number in range(1, 4):
            self.star_level(f'ch1-l{number}')

        self.assertIn({'category': 'cosmetics', 'group': 'avatars', 'item_id': 'avatar-ch1-explorer'}, self.unread())

    def test_purchased_theme_appears_in_the_themes_gallery(self):
        item = next(item for item in self.content.cosmetics.shop() if item['kind'] == 'theme')
        self.grant(item['id'])

        self.assertIn({'category': 'cosmetics', 'group': 'themes', 'item_id': item['id']}, self.unread())

    def test_new_rank_titles_are_unread_when_the_player_levels_up(self):
        async def award(db):
            await ledger.award_xp(db, self.user_id, 'level-test', 550, 'Test', self.now)
        self.run_db(award)

        self.assertIn({'category': 'cosmetics', 'group': 'titles', 'item_id': 'title-rank-able-seaman'}, self.unread())

    def test_acknowledgement_persists_across_reads_and_repeated_requests(self):
        self.grant('avatar-guide-1')

        response = self.seen('avatar-guide-1')

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['unread_unlocks'], [])
        self.assertEqual(self.unread(), [])
        self.assertEqual(self.seen('avatar-guide-1').status_code, 200)

    def test_acknowledging_one_item_keeps_other_items_unread(self):
        self.grant('avatar-guide-1')
        self.grant('title-steady-hand')

        self.seen('avatar-guide-1')

        self.assertEqual(self.unread(), [{'category': 'cosmetics', 'group': 'titles', 'item_id': 'title-steady-hand'}])

    def test_read_receipts_are_isolated_between_players(self):
        self.grant('avatar-guide-1')
        self.seen('avatar-guide-1')
        self.switch_user()
        self.grant('avatar-guide-1')

        self.assertEqual(self.unread(), [{'category': 'cosmetics', 'group': 'avatars', 'item_id': 'avatar-guide-1'}])

    def test_unowned_content_cannot_be_marked_seen_before_it_is_earned(self):
        response = self.seen('avatar-guide-1')
        self.assertEqual(response.status_code, 403)

        self.grant('avatar-guide-1')

        self.assertEqual(len(self.unread()), 1)

    def test_unknown_categories_cannot_hide_owned_cosmetics(self):
        self.grant('avatar-guide-1')

        self.assertEqual(self.seen('avatar-guide-1', 'unknown').status_code, 403)
        self.assertEqual(len(self.unread()), 1)

    def test_acknowledgement_requires_authentication(self):
        self.client.cookies.clear()

        self.assertEqual(self.seen('avatar-guide-1').status_code, 401)

    def test_acknowledgement_rejects_empty_requests(self):
        response = self.client.post('/api/me/unlocks/seen', json={'unlocks': []})

        self.assertEqual(response.status_code, 422)
