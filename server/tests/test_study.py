"""Prior-knowledge onboarding, researcher authorisation, pseudonyms, the data scope, aggregates and CSV exports."""

import csv
from dataclasses import replace
from datetime import datetime, timedelta, timezone
import io
import json
import os
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import uuid

from fastapi.testclient import TestClient

from app.campaign.models import BossResult, CampaignCheck
from app.config import Settings
from app.content.bundle import load_content
from app.content.checks import ContentError
from app.db import Profile, now
from app.game.models import Game, GameEvent, GameParticipant
from app.main import create_app
from app.research_models import PriorKnowledgeResponse
from app.study import analysis
from app.study.access import is_researcher, pseudonym
from app.study.instrument import PATH, check_distinct, group_for, load_instrument, score, validate_instrument
from app.study.scope import Match
from progression_fixtures import fixture_content, use_fixture_scenarios
from test_postgres_integration import checked_url

POLICY = {'research_enabled': True, 'research_policy_version': 'study-1', 'research_policy_text': 'Approved consent text.',
          'research_pseudonym_secret': 'test-pseudonym-secret'}
BEFORE_CONSENT = datetime(2000, 1, 1, tzinfo=timezone.utc)
REFLECTION = 'MY PRIVATE REFLECTION TEXT'
DISPLAY_NAME = 'Secret Display Name'


def match_result(profit, score_value, won=False, forfeited=False, missions=(True, False), reflection=None):
    return {'won': won, 'rank': 1 if won else 2, 'of': 2, 'forfeited': forfeited, 'profit': profit, 'profit_pct': profit / 100,
            'decision_score': score_value, 'decision_breakdown': {'missions': 20, 'plan': 25, 'risk': 0, 'overtrading': 10},
            'decision_max': {'missions': 40, 'plan': 25, 'risk': 25, 'overtrading': 10}, 'leaderboard': [],
            'missions': [{'id': f'm{index}', 'tier': 'basic', 'text': 'Mission', 'done': done, 'progress': ''} for index, done in enumerate(missions)],
            'plan_review': {'strategy': 'trend', 'max_loss_pct': 5, 'worst_drawdown_pct': 2, 'kept_loss_limit': True},
            'stats': {'trades': 3, 'fees': 15.0, 'biggest_position_pct': 40, 'max_drawdown_pct': 2, 'buy_hold_profit': 10},
            'debrief': 'Fixture.', 'reflection': reflection}


def fixture_match(user, kind, attempt, profit, score_value, chapter='ch1', forfeited=False, finished=True):
    mode = 'boss' if kind in ('preview', 'boss', 'gate') else kind
    return Match(user, f'{user}-{kind}-{attempt}', f'{user}-p', mode, kind, chapter, None, 'practice-trend-rider', 1, now(), attempt, False, None,
                 None, match_result(profit, score_value, forfeited=forfeited) if finished else None)


class InstrumentTests(unittest.TestCase):
    def setUp(self):
        self.instrument = load_instrument()

    def test_shipped_instrument_has_ten_items_across_chapters_one_to_four(self):
        self.assertEqual(len(self.instrument.items), 10)
        self.assertEqual({item['chapter'] for item in self.instrument.items}, {1, 2, 3, 4})
        self.assertEqual([report['id'] for report in self.instrument.self_report],
                         ['experience', 'brokerage_account', 'market_frequency', 'confidence'])

    def test_shipped_instrument_does_not_repeat_lesson_checks_or_quiz_bank_items(self):
        content = load_content()
        check_distinct(self.instrument, content.campaign, content.quiz)

    def test_a_reused_quiz_bank_prompt_is_rejected(self):
        content = load_content()
        reused = next(iter(content.quiz.questions.values()))['prompt']
        changed = replace(self.instrument, items=(dict(self.instrument.items[0], prompt=reused), *self.instrument.items[1:]))
        with self.assertRaisesRegex(ContentError, 'repeats a lesson check or quiz bank question'):
            check_distinct(changed, content.campaign, content.quiz)

    def test_an_instrument_without_exactly_ten_items_is_rejected(self):
        data = json.loads(PATH.read_text())
        data['items'] = data['items'][:9]
        with self.assertRaisesRegex(ContentError, 'list of 10 to 10 items'):
            validate_instrument(data)

    def test_self_report_options_must_match_the_fixed_answer_codes(self):
        data = json.loads(PATH.read_text())
        data['self_report'][0]['options'][2]['id'] = 'often'
        with self.assertRaisesRegex(ContentError, 'ids must be none, some, regular'):
            validate_instrument(data)

    def test_not_sure_counts_as_not_correct(self):
        answers = {item['id']: item['answer'] for item in self.instrument.items}
        answers[self.instrument.items[0]['id']] = None
        self.assertEqual(score(self.instrument, answers), 9)

    def test_group_bands_split_at_four_and_seven_correct(self):
        self.assertEqual([group_for(value) for value in (0, 4, 5, 7, 8, 10, None)],
                         ['novice', 'novice', 'intermediate', 'intermediate', 'experienced', 'experienced', 'unknown'])


