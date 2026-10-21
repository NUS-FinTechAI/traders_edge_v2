"""Owned gameplay evidence export and separately gated study metadata."""
from copy import deepcopy
import hashlib
import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api_schemas.research_schema import (ConsentResearch, ExportKind, ResearchExport, ResearchMetadata, ResearchMetadataView,
                                             WithdrawResearchConsent)
from app.auth import current_profile
from app.campaign.models import BossResult, CampaignCheck, CampaignProgress
from app.db import Profile, aware, get_db, now
from app.game.models import Game, GameEvent, GameParticipant
from app.quiz.models import QuizAttempt
from app.research_models import ResearchCommand, ResearchParticipant

router = APIRouter(prefix='/api/me/research', tags=['owned research evidence'])
DB = Annotated[AsyncSession, Depends(get_db, scope='function')]
User = Annotated[Profile, Depends(current_profile)]
ASSESSMENT_LIMIT = 'Operational evidence and self-reported metadata are not a validated learning rubric or approved study enrollment.'

def study_policy(settings):
    version = getattr(settings, 'research_policy_version', None)
    content = getattr(settings, 'research_policy_text', None)
    available = bool(getattr(settings, 'research_enabled', False) and isinstance(version, str) and version.strip() and isinstance(content, str) and content.strip())
    return {'available': available, 'version': version if available else None, 'text': content if available else None,
            'policy_digest': hashlib.sha256(content.encode('utf-8')).hexdigest() if available else None}


def metadata_data(participant, settings):
    policy = study_policy(settings)
    return {
        'prior_knowledge': participant.prior_knowledge if participant else 'unknown',
        'first_prior_knowledge': participant.first_prior_knowledge if participant else None,
        'prior_knowledge_basis': 'self_reported_unvalidated',
        'consented': participant.consented if participant else False,
        'participation_active': bool(participant and participant.consented and policy['available'] and participant.consent_version == policy['version'] and participant.consent_text == policy['text']),
        'consent_version': participant.consent_version if participant else None,
        'consent_text': participant.consent_text if participant else None,
        'consented_at': aware(participant.consented_at).isoformat() if participant and participant.consented_at else None,
        'withdrawn_at': aware(participant.withdrawn_at).isoformat() if participant and participant.withdrawn_at else None,
        'study_policy': policy,
        'analytics_consent_is_separate': True,
        'withdrawal_effect': 'Stops study participation; existing operational records are retained. Account deletion and study retention rules require a separate approved policy.',
    }


