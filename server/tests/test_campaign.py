import json
import unittest
from unittest.mock import patch

from sqlalchemy import func, select

from app.campaign.content import validate_campaign, validate_chapter
from app.campaign.models import CampaignProgress
from app.content.checks import ContentError
from app.db import RewardGrant, XPLedger
from app.economy_models import EconomyEvent
from progression_fixtures import CAMPAIGN, AppCase, fixture_content, result


def nodes(client, chapter_id):
    return {node['id']: node for node in client.get(f'/api/campaign/chapters/{chapter_id}').json()['nodes']}


class CampaignContentTests(unittest.TestCase):
    def chapter(self, number=1):
        return json.loads((CAMPAIGN / f'ch{number}.json').read_text())

    def load(self, data):
        content = fixture_content()
        return validate_chapter(data, {'practice-trend-rider', 'practice-choppy-range'}, content.cosmetics, 'ch.json')

    def test_fixture_campaign_is_sorted_by_chapter_number(self):
        content = fixture_content()

        self.assertEqual([chapter['id'] for chapter in content.campaign.chapters], ['ch1', 'ch2', 'ch3'])
        self.assertEqual(content.campaign.number_of('ch2-l4'), 4)

    def test_validator_rejects_broken_chapters(self):
        cases = {
            'four levels': lambda data: data['levels'].pop(),
            'answer outside options': lambda data: data['levels'][0]['check'][0].update(answer='z'),
            'unknown scenario': lambda data: data['levels'][0].update(practice='missing-scenario'),
            'unknown reward': lambda data: data['levels'][2].update(reward={'kind': 'avatar', 'id': 'avatar-missing'}),
            'reward kind mismatch': lambda data: data.update(boss_reward={'kind': 'title', 'id': 'avatar-guide-1'}),
            'gate on chapter one': lambda data: data.update(gate='practice-choppy-range'),
            'unknown field': lambda data: data.update(extra=True),
        }
        for name, change in cases.items():
            with self.subTest(name), self.assertRaises(ContentError):
                data = self.chapter()
                change(data)
                self.load(data)

    def test_campaign_rejects_duplicate_ids_and_gaps(self):
        first, second = self.load(self.chapter(1)), self.load(self.chapter(2))
        third = self.load(self.chapter(3))

        with self.assertRaises(ContentError):
            validate_campaign([first, third])
        with self.assertRaises(ContentError):
            validate_campaign([first, {**second, 'id': 'ch1'}])


