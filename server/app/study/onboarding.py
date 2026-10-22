"""The one-time prior-knowledge onboarding, offered only to participants with active consent under the current policy."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api_schemas.study_schema import OnboardingView, SkipPriorKnowledge, SubmitPriorKnowledge
from app.auth import current_profile
from app.content.bundle import require_approved_content
from app.db import Profile, get_db, now
from app.research import participation_active, replay, store_receipt, study_policy
from app.research_models import PriorKnowledgeResponse, ResearchParticipant
from app.study.instrument import UNKNOWN, group_for, score

router = APIRouter(prefix='/api/me/research/onboarding', tags=['owned research evidence'], dependencies=[Depends(require_approved_content)])
DB = Annotated[AsyncSession, Depends(get_db, scope='function')]
User = Annotated[Profile, Depends(current_profile)]
# The self-reported experience item also updates the study metadata field in its existing vocabulary.
EXPERIENCE_METADATA = {'none': 'none', 'some': 'some', 'regular': 'experienced'}
NOT_PARTICIPATING = 'The prior-knowledge questions are only for study participants who consented under the current policy'


def public_instrument(instrument):
    return {'version': instrument.version,
            'self_report': [{'id': report['id'], 'prompt': report['prompt'], 'options': report['options']} for report in instrument.self_report],
            'items': [{'id': item['id'], 'kind': item['kind'], 'prompt': item['prompt'], 'options': item['options']} for item in instrument.items]}


async def onboarding_view(db, user_id, settings, instrument):
    recorded = await db.get(PriorKnowledgeResponse, user_id)
    if recorded is not None:
        return {'due': False, 'status': recorded.status, 'instrument': None}
    if not participation_active(await db.get(ResearchParticipant, user_id), study_policy(settings)):
        return {'due': False, 'status': 'unavailable', 'instrument': None}
    return {'due': True, 'status': 'pending', 'instrument': public_instrument(instrument)}


def checked_answers(instrument, answers):
    """Exactly one answer per item, each an option of that item or None ("Not sure")."""
    chosen = {answer.item_id: answer.option_id for answer in answers}
    if len(chosen) != len(answers) or set(chosen) != {item['id'] for item in instrument.items}:
        raise HTTPException(422, 'Answer every item of the current instrument exactly once (null means "Not sure")')
    for item in instrument.items:
        option = chosen[item['id']]
        if option is not None and option not in {choice['id'] for choice in item['options']}:
            raise HTTPException(422, f'That option is not part of item {item["id"]}')
    return chosen


async def record(request, db, user, body, operation):
    digest, stored = await replay(db, user, body, operation)
    if stored is not None:
        return stored
    settings, instrument = request.app.state.settings, request.app.state.content.instrument
    policy = study_policy(settings)
    participant = await db.scalar(select(ResearchParticipant).where(ResearchParticipant.user_id == user.id).with_for_update()
                                  .execution_options(populate_existing=True))
    if not participation_active(participant, policy):
        raise HTTPException(403, NOT_PARTICIPATING)
    if body.instrument_version != instrument.version:
        raise HTTPException(409, 'The prior-knowledge instrument changed; reload it')
    if await db.get(PriorKnowledgeResponse, user.id) is not None:
        raise HTTPException(409, 'Your prior-knowledge answers are already recorded')
    instant = now()
    row = PriorKnowledgeResponse(user_id=user.id, instrument_version=instrument.version, consent_version=participant.consent_version,
                                 answers=[], recorded_at=instant)
    if operation == 'onboarding-submit':
        chosen = checked_answers(instrument, body.answers)
        correct = score(instrument, chosen)
        report = body.self_report
        row.status, row.score, row.prior_knowledge_group = 'completed', correct, group_for(correct)
        row.experience, row.brokerage_account, row.market_frequency, row.confidence = (
            report.experience, report.brokerage_account, report.market_frequency, report.confidence)
        row.answers = [{'item_id': item['id'], 'option_id': chosen[item['id']], 'correct': chosen[item['id']] == item['answer']}
                       for item in instrument.items]
        row.elapsed_seconds = body.elapsed_seconds
        if report.experience is not None:
            participant.prior_knowledge = EXPERIENCE_METADATA[report.experience]
            if participant.first_prior_knowledge is None:
                participant.first_prior_knowledge = participant.prior_knowledge
            participant.updated_at = instant
    else:
        row.status, row.score, row.prior_knowledge_group = 'skipped', None, UNKNOWN
    db.add(row)
    await db.flush()
    result = await onboarding_view(db, user.id, settings, instrument)
    await store_receipt(db, user, body, digest, result)
    return result


@router.get('', response_model=OnboardingView, operation_id='getResearchOnboarding')
async def read_onboarding(request: Request, db: DB, user: User):
    return await onboarding_view(db, user.id, request.app.state.settings, request.app.state.content.instrument)


@router.post('/responses', response_model=OnboardingView, operation_id='submitResearchOnboarding')
async def submit_onboarding(body: SubmitPriorKnowledge, request: Request, db: DB, user: User):
    return await record(request, db, user, body, 'onboarding-submit')


@router.post('/skips', response_model=OnboardingView, operation_id='skipResearchOnboarding')
async def skip_onboarding(body: SkipPriorKnowledge, request: Request, db: DB, user: User):
    return await record(request, db, user, body, 'onboarding-skip')
