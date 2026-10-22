"""Streamed CSV exports of the in-scope records under pseudonymous ids. Reflections and other free text are left out."""

from copy import deepcopy
import csv
from datetime import datetime
import io
import json

from app.db import aware
from app.study import scope
from app.study.analysis import PARTS

FORMULA_PREFIXES = ('=', '+', '-', '@', '\t', '\r')


def cell(value):
    if value is None:
        return ''
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, datetime):
        return aware(value).isoformat()
    if isinstance(value, (dict, list)):
        return json.dumps(value, sort_keys=True, separators=(',', ':'))
    if isinstance(value, str) and value.startswith(FORMULA_PREFIXES):
        return "'" + value
    return value


def line(values):
    buffer = io.StringIO()
    csv.writer(buffer, lineterminator='\n').writerow([cell(value) for value in values])
    return buffer.getvalue()


def public_payload(payload):
    """Event payload without the daily shared seed, lobby ids or reflection text (only whether one was written)."""
    value = deepcopy(payload or {})
    if isinstance(value.get('context'), dict):
        value['context'].pop('seed', None)
        value['context'].pop('lobby_id', None)
    value.pop('lobby_id', None)
    if 'reflection' in value:
        value['reflection_given'] = bool(value.pop('reflection'))
    return value


async def participants(db, policy, ids, content):
    yield line(['participant_id', 'consent_version', 'consented_at', 'onboarding_status', 'prior_knowledge_group',
                'self_reported_prior_knowledge', 'first_self_reported_prior_knowledge'])
    for person in await scope.participants(db, policy):
        yield line([ids.participant(person.user_id), person.consent_version, person.consented_at, person.onboarding, person.group,
                    person.prior_knowledge, person.first_prior_knowledge])


MATCH_COLUMNS = (['participant_id', 'match_id', 'mode', 'kind', 'chapter_id', 'level_id', 'scenario_id', 'scenario_version', 'started_at',
                  'attempt_number', 'first_attempt', 'gem_refresh_retry', 'daily_attempt', 'finished', 'forfeited', 'won', 'rank', 'of',
                  'profit', 'profit_pct', 'decision_score'] + [f'decision_{part}' for part in PARTS] + [f'decision_max_{part}' for part in PARTS]
                 + ['missions_done', 'missions_total', 'plan_strategy', 'plan_max_loss_pct', 'kept_loss_limit', 'trades', 'fees',
                    'biggest_position_pct', 'max_drawdown_pct', 'buy_hold_profit', 'metric_status'])


def match_row(ids, match):
    result = match.result or {}
    stats, review = result.get('stats') or {}, result.get('plan_review') or {}
    missions = result.get('missions') or []
    plan = match.plan or {}
    return ([ids.participant(match.user_id), ids.match(match.game_id), match.mode, match.kind, match.chapter_id, match.level_id,
             match.scenario_id, match.scenario_version, match.created_at, match.attempt, match.attempt == 1, match.gem_refresh,
             match.daily_attempt, match.finished, result.get('forfeited'), result.get('won'), result.get('rank'), result.get('of'),
             result.get('profit'), result.get('profit_pct'), result.get('decision_score')]
            + [(result.get('decision_breakdown') or {}).get(part) for part in PARTS]
            + [(result.get('decision_max') or {}).get(part) for part in PARTS]
            + [sum(bool(mission['done']) for mission in missions) if match.finished else None, len(missions) if match.finished else None,
               plan.get('strategy'), plan.get('max_loss_pct'), review.get('kept_loss_limit'), stats.get('trades'), stats.get('fees'),
               stats.get('biggest_position_pct'), stats.get('max_drawdown_pct'), stats.get('buy_hold_profit'), 'unvalidated'])


async def matches(db, policy, ids, content):
    yield line(MATCH_COLUMNS)
    async for match in scope.matches(db, policy):
        yield line(match_row(ids, match))


async def game_events(db, policy, ids, content):
    yield line(['participant_id', 'match_id', 'sequence', 'tick', 'kind', 'recorded_at', 'payload'])
    current, sequence = None, 0
    async for user_id, game_id, event in scope.events(db, policy):
        current, sequence = user_id, (sequence + 1 if user_id == current else 1)
        yield line([ids.participant(user_id), ids.match(game_id), sequence, event.tick, event.kind, event.created_at, public_payload(event.payload)])


async def check_answers(db, policy, ids, content):
    yield line(['participant_id', 'chapter_id', 'level_id', 'question_id', 'first_option_id', 'first_correct', 'solved', 'first_answered_at'])
    levels = content.campaign.levels
    async for row in scope.checks(db, policy):
        chapter = levels[row.level_id][0]['id'] if row.level_id in levels else None
        yield line([ids.participant(row.user_id), chapter, row.level_id, row.question_id, row.first_option_id, row.first_correct, row.solved,
                    row.first_answered_at])


async def quiz_answers(db, policy, ids, content):
    yield line(['participant_id', 'quiz_attempt_id', 'topic_id', 'classroom_room', 'bank_version', 'attempt_number', 'first_attempt',
                'attempt_status', 'started_at', 'completed_at', 'position', 'question_id', 'question_chapter', 'option_order', 'option_id',
                'correct', 'confidence'])
    async for quiz in scope.quizzes(db, policy):
        for position, entry in enumerate(quiz.items, 1):
            answer = quiz.answers.get(entry['question_id']) or {}
            question = content.quiz.questions.get(entry['question_id']) or {}
            yield line([ids.participant(quiz.user_id), ids.quiz(quiz.attempt_id), quiz.topic_id, quiz.in_room, quiz.bank_version, quiz.attempt,
                        quiz.attempt == 1, quiz.status, quiz.created_at, quiz.completed_at, position, entry['question_id'],
                        question.get('chapter'), entry['options'], answer.get('option_id'), answer.get('correct'), answer.get('confidence')])


async def prior_knowledge(db, policy, ids, content):
    yield line(['participant_id', 'instrument_version', 'consent_version', 'status', 'recorded_at', 'elapsed_seconds', 'experience',
                'brokerage_account', 'market_frequency', 'confidence', 'score', 'prior_knowledge_group', 'answers'])
    for person in await scope.participants(db, policy):
        row = person.response
        if row is None:
            continue
        yield line([ids.participant(person.user_id), row.instrument_version, row.consent_version, row.status, row.recorded_at,
                    row.elapsed_seconds, row.experience, row.brokerage_account, row.market_frequency, row.confidence, row.score,
                    row.prior_knowledge_group, row.answers])


EXPORTS = {'participants': participants, 'matches': matches, 'game-events': game_events, 'check-answers': check_answers,
           'quiz-answers': quiz_answers, 'prior-knowledge': prior_knowledge}