class CampaignTests(AppCase):
    def test_signed_out_visitor_sees_chapter_one_open_and_nothing_earned(self):
        self.client.cookies.clear()

        campaign = self.client.get('/api/campaign').json()
        archive = self.client.get('/api/archive').json()

        self.assertEqual([chapter['state'] for chapter in campaign['chapters']], ['open', 'locked', 'locked'])
        self.assertEqual(campaign['chapters'][0]['unlocked_by'], 'start')
        self.assertEqual(sum(chapter['stars'] for chapter in campaign['chapters']), 0)
        self.assertEqual(campaign['chapters'][0]['stars_total'], 12)
        self.assertEqual(campaign['next']['node_id'], 'ch1-preview')
        self.assertEqual(campaign['chapters'][1]['gate'], {'scenario_id': 'practice-choppy-range', 'won': False, 'attempts': 0})
        self.assertEqual({term['chapter_id'] for term in archive['terms']}, {'ch1'})
        self.assertEqual(self.client.get('/api/campaign/levels/ch2-l1').status_code, 403)

    def test_level_one_opens_only_after_the_preview_is_played(self):
        before = nodes(self.client, 'ch1')
        self.play_preview('ch1')
        after = nodes(self.client, 'ch1')

        self.assertEqual((before['ch1-preview']['state'], before['ch1-l1']['state']), ('open', 'locked'))
        self.assertEqual(before['ch1-l1']['locked_reason'], 'Play the Preview Battle first')
        self.assertEqual((after['ch1-preview']['state'], after['ch1-l1']['state'], after['ch1-l2']['state']), ('done', 'open', 'locked'))
        self.assertEqual(after['ch1-l2']['locked_reason'], 'Finish Level 1 first')

    def test_levels_open_in_order_then_the_boss_and_reward_nodes_complete(self):
        self.play_preview('ch1')
        for number in range(1, 5):
            self.star_level(f'ch1-l{number}')
        partial = nodes(self.client, 'ch1')
        self.star_level('ch1-l5')
        full = nodes(self.client, 'ch1')

        self.assertEqual(partial['ch1-l5']['state'], 'open')
        self.assertEqual(partial['ch1-boss']['state'], 'locked')
        self.assertEqual(partial['ch1-l3-reward']['state'], 'done')
        self.assertEqual(partial['ch1-l3-reward']['reward'], {'kind': 'avatar', 'id': 'avatar-ch1-explorer', 'name': 'Explorer Parrot'})
        self.assertEqual(full['ch1-boss']['state'], 'open')
        self.assertEqual(list(full)[:5], ['ch1-preview', 'ch1-l1', 'ch1-l2', 'ch1-l3', 'ch1-l3-reward'])

    def test_winning_the_boss_unlocks_the_next_chapter_once(self):
        settled = self.complete_chapter('ch1')
        again = self.win_boss('ch1', game_id='second-win')
        campaign = self.client.get('/api/campaign').json()

        self.assertEqual(settled['unlocked'], {'chapter_id': 'ch2'})
        self.assertIsNone(again['unlocked'])
        self.assertEqual([chapter['state'] for chapter in campaign['chapters']], ['complete', 'open', 'locked'])
        self.assertEqual(campaign['chapters'][1]['unlocked_by'], 'boss')
        self.assertEqual(campaign['next']['node_id'], 'ch2-preview')
        self.assertIn({'id': 'avatar-guide-1', 'kind': 'avatar', 'name': 'Harbor Guide'}, settled['rewards']['items'])

    def test_gate_win_skips_ahead_without_marking_earlier_chapters(self):
        settled = self.win_boss('ch3', kind='gate')
        campaign = self.client.get('/api/campaign').json()

        self.assertEqual(settled['unlocked'], {'chapter_id': 'ch3'})
        self.assertEqual(settled['rewards']['xp'], 50)
        self.assertEqual([chapter['state'] for chapter in campaign['chapters']], ['open', 'locked', 'open'])
        self.assertEqual(campaign['chapters'][2]['unlocked_by'], 'gate')
        self.assertEqual(campaign['chapters'][2]['gate']['won'], True)
        self.assertEqual(nodes(self.client, 'ch3')['ch3-preview']['state'], 'open')
        self.assertIn('badge-gatecrasher', [badge['id'] for badge in settled['rewards']['badges']])

    def test_lost_gate_records_an_attempt_and_unlocks_nothing(self):
        settled = self.settle('boss', result(won=False), chapter_id='ch2', boss='gate')

        self.assertIsNone(settled['unlocked'])
        self.assertEqual(self.client.get('/api/campaign').json()['chapters'][1]['gate']['attempts'], 1)

    def test_check_counts_first_answers_and_allows_retries(self):
        self.play_preview('ch1')
        wrong = self.client.post('/api/campaign/levels/ch1-l1/check', json={'question_id': 'q1', 'option_id': 'b'}).json()
        retry = self.client.post('/api/campaign/levels/ch1-l1/check', json={'question_id': 'q1', 'option_id': 'a'}).json()
        self.client.post('/api/campaign/levels/ch1-l1/check', json={'question_id': 'q2', 'option_id': 'f'})
        completed = self.client.post('/api/campaign/levels/ch1-l1/check/complete').json()
        repeated = self.client.post('/api/campaign/levels/ch1-l1/check/complete').json()
        level = self.client.get('/api/campaign/levels/ch1-l1').json()

        self.assertEqual(wrong, {'correct': False, 'correct_option_id': 'a', 'explanation': 'A is right.', 'first_try': True})
        self.assertEqual((retry['correct'], retry['first_try']), (True, False))
        self.assertEqual(completed, {'first_try_correct': 1, 'total': 2, 'xp': 10, 'practice_unlocked': True})
        self.assertEqual(repeated['xp'], 0)
        self.assertEqual(level['progress'], {'check_done': True, 'check_best': 1, 'normal_star': False, 'special_star': False, 'plays': 0})
        self.assertNotIn('answer', level['check'][0])

    def test_check_completion_requires_every_question_solved(self):
        self.play_preview('ch1')
        self.client.post('/api/campaign/levels/ch1-l1/check', json={'question_id': 'q1', 'option_id': 'b'})
        self.client.post('/api/campaign/levels/ch1-l1/check', json={'question_id': 'q2', 'option_id': 'f'})

        response = self.client.post('/api/campaign/levels/ch1-l1/check/complete')

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['detail'], 'Answer every question correctly before finishing the check')

    def test_check_rejects_locked_levels_and_unknown_answers(self):
        locked = self.client.post('/api/campaign/levels/ch1-l1/check', json={'question_id': 'q1', 'option_id': 'a'})
        self.play_preview('ch1')
        unknown_question = self.client.post('/api/campaign/levels/ch1-l1/check', json={'question_id': 'q9', 'option_id': 'a'})
        unknown_option = self.client.post('/api/campaign/levels/ch1-l1/check', json={'question_id': 'q1', 'option_id': 'z'})

        self.assertEqual((locked.status_code, locked.json()['detail']), (403, 'Play the Preview Battle first'))
        self.assertEqual(unknown_question.status_code, 404)
        self.assertEqual(unknown_option.status_code, 422)

    def test_stars_are_never_revoked_and_star_xp_is_paid_once(self):
        self.play_preview('ch1')
        self.pass_check('ch1-l1')
        first = self.settle('level', result(basic=True, bonus=True, profit=50), level_id='ch1-l1', game_id='play-1')
        worse = self.settle('level', result(basic=False, bonus=False, profit=-20), level_id='ch1-l1', game_id='play-2')
        level = self.client.get('/api/campaign/levels/ch1-l1').json()

        self.assertEqual(first['stars'], {'normal': True, 'special': True})
        self.assertEqual(first['rewards']['xp'], 30)
        self.assertEqual(worse['stars'], {'normal': True, 'special': True})
        self.assertEqual(worse['rewards']['xp'], 0)
        self.assertEqual((level['progress']['plays'], level['progress']['normal_star']), (2, True))
        self.assertEqual(nodes(self.client, 'ch1')['ch1-l1']['best_profit'], 50.0)

    def test_settlement_is_idempotent_per_game_and_player(self):
        self.play_preview('ch1')
        self.pass_check('ch1-l1')
        first = self.settle('level', result(), level_id='ch1-l1', game_id='same-game')
        second = self.settle('level', result(), level_id='ch1-l1', game_id='same-game')

        async def read(db):
            row = await db.get(CampaignProgress, (self.user_id, 'ch1-l1'))
            xp = await db.scalar(select(func.sum(XPLedger.amount)).where(XPLedger.user_id == self.user_id))
            return row.plays, xp
        self.assertEqual(first, second)
        self.assertEqual(self.run_db(read), (1, 10 + 10 + 20))

    def test_boss_special_star_grants_the_boss_title(self):
        settled = self.complete_chapter('ch1', bonus=True)
        chapter = self.client.get('/api/campaign').json()['chapters'][0]

        self.assertEqual(settled['stars'], {'normal': True, 'special': True})
        self.assertIn({'id': 'title-steady-hand', 'kind': 'title', 'name': 'Steady Hand'}, settled['rewards']['items'])
        self.assertEqual(chapter['stars'], 12)
        self.assertIn('badge-explorer', [badge['id'] for badge in settled['rewards']['badges']])

    def test_preview_xp_is_paid_on_the_first_play_only(self):
        first = self.play_preview('ch1')
        second = self.settle('boss', result(), chapter_id='ch1', boss='preview', game_id='preview-2')

        self.assertEqual((first['rewards']['xp'], second['rewards']['xp']), (10, 0))
        self.assertEqual(nodes(self.client, 'ch1')['ch1-preview']['attempts'], 2)

    def test_practice_xp_stops_after_three_matches_a_day(self):
        awarded = [self.settle('practice', result(), game_id=f'practice-{n}')['rewards']['xp'] for n in range(4)]
        forfeited = self.settle('practice', result(forfeited=True), game_id='practice-forfeit')['rewards']['xp']

        self.assertEqual(awarded, [10, 10, 10, 0])
        self.assertEqual(forfeited, 0)

    def test_private_lobby_games_award_nothing(self):
        settled = self.settle('private', result(won=True, profit=500))

        async def counts(db):
            return (await db.scalar(select(func.count()).select_from(XPLedger)),
                    await db.scalar(select(func.count()).select_from(RewardGrant)),
                    await db.scalar(select(func.count()).select_from(EconomyEvent).where(EconomyEvent.event_key != 'game:game-1')))
        self.assertEqual(settled, {'rewards': {'xp': 0, 'stocks': 0, 'gems': 0, 'items': [], 'badges': []}, 'stars': None, 'unlocked': None})
        self.assertEqual(self.run_db(counts), (0, 0, 0))

    def test_bosses_and_practice_lists_for_the_play_hub(self):
        bosses = self.client.get('/api/bosses').json()['bosses']
        practice = self.client.get('/api/practice').json()['scenarios']

        self.assertEqual([(b['chapter_id'], b['kind'], b['state']) for b in bosses],
                         [('ch1', 'boss', 'locked'), ('ch2', 'gate', 'open'), ('ch2', 'boss', 'locked'), ('ch3', 'gate', 'open'), ('ch3', 'boss', 'locked')])
        self.assertEqual([item['id'] for item in practice], ['practice-choppy-range', 'practice-earnings-gap', 'practice-trend-rider'])
        self.assertEqual(practice[0]['bots'][0]['name'], 'Value Vera')


