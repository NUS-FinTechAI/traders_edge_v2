"""The researcher data scope: participants with active consent under the current policy, and only their records made
from the time of that consent onward. Attempt numbers count a participant's whole history, so a first attempt made before
consent leaves only retries in scope."""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import and_, select

from app.campaign.models import CampaignCheck
from app.db import aware
from app.game.models import Game, GameEvent, GameParticipant
from app.quiz.models import QuizAttempt
from app.research_models import PriorKnowledgeResponse, ResearchParticipant
from app.study.instrument import UNKNOWN


def active(policy):
    return and_(ResearchParticipant.consented.is_(True), ResearchParticipant.consent_version == policy['version'],
                ResearchParticipant.consent_text == policy['text'])


def within(instant, consented_at):
    return instant is not None and consented_at is not None and aware(instant) >= aware(consented_at)


@dataclass(frozen=True)
class Participant:
    user_id: str
    consent_version: str
    consented_at: datetime
    prior_knowledge: str
    first_prior_knowledge: str | None
    onboarding: str
    group: str
    response: PriorKnowledgeResponse | None


@dataclass(frozen=True)
class Match:
    user_id: str
    game_id: str
    participant_id: str
    mode: str
    kind: str
    chapter_id: str | None
    level_id: str | None
    scenario_id: str
    scenario_version: int
    created_at: datetime
    attempt: int
    gem_refresh: bool
    daily_attempt: int | None
    plan: dict | None
    result: dict | None

    @property
    def finished(self):
        return self.result is not None

    @property
    def forfeited(self):
        return bool(self.result and self.result.get('forfeited'))


@dataclass(frozen=True)
class Check:
    user_id: str
    level_id: str
    question_id: str
    first_option_id: str
    first_correct: bool
    solved: bool
    first_answered_at: datetime


@dataclass(frozen=True)
class Quiz:
    user_id: str
    attempt_id: str
    topic_id: str
    in_room: bool
    bank_version: str
    items: list
    answers: dict
    status: str
    score: int
    total: int
    passed: bool | None
    created_at: datetime
    completed_at: datetime | None
    attempt: int


async def participants(db, policy):
    rows = await db.execute(select(ResearchParticipant, PriorKnowledgeResponse)
                            .outerjoin(PriorKnowledgeResponse, PriorKnowledgeResponse.user_id == ResearchParticipant.user_id)
                            .where(active(policy)).order_by(ResearchParticipant.user_id))
    return [Participant(person.user_id, person.consent_version, person.consented_at, person.prior_knowledge, person.first_prior_knowledge,
                        response.status if response else 'pending', response.prior_knowledge_group if response else UNKNOWN, response)
            for person, response in rows.all()]


def kind_of(game):
    """preview, gate or boss (the Chapter Boss) for boss matches; otherwise the mode."""
    return {'final': 'boss'}.get(game.boss, game.boss) if game.mode == 'boss' else game.mode


def attempt_key(game):
    if game.mode == 'level':
        return 'level', game.level_id
    if game.mode == 'boss':
        return 'boss', game.chapter_id, game.boss
    if game.mode == 'daily':
        return 'daily', (game.context or {}).get('day')
    if game.mode == 'practice':
        return 'practice', game.scenario_id
    return (game.mode,)


async def numbered(rows, key, make):
    """Number each participant's rows per `key` in time order and yield `make(row, attempt)` for rows inside consent."""
    current, counts = None, {}
    async for row in rows:
        user_id, consented_at = row[-2], row[-1]
        if user_id != current:
            current, counts = user_id, {}
        attempt_id = key(row)
        counts[attempt_id] = counts.get(attempt_id, 0) + 1
        made = make(row, counts[attempt_id])
        if made is not None and within(made.created_at, consented_at):
            yield made


def _match(row, attempt):
    game, participant = row[0], row[1]
    context = game.context or {}
    return Match(participant.user_id, game.id, participant.id, game.mode, kind_of(game), game.chapter_id,
                 game.level_id, game.scenario_id, game.scenario_version, game.created_at, attempt, bool(context.get('refresh_event_key')),
                 context.get('attempt') if game.mode == 'daily' else None, participant.plan, participant.result)


async def matches(db, policy):
    """Started matches in scope, oldest first per participant, each with its attempt number for that level, boss kind,
    daily day, practice market or multiplayer mode."""
    statement = (select(Game, GameParticipant, GameParticipant.user_id, ResearchParticipant.consented_at)
                 .join(GameParticipant, GameParticipant.game_id == Game.id)
                 .join(ResearchParticipant, ResearchParticipant.user_id == GameParticipant.user_id)
                 .where(active(policy), Game.status != 'briefing').order_by(GameParticipant.user_id, Game.created_at, Game.id))
    async for match in numbered(await db.stream(statement), lambda row: attempt_key(row[0]), _match):
        yield match


async def checks(db, policy):
    """First check answers in scope; answers recorded before migration 13 have no time and stay out."""
    rows = await db.stream(select(CampaignCheck, ResearchParticipant.consented_at)
                           .join(ResearchParticipant, ResearchParticipant.user_id == CampaignCheck.user_id)
                           .where(active(policy)).order_by(CampaignCheck.user_id, CampaignCheck.level_id, CampaignCheck.question_id))
    async for row, consented_at in rows:
        if within(row.first_answered_at, consented_at):
            yield Check(row.user_id, row.level_id, row.question_id, row.first_option_id, row.first_correct, row.solved, row.first_answered_at)


def _quiz(row, attempt):
    item = row[0]
    return Quiz(item.user_id, item.id, item.topic_id, item.room_id is not None, item.bank_version, item.items, item.answers, item.status,
                item.score, item.total, item.passed, item.created_at, item.completed_at, attempt)


async def quizzes(db, policy):
    statement = (select(QuizAttempt, QuizAttempt.user_id, ResearchParticipant.consented_at)
                 .join(ResearchParticipant, ResearchParticipant.user_id == QuizAttempt.user_id)
                 .where(active(policy)).order_by(QuizAttempt.user_id, QuizAttempt.created_at, QuizAttempt.id))
    async for quiz in numbered(await db.stream(statement), lambda row: row[0].topic_id, _quiz):
        yield quiz


async def events(db, policy):
    """(user id, game id, event) for the participant's own events in matches that started inside consent."""
    rows = await db.stream(select(GameEvent, Game.id, Game.created_at, GameParticipant.user_id, ResearchParticipant.consented_at)
                           .join(GameParticipant, GameParticipant.id == GameEvent.participant_id)
                           .join(Game, Game.id == GameEvent.game_id)
                           .join(ResearchParticipant, ResearchParticipant.user_id == GameParticipant.user_id)
                           .where(active(policy), Game.status != 'briefing')
                           .order_by(GameParticipant.user_id, GameEvent.created_at, GameEvent.id))
    async for event, game_id, game_created_at, user_id, consented_at in rows:
        if within(game_created_at, consented_at):
            yield user_id, game_id, event
