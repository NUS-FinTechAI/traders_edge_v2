from app.player import ledger
from app.campaign.views import archive_keyword_id
from progression_fixtures import AppCase

INITIAL_UNREAD = [
    *[{'category': 'cosmetics', 'group': 'avatars', 'item_id': f'avatar-starter-{number}'} for number in range(1, 5)],
    {'category': 'cosmetics', 'group': 'themes', 'item_id': 'theme-palette-colorblind'},
    {'category': 'cosmetics', 'group': 'themes', 'item_id': 'theme-palette-high-contrast'},
    {'category': 'cosmetics', 'group': 'titles', 'item_id': 'title-rank-deckhand'},
    {'category': 'campaign', 'group': 'chapters', 'item_id': 'ch1'},
    *[{'category': 'archive', 'group': 'keywords', 'item_id': archive_keyword_id(f'ch1-l{number}', f'Term 1.{number}')}
      for number in range(1, 6)],
]


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

    def test_initially_available_chapter_and_cosmetics_start_unread(self):
        self.assertCountEqual(self.unread(), INITIAL_UNREAD)

    def test_initial_content_can_be_acknowledged_once_in_a_batch(self):
        keys = [{'category': item['category'], 'item_id': item['item_id']} for item in INITIAL_UNREAD]

        response = self.client.post('/api/me/unlocks/seen', json={'unlocks': keys})

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['unread_unlocks'], [])
        self.assertEqual(self.unread(), [])
        self.assertEqual(self.client.post('/api/me/unlocks/seen', json={'unlocks': keys}).status_code, 200)

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
        self.assertCountEqual(response.json()['unread_unlocks'], INITIAL_UNREAD)
        self.assertCountEqual(self.unread(), INITIAL_UNREAD)
        self.assertEqual(self.seen('avatar-guide-1').status_code, 200)

    def test_acknowledging_one_item_keeps_other_items_unread(self):
        self.grant('avatar-guide-1')
        self.grant('title-steady-hand')

        self.seen('avatar-guide-1')

        self.assertCountEqual(self.unread(), INITIAL_UNREAD + [{'category': 'cosmetics', 'group': 'titles', 'item_id': 'title-steady-hand'}])

    def test_read_receipts_are_isolated_between_players(self):
        self.grant('avatar-guide-1')
        self.seen('avatar-guide-1')
        self.switch_user()
        self.grant('avatar-guide-1')

        self.assertCountEqual(self.unread(), INITIAL_UNREAD + [{'category': 'cosmetics', 'group': 'avatars', 'item_id': 'avatar-guide-1'}])

    def test_unowned_content_cannot_be_marked_seen_before_it_is_earned(self):
        response = self.seen('avatar-guide-1')
        self.assertEqual(response.status_code, 403)

        self.grant('avatar-guide-1')

        self.assertCountEqual(self.unread(), INITIAL_UNREAD + [{'category': 'cosmetics', 'group': 'avatars', 'item_id': 'avatar-guide-1'}])

    def test_unknown_categories_cannot_hide_owned_cosmetics(self):
        self.grant('avatar-guide-1')

        self.assertEqual(self.seen('avatar-guide-1', 'unknown').status_code, 403)
        self.assertCountEqual(self.unread(), INITIAL_UNREAD + [{'category': 'cosmetics', 'group': 'avatars', 'item_id': 'avatar-guide-1'}])

    def test_acknowledgement_requires_authentication(self):
        self.client.cookies.clear()

        self.assertEqual(self.seen('avatar-guide-1').status_code, 401)

    def test_acknowledgement_rejects_empty_requests(self):
        response = self.client.post('/api/me/unlocks/seen', json={'unlocks': []})

        self.assertEqual(response.status_code, 422)

    def test_winning_a_chapter_boss_notifies_the_next_unlocked_chapter(self):
        self.win_boss('ch1')

        chapters = [item for item in self.unread() if item['category'] == 'campaign']

        self.assertCountEqual(chapters, [
            {'category': 'campaign', 'group': 'chapters', 'item_id': 'ch1'},
            {'category': 'campaign', 'group': 'chapters', 'item_id': 'ch2'},
        ])

    def test_gate_boss_unlock_notifies_only_the_chapter_it_opens(self):
        self.win_boss('ch3', kind='gate')

        chapters = [item for item in self.unread() if item['category'] == 'campaign']

        self.assertCountEqual(chapters, [
            {'category': 'campaign', 'group': 'chapters', 'item_id': 'ch1'},
            {'category': 'campaign', 'group': 'chapters', 'item_id': 'ch3'},
        ])

    def test_reading_a_chapter_does_not_clear_cosmetic_notifications(self):
        self.win_boss('ch1')

        response = self.seen('ch2', 'campaign')

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual([item for item in self.unread() if item['category'] == 'campaign'],
                         [{'category': 'campaign', 'group': 'chapters', 'item_id': 'ch1'}])
        self.assertTrue(any(item['category'] == 'cosmetics' for item in self.unread()))
        self.assertEqual(self.seen('ch2', 'campaign').status_code, 200)

    def test_locked_chapters_cannot_be_acknowledged_before_they_unlock(self):
        self.assertEqual(self.seen('ch2', 'campaign').status_code, 403)

        self.win_boss('ch1')

        self.assertIn({'category': 'campaign', 'group': 'chapters', 'item_id': 'ch2'}, self.unread())

    def test_chapter_read_receipts_are_isolated_between_players(self):
        self.win_boss('ch1')
        self.seen('ch2', 'campaign')
        self.switch_user()
        self.win_boss('ch1')

        self.assertIn({'category': 'campaign', 'group': 'chapters', 'item_id': 'ch2'}, self.unread())

    def test_archive_notices_match_the_terms_available_in_the_archive(self):
        terms = self.client.get('/api/archive').json()['terms']

        notices = [item for item in self.unread() if item['category'] == 'archive']

        self.assertCountEqual(notices, [{'category': 'archive', 'group': 'keywords', 'item_id': term['id']} for term in terms])
        self.assertEqual({term['chapter_id'] for term in terms}, {'ch1'})

    def test_unlocking_a_chapter_adds_its_keywords_without_clearing_other_notices(self):
        before = self.unread()
        self.win_boss('ch1')

        terms = self.client.get('/api/archive').json()['terms']
        notices = self.unread()

        self.assertEqual({term['chapter_id'] for term in terms}, {'ch1', 'ch2'})
        self.assertTrue(all(item in notices for item in before))
        self.assertCountEqual([item['item_id'] for item in notices if item['category'] == 'archive'], [term['id'] for term in terms])

    def test_locked_archive_keywords_cannot_be_marked_as_seen(self):
        response = self.seen(archive_keyword_id('ch2-l1', 'Term 2.1'), 'archive')

        self.assertEqual(response.status_code, 403)

    def test_archive_acknowledgements_are_batched_and_leave_other_categories_unread(self):
        terms = self.client.get('/api/archive').json()['terms']
        keys = [{'category': 'archive', 'item_id': term['id']} for term in terms[:2]]

        response = self.client.post('/api/me/unlocks/seen', json={'unlocks': keys})

        self.assertEqual(response.status_code, 200, response.text)
        remaining = self.unread()
        self.assertCountEqual([item['item_id'] for item in remaining if item['category'] == 'archive'], [term['id'] for term in terms[2:]])
        self.assertTrue(all(item in remaining for item in INITIAL_UNREAD if item['category'] != 'archive'))

    def test_archive_read_receipts_are_isolated_between_players(self):
        term_id = self.client.get('/api/archive').json()['terms'][0]['id']
        self.assertEqual(self.seen(term_id, 'archive').status_code, 200)
        self.assertNotIn(term_id, [item['item_id'] for item in self.unread() if item['category'] == 'archive'])
        self.switch_user()

        self.assertIn(term_id, [item['item_id'] for item in self.unread() if item['category'] == 'archive'])