class CampaignGameTests(AppCase):
    def create(self, **body):
        return self.client.post('/api/games', json=body)

    def test_level_practice_needs_an_open_level_and_a_finished_check(self):
        locked = self.create(mode='level', level_id='ch1-l1')
        self.play_preview('ch1')
        unchecked = self.create(mode='level', level_id='ch1-l1')
        self.pass_check('ch1-l1')
        created = self.create(mode='level', level_id='ch1-l1')

        self.assertEqual(locked.status_code, 403)
        self.assertEqual(unchecked.json()['detail'], 'Finish the level check before the practice mission')
        self.assertEqual(created.status_code, 201, created.text)
        self.assertEqual((created.json()['mode'], created.json()['scenario']['id']), ('level', 'practice-trend-rider'))

    def test_boss_modes_follow_unlock_rules(self):
        final = self.create(mode='boss', chapter_id='ch1', boss='final')
        preview = self.create(mode='boss', chapter_id='ch1', boss='preview')
        locked_preview = self.create(mode='boss', chapter_id='ch2', boss='preview')
        gate = self.create(mode='boss', chapter_id='ch3', boss='gate')
        no_gate = self.create(mode='boss', chapter_id='ch1', boss='gate')

        self.assertEqual((final.status_code, final.json()['detail']), (403, 'Earn the normal star on every level first'))
        self.assertEqual(preview.status_code, 201, preview.text)
        self.assertEqual(locked_preview.status_code, 403)
        self.assertEqual((gate.status_code, gate.json()['scenario']['id']), (201, 'practice-choppy-range'))
        self.assertEqual(no_gate.status_code, 403)

    def test_practice_uses_the_requested_number_of_scenario_bots(self):
        one = self.create(mode='practice', scenario_id='practice-choppy-range', bots=1).json()
        capped = self.create(mode='practice', scenario_id='practice-choppy-range', bots=7).json()
        missing = self.create(mode='practice', scenario_id='mp-unknown')

        self.assertEqual([entry['bot_id'] for entry in one['leaderboard'] if entry['kind'] == 'bot'], ['value-vera-rookie'])
        self.assertEqual(len([entry for entry in capped['leaderboard'] if entry['kind'] == 'bot']), 3)
        self.assertEqual(missing.status_code, 404)

    def test_finished_preview_match_settles_through_the_real_engine(self):
        clock = {'ms': 1_800_000_000_000}
        with patch('app.game.clock.now_ms', side_effect=lambda: clock['ms']):
            game = self.create(mode='boss', chapter_id='ch1', boss='preview').json()
            self.client.post(f'/api/games/{game["id"]}/start', json={'plan': {'strategy': 'trend', 'max_loss_pct': 10}})
            clock['ms'] += 100 * 2000
            finished = self.client.post(f'/api/games/{game["id"]}/finish', json={})
            repeat = self.client.post(f'/api/games/{game["id"]}/finish', json={})

        self.assertEqual(finished.status_code, 200, finished.text)
        self.assertEqual(finished.json()['rewards']['xp'], 10)
        self.assertEqual(repeat.json(), finished.json())
        self.assertEqual(nodes(self.client, 'ch1')['ch1-l1']['state'], 'open')