class SettingsTests(unittest.TestCase):
    def test_enabled_research_requires_a_pseudonym_secret(self):
        settings = Settings(**{**POLICY, 'research_pseudonym_secret': None})
        with self.assertRaisesRegex(ValueError, 'RESEARCH_PSEUDONYM_SECRET'):
            settings.validate()
        with self.assertRaisesRegex(ValueError, 'RESEARCH_PSEUDONYM_SECRET'):
            replace(settings, research_pseudonym_secret='   ').validate()
        Settings(**POLICY).validate()

    def test_hosted_environments_need_a_long_secret(self):
        hosted = Settings(**POLICY, environment='staging', database_url='postgresql+psycopg://u:p@db/te', allowed_origins=('https://te.example',))
        with self.assertRaisesRegex(ValueError, 'at least 32 characters'):
            hosted.validate()
        replace(hosted, research_pseudonym_secret='s' * 32).validate()

    def test_researcher_lists_are_trimmed_and_the_secret_stays_out_of_repr(self):
        environment = {'RESEARCHER_FIREBASE_UIDS': ' uid-a, ,uid-b,uid-a ', 'RESEARCHER_PROFILE_IDS': 'profile-1',
                       'RESEARCH_PSEUDONYM_SECRET': 'hidden-secret-value'}
        with patch.dict(os.environ, environment, clear=True):
            settings = Settings.from_env()
        self.assertEqual(settings.researcher_firebase_uids, ('uid-a', 'uid-b'))
        self.assertEqual(settings.researcher_profile_ids, ('profile-1',))
        self.assertNotIn('hidden-secret-value', repr(settings))


class AccessAndPseudonymTests(unittest.TestCase):
    def test_configured_firebase_uids_are_researchers_in_every_environment(self):
        profile = SimpleNamespace(id='profile-1', firebase_uid='uid-a')
        for environment in ('development', 'production'):
            self.assertTrue(is_researcher(Settings(environment=environment, researcher_firebase_uids=('uid-a',)), profile))
        self.assertFalse(is_researcher(Settings(researcher_firebase_uids=('uid-b',)), profile))

    def test_profile_ids_count_only_outside_production(self):
        profile = SimpleNamespace(id='profile-1', firebase_uid=None)
        self.assertTrue(is_researcher(Settings(environment='staging', researcher_profile_ids=('profile-1',)), profile))
        self.assertFalse(is_researcher(Settings(environment='production', researcher_profile_ids=('profile-1',)), profile))

    def test_pseudonyms_are_stable_per_secret_and_do_not_reveal_the_id(self):
        profile_id = str(uuid.uuid4())
        first = pseudonym('secret-one', 'participant', profile_id)
        self.assertEqual(first, pseudonym('secret-one', 'participant', profile_id))
        self.assertNotEqual(first, pseudonym('secret-two', 'participant', profile_id))
        self.assertNotEqual(first, pseudonym('secret-one', 'match', profile_id))
        self.assertRegex(first, r'^p_[0-9a-f]{20}$')
        self.assertNotIn(profile_id.replace('-', '')[:8], first)


