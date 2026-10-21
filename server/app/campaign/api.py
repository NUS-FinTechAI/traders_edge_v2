from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api_schemas.campaign_schema import (Archive, Bosses, Campaign, ChapterMap, CheckAnswer, CheckAnswerBody, CheckComplete, Daily,
                                             Level, PracticeScenarios)
from app.auth import current_profile, optional_profile
from app.campaign import daily, views
from app.campaign.models import CampaignCheck
from app.campaign.progress import LEVEL_XP, load_progress, progress_row
from app.content.bundle import require_approved_content
from app.db import Profile, get_db
from app.player import badges, ledger

router = APIRouter(prefix='/api', tags=['campaign'])
APPROVED = [Depends(require_approved_content)]
DB = Annotated[AsyncSession, Depends(get_db, scope='function')]
User = Annotated[Profile, Depends(current_profile)]
Visitor = Annotated[Profile | None, Depends(optional_profile)]
Id = Annotated[str, Path(max_length=120)]


def content(request):
    return request.app.state.content


async def progress_for(request, db, profile):
    return await load_progress(db, content(request).campaign, profile.id if profile else None)


@router.get('/campaign', response_model=Campaign, operation_id='getCampaign')
async def get_campaign(request: Request, db: DB, user: Visitor):
    progress = await progress_for(request, db, user)
    campaign = content(request).campaign
    return {'chapters': [views.chapter_card(progress, chapter) for chapter in campaign.chapters],
            'next': views.continue_target(progress, campaign)}


@router.get('/campaign/chapters/{chapter_id}', response_model=ChapterMap, operation_id='getChapterMap')
async def get_chapter(chapter_id: Id, request: Request, db: DB, user: Visitor):
    chapter = content(request).campaign.chapter(chapter_id)
    if chapter is None:
        raise HTTPException(404, 'Chapter not found')
    progress = await progress_for(request, db, user)
    return {'chapter': views.chapter_card(progress, chapter), 'nodes': views.map_nodes(progress, chapter, content(request).cosmetics)}


def level_or_404(request, level_id):
    if level_id not in content(request).campaign.levels:
        raise HTTPException(404, 'Level not found')
    return content(request).campaign.level(level_id)


@router.get('/campaign/levels/{level_id}', response_model=Level, operation_id='getLevel', dependencies=APPROVED)
async def get_level(level_id: Id, request: Request, db: DB, user: Visitor):
    level_or_404(request, level_id)
    progress = await progress_for(request, db, user)
    chapter = content(request).campaign.chapter_of(level_id)
    if not progress.unlocked(chapter):
        raise HTTPException(403, progress.level_locked_reason(level_id))
    return views.level_view(progress, content(request).campaign, level_id, user.id if user else None)


async def open_level(request, db, user, level_id):
    level = level_or_404(request, level_id)
    reason = (await progress_for(request, db, user)).level_locked_reason(level_id)
    if reason:
        raise HTTPException(403, reason)
    return level


@router.post('/campaign/levels/{level_id}/check', response_model=CheckAnswer, operation_id='answerCheck', dependencies=APPROVED)
async def answer_check(level_id: Id, body: CheckAnswerBody, request: Request, db: DB, user: User):
    level = await open_level(request, db, user, level_id)
    question = next((q for q in level['check'] if q['id'] == body.question_id), None)
    if question is None:
        raise HTTPException(404, 'Question not found in this level')
    if body.option_id not in {option['id'] for option in question['options']}:
        raise HTTPException(422, 'That option is not part of this question')
    correct = body.option_id == question['answer']
    row = await db.get(CampaignCheck, (user.id, level_id, question['id']))
    if row is None:
        row = CampaignCheck(user_id=user.id, level_id=level_id, question_id=question['id'], first_option_id=body.option_id,
                            first_correct=correct, solved=False, run_first_correct=None, run_solved=False)
        db.add(row)
    first_try = row.run_first_correct is None
    if first_try:
        row.run_first_correct = correct
    if correct:
        row.solved = row.run_solved = True
    await db.flush()
    return {'correct': correct, 'correct_option_id': question['answer'], 'explanation': question['explanation'], 'first_try': first_try}


@router.post('/campaign/levels/{level_id}/check/complete', response_model=CheckComplete, operation_id='completeCheck', dependencies=APPROVED)
async def complete_check(level_id: Id, request: Request, db: DB, user: User):
    level = await open_level(request, db, user, level_id)
    rows = {row.question_id: row for row in await db.scalars(select(CampaignCheck).where(CampaignCheck.user_id == user.id,
                                                                                          CampaignCheck.level_id == level_id))}
    missing = [q['id'] for q in level['check'] if not (q['id'] in rows and rows[q['id']].run_solved)]
    if missing:
        raise HTTPException(409, 'Answer every question correctly before finishing the check')
    instant = ledger.current()
    progress = await progress_row(db, user.id, level_id)
    if not progress.check_done:
        progress.check_done = True
        progress.check_first_try = sum(rows[q['id']].first_correct for q in level['check'])
        progress.check_total = len(level['check'])
    run_first_try = sum(bool(rows[q['id']].run_first_correct) for q in level['check'])
    for row in rows.values():
        row.run_first_correct, row.run_solved = None, False
    await db.flush()
    xp = await ledger.award_xp(db, user.id, f'level-check:{level_id}', LEVEL_XP['check'], 'Level check finished', instant)
    await ledger.record_activity(db, user.id, instant)
    await badges.award(db, content(request), user.id, instant)
    return {'first_try_correct': run_first_try, 'first_ever_correct': progress.check_first_try, 'total': len(level['check']), 'xp': xp,
            'practice_unlocked': True}


@router.get('/archive', response_model=Archive, operation_id='getArchive')
async def get_archive(request: Request, db: DB, user: Visitor):
    return views.archive(await progress_for(request, db, user), content(request).campaign)


@router.get('/bosses', response_model=Bosses, operation_id='getBosses')
async def get_bosses(request: Request, db: DB, user: Visitor):
    return views.bosses(await progress_for(request, db, user), content(request).campaign)


@router.get('/practice', response_model=PracticeScenarios, operation_id='getPracticeScenarios', openapi_extra={'x-client-auth': 'none'})
async def get_practice():
    return views.practice_scenarios()


@router.get('/daily', response_model=Daily, operation_id='getDaily', dependencies=APPROVED)
async def get_daily(request: Request, db: DB, user: User):
    return await daily.view(db, user.id, await progress_for(request, db, user), ledger.current())


@router.post('/daily/refresh', response_model=Daily, operation_id='refreshDaily', dependencies=APPROVED)
async def refresh_daily(request: Request, db: DB, user: User):
    instant = ledger.current()
    await daily.refresh(db, user.id, instant)
    return await daily.view(db, user.id, await progress_for(request, db, user), instant)