async def mutation(db, user, body, operation, settings):
    digest = hashlib.sha256(json.dumps({'operation': operation, 'payload': body.model_dump(exclude={'idempotency_key'})}, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    command = await db.get(ResearchCommand, (user.id, body.idempotency_key))
    if command:
        if command.request_hash != digest:
            raise HTTPException(409, 'This key was already used for a different research metadata command')
        return deepcopy(command.response)
    policy = study_policy(settings)
    if operation == 'consent':
        if not policy['available']:
            raise HTTPException(409, 'Study enrollment is disabled or its approved policy is not configured')
        if body.policy_version != policy['version']:
            raise HTTPException(409, 'Accept the currently configured study policy version')
        if body.policy_digest != policy['policy_digest']:
            raise HTTPException(409, 'The study policy text changed; read and accept the current policy')
    participant = await db.scalar(select(ResearchParticipant).where(ResearchParticipant.user_id == user.id).with_for_update().execution_options(populate_existing=True))
    if participant is None:
        knowledge = body.prior_knowledge if operation == 'metadata' else 'unknown'
        participant = ResearchParticipant(user_id=user.id, first_prior_knowledge=body.prior_knowledge if operation == 'metadata' else None, prior_knowledge=knowledge, consented=False)
        db.add(participant)
    instant = now()
    if operation == 'metadata':
        participant.prior_knowledge = body.prior_knowledge
        if participant.first_prior_knowledge is None:
            participant.first_prior_knowledge = body.prior_knowledge
    elif operation == 'consent':
        if participant.consent_version == policy['version'] and participant.consent_text != policy['text']:
            raise HTTPException(409, 'Changed policy text requires a new policy version')
        if not participant.consented or participant.consent_version != policy['version']:
            participant.consented = True
            participant.consent_version = policy['version']
            participant.consent_text = policy['text']
            participant.consented_at = instant
    elif operation == 'withdrawal':
        if participant.consented:
            participant.consented = False
            participant.withdrawn_at = instant
    participant.updated_at = instant
    await db.flush()
    result = metadata_data(participant, settings)
    db.add(ResearchCommand(user_id=user.id, key=body.idempotency_key, request_hash=digest, response=deepcopy(result)))
    await db.flush()
    return result


@router.get('', response_model=ResearchMetadataView, operation_id='getResearchMetadata')
async def read_metadata(request: Request, db: DB, user: User):
    return metadata_data(await db.get(ResearchParticipant, user.id), request.app.state.settings)


@router.post('/metadata', response_model=ResearchMetadataView, operation_id='setResearchMetadata')
async def set_metadata(body: ResearchMetadata, request: Request, db: DB, user: User):
    return await mutation(db, user, body, 'metadata', request.app.state.settings)


@router.post('/consents', response_model=ResearchMetadataView, operation_id='submitResearchConsent')
async def consent(body: ConsentResearch, request: Request, db: DB, user: User):
    return await mutation(db, user, body, 'consent', request.app.state.settings)


@router.post('/withdrawals', response_model=ResearchMetadataView, operation_id='withdrawResearchConsent')
async def withdraw(body: WithdrawResearchConsent, request: Request, db: DB, user: User):
    return await mutation(db, user, body, 'withdrawal', request.app.state.settings)


def stamp(value):
    return aware(value).isoformat() if value else None


def money(value):
    return None if value is None else float(value)


def public_payload(payload):
    """The daily shared seed would reveal other players' first-attempt markets, so it never leaves the server."""
    value = deepcopy(payload)
    if isinstance(value.get('context'), dict):
        value['context'].pop('seed', None)
    return value


def event_record(event, game):
    return {'id': event.id, 'game_id': game.id, 'mode': game.mode, 'scenario_id': game.scenario_id, 'scenario_version': game.scenario_version,
            'chapter_id': game.chapter_id, 'level_id': game.level_id, 'boss': game.boss, 'tick': event.tick, 'kind': event.kind,
            'payload': public_payload(event.payload), 'created_at': stamp(event.created_at)}


def quiz_record(attempt):
    return {'id': attempt.id, 'topic_id': attempt.topic_id, 'room_id': attempt.room_id, 'bank_version': attempt.bank_version,
            'items': deepcopy(attempt.items), 'answers': deepcopy(attempt.answers), 'status': attempt.status, 'score': attempt.score,
            'total': attempt.total, 'passed': attempt.passed, 'created_at': stamp(attempt.created_at), 'completed_at': stamp(attempt.completed_at)}


async def campaign_records(db, user_id):
    levels = await db.scalars(select(CampaignProgress).where(CampaignProgress.user_id == user_id).order_by(CampaignProgress.level_id))
    bosses = await db.scalars(select(BossResult).where(BossResult.user_id == user_id).order_by(BossResult.chapter_id, BossResult.kind))
    checks = await db.scalars(select(CampaignCheck).where(CampaignCheck.user_id == user_id).order_by(CampaignCheck.level_id, CampaignCheck.question_id))
    return ([{'id': f'level:{row.level_id}', 'record': 'level', 'level_id': row.level_id, 'check_done': row.check_done,
              'check_first_try': row.check_first_try, 'check_total': row.check_total, 'normal_star': row.normal_star,
              'special_star': row.special_star, 'best_profit': money(row.best_profit), 'plays': row.plays} for row in levels]
            + [{'id': f'boss:{row.chapter_id}:{row.kind}', 'record': 'boss', 'chapter_id': row.chapter_id, 'kind': row.kind, 'won': row.won,
                'best_profit': money(row.best_profit), 'attempts': row.attempts, 'first_won_at': stamp(row.first_won_at)} for row in bosses]
            + [{'id': f'check:{row.level_id}:{row.question_id}', 'record': 'check', 'level_id': row.level_id, 'question_id': row.question_id,
                'first_option_id': row.first_option_id, 'first_correct': row.first_correct, 'solved': row.solved} for row in checks])


async def page(db, statement, model, user_filter, cursor, limit):
    if cursor:
        previous = await db.scalar(select(model).where(model.id == cursor, user_filter))
        if previous is None:
            raise HTTPException(404, 'Export cursor not found in your records')
        statement = statement.where(or_(model.created_at > previous.created_at, and_(model.created_at == previous.created_at, model.id > previous.id)))
    rows = (await db.execute(statement.order_by(model.created_at, model.id).limit(limit + 1))).all()
    return rows[:limit], len(rows) > limit


@router.get('/export/{kind}', response_model=ResearchExport, operation_id='exportResearchEvidence')
async def export(kind: ExportKind, response: Response, db: DB, user: User, cursor: str | None = Query(default=None, max_length=120),
                 limit: int = Query(default=50, ge=1, le=100)):
    next_cursor = None
    if kind == 'campaign-progress':
        records = await campaign_records(db, user.id)
    elif kind == 'game-events':
        mine = GameEvent.participant_id.in_(select(GameParticipant.id).where(GameParticipant.user_id == user.id))
        statement = select(GameEvent, Game).join(Game, Game.id == GameEvent.game_id).where(mine)
        rows, more = await page(db, statement, GameEvent, mine, cursor, limit)
        records = [event_record(event, game) for event, game in rows]
        next_cursor = rows[-1][0].id if more else None
    else:
        mine = QuizAttempt.user_id == user.id
        rows, more = await page(db, select(QuizAttempt).where(mine), QuizAttempt, mine, cursor, limit)
        records = [quiz_record(attempt) for (attempt,) in rows]
        next_cursor = rows[-1][0].id if more else None
    response.headers['Content-Disposition'] = f'attachment; filename="traders-edge-{kind}.json"'
    return {'format_version': 2, 'scope': 'your_operational_records', 'kind': kind, 'records': records, 'next_cursor': next_cursor,
            'assessment_limit': ASSESSMENT_LIMIT}