class AggregationTests(unittest.TestCase):
    def setUp(self):
        self.groups = {'ana': 'novice', 'ben': 'experienced'}
        self.matches = [
            fixture_match('ana', 'preview', 1, 100, 40), fixture_match('ana', 'boss', 1, 300, 70), fixture_match('ana', 'boss', 2, 500, 90),
            fixture_match('ben', 'preview', 1, -100, 50), fixture_match('ben', 'preview', 2, 900, 30, forfeited=True),
            fixture_match('ben', 'boss', 2, 200, 80), fixture_match('ben', 'boss', 3, 0, 0, finished=False),
        ]

    def cohort(self, report, name):
        return next(item for item in report['chapters'][0]['cohorts'] if item['cohort'] == name)

    def test_pre_post_separates_first_attempts_from_all_attempts(self):
        report = analysis.pre_post(fixture_content().campaign, self.groups, self.matches)
        everyone = self.cohort(report, 'all')
        self.assertEqual(everyone['preview']['first_attempts']['mean_profit'], 0.0)
        self.assertEqual(everyone['preview']['all_attempts']['matches'], 3)
        self.assertEqual(everyone['preview']['all_attempts']['forfeited'], 1)
        self.assertEqual(everyone['preview']['all_attempts']['mean_profit'], 0.0)
        self.assertEqual(everyone['boss']['first_attempts']['matches'], 1)
        self.assertEqual(everyone['boss']['first_attempts']['mean_decision_score'], 70.0)
        self.assertEqual(everyone['boss']['all_attempts']['matches'], 3)
        self.assertEqual(everyone['boss']['all_attempts']['mean_decision_score'], 80.0)

    def test_paired_change_uses_participants_with_both_first_attempts(self):
        paired = self.cohort(analysis.pre_post(fixture_content().campaign, self.groups, self.matches), 'all')['paired_first_attempts']
        self.assertEqual(paired, {'participants': 1, 'mean_profit_change': 200.0, 'mean_decision_score_change': 30.0})

    def test_cohorts_split_by_prior_knowledge_group(self):
        report = analysis.pre_post(fixture_content().campaign, self.groups, self.matches)
        self.assertEqual(self.cohort(report, 'novice')['boss']['all_attempts']['participants'], 1)
        self.assertEqual(self.cohort(report, 'experienced')['boss']['first_attempts']['matches'], 0)
        self.assertEqual(self.cohort(report, 'unknown')['preview']['all_attempts']['matches'], 0)

    def test_decision_parts_and_missions_are_shares_of_their_maximum(self):
        summary = analysis.metric_summary([fixture_match('ana', 'boss', 1, 10, 55)])
        self.assertEqual(summary['decision_parts'], {'missions': 0.5, 'plan': 1.0, 'risk': 0.0, 'overtrading': 1.0})
        self.assertEqual(summary['mission_completion'], 0.5)

    def test_trends_pool_attempts_from_five_and_skip_forfeits(self):
        matches = [fixture_match('ana', 'level', attempt, 0, 10 * attempt) for attempt in range(1, 8)]
        matches.append(fixture_match('ben', 'level', 1, 0, 99, forfeited=True))
        series = analysis.trends(self.groups, matches)['series']
        self.assertEqual([series[0]['kind']], ['level'])
        self.assertEqual([(point['label'], point['matches'], point['mean_decision_score']) for point in series[0]['points']],
                         [('1', 1, 10.0), ('2', 1, 20.0), ('3', 1, 30.0), ('4', 1, 40.0), ('5+', 3, 60.0)])


class StudyApiTests(unittest.TestCase):
    postgres = False

    def setUp(self):
        use_fixture_scenarios(self)
        self.temp = tempfile.TemporaryDirectory()
        self.schema = None
        database_url = f'sqlite+aiosqlite:///{self.temp.name}/study.db'
        if self.postgres:
            import psycopg
            from psycopg import sql
            self.base_url = checked_url(os.environ['TRADERS_EDGE_TEST_POSTGRES_URL'])
            self.schema = 'traders_edge_qa_' + uuid.uuid4().hex
            with psycopg.connect(self.base_url.set(drivername='postgresql').render_as_string(hide_password=False), autocommit=True) as connection:
                connection.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(self.schema)))
            database_url = self.base_url.update_query_dict({'options': f'-csearch_path={self.schema}'}).render_as_string(hide_password=False)
        self.settings = Settings(database_url=database_url, **POLICY)
        self.app = create_app(self.settings, fixture_content())
        self.client = TestClient(self.app, headers={'Origin': 'http://localhost:5173'})
        self.client.__enter__()
        self.researcher_id = self.new_player()
        self.app.state.settings = replace(self.settings, researcher_profile_ids=(self.researcher_id,))
        self.researcher_cookie = self.client.cookies.get(self.settings.cookie_name)

    def tearDown(self):
        self.client.__exit__(None, None, None)
        if self.schema:
            import psycopg
            from psycopg import sql
            with psycopg.connect(self.base_url.set(drivername='postgresql').render_as_string(hide_password=False), autocommit=True) as connection:
                connection.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(self.schema)))
        self.temp.cleanup()

    def new_player(self):
        self.client.cookies.clear()
        return self.client.post('/api/session').json()['profile_id']

    def as_researcher(self):
        self.client.cookies.clear()
        self.client.cookies.set(self.settings.cookie_name, self.researcher_cookie)

    def consent(self):
        policy = self.client.get('/api/me/research').json()['study_policy']
        response = self.client.post('/api/me/research/consents', json={'idempotency_key': f'consent-{uuid.uuid4().hex[:12]}', 'accepted': True,
                                                                         'policy_version': policy['version'], 'policy_digest': policy['policy_digest']})
        assert response.status_code == 200, response.text

    def participant(self, consent=True):
        user_id = self.new_player()
        if consent:
            self.consent()
        return user_id

    def submission(self, key='submit-key-1', correct=10, **changes):
        instrument = fixture_content().instrument
        answers = [{'item_id': item['id'], 'option_id': item['answer'] if index < correct else None}
                   for index, item in enumerate(instrument.items)]
        body = {'idempotency_key': key, 'instrument_version': instrument.version, 'answers': answers, 'elapsed_seconds': 95,
                'self_report': {'experience': 'regular', 'brokerage_account': True, 'market_frequency': 'weekly', 'confidence': 4}}
        return {**body, **changes}

    def run_db(self, function):
        async def apply():
            async with self.app.state.db.sessions.begin() as db:
                return await function(db)
        return self.client.portal.call(apply)

    def add_game(self, user_id, game_id, kind, created_at, result, chapter='ch1', mode='boss', context=None, events=()):
        async def insert(db):
            db.add(Game(id=game_id, mode=mode, scenario_id='practice-trend-rider', scenario_version=1, seed=4242, status='settled', clock={},
                        context=context or {}, host_user_id=user_id, chapter_id=chapter, boss=kind if mode == 'boss' else None,
                        created_at=created_at))
            await db.flush()
            db.add(GameParticipant(id=game_id + '-me', game_id=game_id, user_id=user_id, display_name=DISPLAY_NAME, forfeited=False,
                                   plan={'strategy': 'trend', 'max_loss_pct': 5}, result=result))
            await db.flush()
            for index, (event_kind, payload) in enumerate(events):
                db.add(GameEvent(id=f'{game_id}-event-{index}', game_id=game_id, participant_id=game_id + '-me', tick=index, kind=event_kind,
                                 payload=payload, created_at=created_at + timedelta(seconds=index)))
        self.run_db(insert)

    def export(self, kind):
        response = self.client.get(f'/api/research/exports/{kind}')
        self.assertEqual(response.status_code, 200, response.text)
        return response, list(csv.DictReader(io.StringIO(response.text)))

    # Consent gating

    def test_disabled_research_offers_no_onboarding_and_refuses_answers(self):
        self.app.state.settings = Settings(database_url=self.settings.database_url)
        self.participant(consent=False)

        view = self.client.get('/api/me/research/onboarding').json()
        submitted = self.client.post('/api/me/research/onboarding/responses', json=self.submission())

        self.assertEqual(view, {'due': False, 'status': 'unavailable', 'instrument': None})
        self.assertEqual(submitted.status_code, 403)

    def test_players_without_consent_get_no_onboarding_and_store_nothing(self):
        user_id = self.participant(consent=False)

        view = self.client.get('/api/me/research/onboarding').json()
        submitted = self.client.post('/api/me/research/onboarding/responses', json=self.submission())
        skipped = self.client.post('/api/me/research/onboarding/skips', json={'idempotency_key': 'skip-key-1', 'instrument_version': 'x'})

        self.assertFalse(view['due'])
        self.assertIsNone(view['instrument'])
        self.assertEqual([submitted.status_code, skipped.status_code], [403, 403])
        self.assertIsNone(self.run_db(lambda db: db.get(PriorKnowledgeResponse, user_id)))

    def test_withdrawn_participants_are_no_longer_offered_the_onboarding(self):
        self.participant()
        self.client.post('/api/me/research/withdrawals', json={'idempotency_key': 'withdraw-key-1'})

        self.assertEqual(self.client.get('/api/me/research/onboarding').json()['status'], 'unavailable')

    # Survey storage, versioning and skip

    def test_consented_participant_sees_the_instrument_without_answer_keys(self):
        self.participant()

        view = self.client.get('/api/me/research/onboarding').json()

        self.assertTrue(view['due'])
        self.assertEqual(view['status'], 'pending')
        self.assertEqual(len(view['instrument']['items']), 10)
        self.assertTrue(all(set(item) == {'id', 'kind', 'prompt', 'options'} for item in view['instrument']['items']))

    def test_submission_stores_versioned_answers_score_and_group_without_revealing_them(self):
        user_id = self.participant()

        response = self.client.post('/api/me/research/onboarding/responses', json=self.submission(correct=6))
        row = self.run_db(lambda db: db.get(PriorKnowledgeResponse, user_id))

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {'due': False, 'status': 'completed', 'instrument': None})
        self.assertEqual((row.instrument_version, row.consent_version, row.status), (fixture_content().instrument.version, 'study-1', 'completed'))
        self.assertEqual((row.score, row.prior_knowledge_group, row.elapsed_seconds), (6, 'intermediate', 95))
        self.assertEqual((row.experience, row.brokerage_account, row.market_frequency, row.confidence), ('regular', True, 'weekly', 4))
        self.assertEqual([answer['correct'] for answer in row.answers], [True] * 6 + [False] * 4)
        self.assertIsNotNone(row.recorded_at)

    def test_submission_writes_self_reported_experience_into_the_study_metadata(self):
        self.participant()
        self.client.post('/api/me/research/onboarding/responses', json=self.submission())

        metadata = self.client.get('/api/me/research').json()

        self.assertEqual((metadata['prior_knowledge'], metadata['first_prior_knowledge']), ('experienced', 'experienced'))

    def test_answers_are_recorded_once_and_replay_by_key(self):
        self.participant()
        first = self.client.post('/api/me/research/onboarding/responses', json=self.submission())

        replayed = self.client.post('/api/me/research/onboarding/responses', json=self.submission())
        again = self.client.post('/api/me/research/onboarding/responses', json=self.submission(key='submit-key-2'))
        skip = self.client.post('/api/me/research/onboarding/skips',
                                json={'idempotency_key': 'skip-key-2', 'instrument_version': fixture_content().instrument.version})

        self.assertEqual(replayed.json(), first.json())
        self.assertEqual([again.status_code, skip.status_code], [409, 409])

    def test_a_stale_instrument_version_or_incomplete_answers_are_refused(self):
        self.participant()
        body = self.submission()

        stale = self.client.post('/api/me/research/onboarding/responses', json={**body, 'instrument_version': 'old'})
        missing = self.client.post('/api/me/research/onboarding/responses', json={**body, 'idempotency_key': 'missing-1',
                                                                                    'answers': body['answers'][:9]})
        unknown = self.client.post('/api/me/research/onboarding/responses', json={
            **body, 'idempotency_key': 'unknown-1', 'answers': [{**body['answers'][0], 'option_id': 'z'}, *body['answers'][1:]]})

        self.assertEqual([stale.status_code, missing.status_code, unknown.status_code], [409, 422, 422])
        self.assertTrue(self.client.get('/api/me/research/onboarding').json()['due'])

    def test_skipping_is_recorded_with_an_unknown_group(self):
        user_id = self.participant()

        response = self.client.post('/api/me/research/onboarding/skips',
                                    json={'idempotency_key': 'skip-key-3', 'instrument_version': fixture_content().instrument.version})
        row = self.run_db(lambda db: db.get(PriorKnowledgeResponse, user_id))

        self.assertEqual(response.json()['status'], 'skipped')
        self.assertEqual((row.status, row.score, row.prior_knowledge_group, row.answers), ('skipped', None, 'unknown', []))

    # Researcher authorisation

    def test_normal_players_are_refused_every_researcher_endpoint(self):
        self.participant()
        paths = ['/api/research/summary', '/api/research/pre-post', '/api/research/decision-trends', '/api/research/checks',
                 '/api/research/quizzes', '/api/research/exports/participants']

        self.assertEqual(self.client.get('/api/research/access').json(), {'allowed': False})
        self.assertEqual([self.client.get(path).status_code for path in paths], [403] * len(paths))

    def test_configured_researcher_profile_is_allowed(self):
        self.as_researcher()

        self.assertEqual(self.client.get('/api/research/access').json(), {'allowed': True})
        self.assertEqual(self.client.get('/api/research/summary').status_code, 200)

    def test_production_ignores_the_researcher_profile_list(self):
        self.app.state.settings = replace(self.app.state.settings, environment='production')
        self.app.state.content = replace(fixture_content(), review_status='approved')
        self.as_researcher()

        self.assertEqual(self.client.get('/api/research/access').json(), {'allowed': False})
        self.assertEqual(self.client.get('/api/research/summary').status_code, 403)

    def test_researchers_get_nothing_while_research_is_disabled(self):
        self.app.state.settings = Settings(database_url=self.settings.database_url, researcher_profile_ids=(self.researcher_id,))
        self.as_researcher()

        self.assertEqual(self.client.get('/api/research/access').json(), {'allowed': False})
        self.assertEqual(self.client.get('/api/research/summary').status_code, 409)

    # Scope and aggregates

    def test_scope_keeps_consented_records_from_consent_onward_with_whole_history_attempt_numbers(self):
        ana = self.participant()
        self.client.post('/api/me/research/onboarding/responses', json=self.submission(correct=2))
        self.participant()
        outsider = self.new_player()
        later = now() + timedelta(minutes=1)
        self.add_game(ana, 'ana-preview-old', 'preview', BEFORE_CONSENT, match_result(-50, 10))
        self.add_game(ana, 'ana-preview-new', 'preview', later, match_result(150, 60))
        self.add_game(ana, 'ana-boss', 'final', later + timedelta(minutes=1), match_result(250, 80, won=True))
        self.add_game(outsider, 'outsider-boss', 'final', later, match_result(999, 99, won=True))
        self.as_researcher()

        summary = self.client.get('/api/research/summary').json()
        chapter = self.client.get('/api/research/pre-post').json()['chapters'][0]
        novice = next(item for item in chapter['cohorts'] if item['cohort'] == 'novice')

        self.assertEqual(summary['participants'], 2)
        self.assertEqual(summary['onboarding'], {'completed': 1, 'skipped': 0, 'pending': 1})
        self.assertEqual({row['group']: row['participants'] for row in summary['groups']},
                         {'novice': 1, 'intermediate': 0, 'experienced': 0, 'unknown': 1})
        self.assertEqual(summary['total_matches'], 2)
        self.assertEqual({step['step']: step['participants'] for step in summary['funnel'][0]['steps']}['boss-won'], 1)
        self.assertEqual(novice['preview']['first_attempts']['matches'], 0)
        self.assertEqual(novice['preview']['all_attempts']['mean_profit'], 150.0)
        self.assertEqual(novice['boss']['first_attempts']['mean_profit'], 250.0)
        self.assertEqual(novice['paired_first_attempts']['participants'], 0)

    def test_check_answers_count_only_when_answered_after_consent(self):
        user_id = self.participant()
        self.run_db(lambda db: _add(db, BossResult(user_id=user_id, chapter_id='ch1', kind='preview', won=True, attempts=1)))
        self.client.post('/api/campaign/levels/ch1-l1/check', json={'question_id': 'q1', 'option_id': 'b'})
        self.client.post('/api/campaign/levels/ch1-l1/check', json={'question_id': 'q1', 'option_id': 'a'})
        self.run_db(lambda db: _add(db, CampaignCheck(user_id=user_id, level_id='ch1-l1', question_id='q2', first_option_id='f',
                                                      first_correct=True, solved=True, run_solved=False, first_answered_at=None)))
        self.as_researcher()

        level = self.client.get('/api/research/checks', params={'chapter_id': 'ch1'}).json()['levels'][0]

        self.assertEqual((level['level_id'], level['answers'], level['first_try_correct'], level['accuracy']), ('ch1-l1', 1, 0, 0.0))

    def test_quiz_performance_separates_first_attempts(self):
        self.participant()
        for _ in range(2):
            attempt = self.client.post('/api/quizzes/attempts', json={'topic_id': 'chapter-1'}).json()
            for question in attempt['questions']:
                self.client.post(f'/api/quizzes/attempts/{attempt["id"]}/answers',
                                 json={'question_id': question['id'], 'option_id': question['options'][0]['id']})
        self.as_researcher()

        chapter = self.client.get('/api/research/quizzes').json()['chapters'][0]

        self.assertEqual((chapter['first_attempts']['attempts'], chapter['all_attempts']['attempts']), (1, 2))
        self.assertEqual(chapter['answers'], 20)

    # CSV exports

    def test_exports_use_pseudonyms_and_leave_out_identity_reflections_and_seeds(self):
        ana = self.participant()
        self.client.post('/api/me/research/onboarding/responses', json=self.submission(correct=9))
        attempt = self.client.post('/api/quizzes/attempts', json={'topic_id': 'chapter-1'}).json()
        question = attempt['questions'][0]
        self.client.post(f'/api/quizzes/attempts/{attempt["id"]}/answers', json={'question_id': question['id'],
                                                                                'option_id': question['options'][0]['id'], 'confidence': 'sure'})
        later = now() + timedelta(minutes=1)
        events = [('start', {'plan': {'strategy': 'trend'}, 'attempt': 1, 'context': {'day': '2026-10-19', 'seed': 987654321}}),
                  ('finish', {'reflection': REFLECTION, 'profit': 12.5}), ('reflection', {'reflection': REFLECTION})]
        self.add_game(ana, 'ana-daily', None, later, match_result(12.5, 44, reflection=REFLECTION), chapter=None, mode='daily',
                      context={'day': '2026-10-19', 'attempt': 2, 'refresh_event_key': 'daily-refresh:x', 'seed': 987654321}, events=events)
        self.run_db(lambda db: _rename(db, ana))
        self.as_researcher()

        exports = {kind: self.export(kind) for kind in ('participants', 'matches', 'game-events', 'check-answers', 'quiz-answers',
                                                         'prior-knowledge')}
        text = ''.join(response.text for response, _ in exports.values())
        expected = pseudonym(POLICY['research_pseudonym_secret'], 'participant', ana)

        self.assertEqual({rows[0]['participant_id'] for kind, (_, rows) in exports.items() if rows}, {expected})
        for secret in (ana, DISPLAY_NAME, REFLECTION, '987654321', 'ana-daily', attempt['id'], self.researcher_id, 'firebase-uid-of-ana'):
            self.assertNotIn(secret, text)
        match = exports['matches'][1][0]
        self.assertEqual((match['mode'], match['attempt_number'], match['first_attempt'], match['gem_refresh_retry'], match['daily_attempt']),
                         ('daily', '1', 'true', 'true', '2'))
        self.assertEqual(match['metric_status'], 'unvalidated')
        events_rows = exports['game-events'][1]
        self.assertEqual([row['kind'] for row in events_rows], ['start', 'finish', 'reflection'])
        self.assertEqual(json.loads(events_rows[1]['payload']), {'profit': 12.5, 'reflection_given': True})
        self.assertEqual(exports['prior-knowledge'][1][0]['prior_knowledge_group'], 'experienced')
        self.assertEqual(exports['quiz-answers'][1][0]['confidence'], 'sure')
        self.assertEqual(exports['participants'][0].headers['content-type'], 'text/csv; charset=utf-8')
        self.assertIn('attachment;', exports['participants'][0].headers['content-disposition'])

    def test_exports_hold_only_consented_participants(self):
        self.participant(consent=False)
        self.as_researcher()

        _, rows = self.export('participants')
        response, matches = self.export('matches')

        self.assertEqual(rows, [])
        self.assertEqual(matches, [])
        self.assertTrue(response.text.startswith('participant_id,match_id,mode,'))


async def _add(db, row):
    db.add(row)


async def _rename(db, user_id):
    profile = await db.get(Profile, user_id)
    profile.display_name, profile.firebase_uid = DISPLAY_NAME, 'firebase-uid-of-ana'


@unittest.skipUnless(os.getenv('TRADERS_EDGE_TEST_POSTGRES_URL'), 'Disposable PostgreSQL test URL not configured')
class StudyApiPostgreSQLTests(StudyApiTests):
    postgres = True


if __name__ == '__main__':
    unittest.main()
