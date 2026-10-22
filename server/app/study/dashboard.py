"""Researcher dashboard: aggregates and CSV exports for consented participants only, under pseudonymous ids."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api_schemas.study_schema import (CheckAccuracy, Cohort, CsvKind, DecisionTrends, PrePostReport, QuizPerformance, ResearchAccess,
                                          ResearchSummary)
from app.auth import current_profile
from app.db import Profile, get_db, now
from app.research import study_policy
from app.study import analysis, scope
from app.study.access import Pseudonyms, is_researcher, researcher, study_open
from app.study.exports import EXPORTS

router = APIRouter(prefix='/api/research', tags=['researcher dashboard'])
DB = Annotated[AsyncSession, Depends(get_db, scope='function')]
Researcher = Annotated[Profile, Depends(researcher)]
ChapterFilter = Annotated[str | None, Query(max_length=120, description='Limit to one chapter id')]
CohortFilter = Annotated[Cohort, Query(description='Limit to one prior-knowledge group')]


class CsvResponse(StreamingResponse):
    media_type = 'text/csv'


async def collect(records):
    return [record async for record in records]


async def groups(db, policy):
    return {person.user_id: person.group for person in await scope.participants(db, policy)}


@router.get('/access', response_model=ResearchAccess, operation_id='getResearchAccess')
async def read_access(request: Request, user: Annotated[Profile, Depends(current_profile)]):
    settings = request.app.state.settings
    return {'allowed': is_researcher(settings, user) and study_open(settings)}


@router.get('/summary', response_model=ResearchSummary, operation_id='getResearchSummary')
async def read_summary(request: Request, db: DB, _: Researcher):
    policy, content = study_policy(request.app.state.settings), request.app.state.content
    people = await scope.participants(db, policy)
    matches = await collect(scope.matches(db, policy))
    checks = await collect(scope.checks(db, policy))
    return {'generated_at': now().isoformat(), 'policy_version': policy['version'], 'instrument_version': content.instrument.version,
            **analysis.summary(content.campaign, people, matches, checks)}


@router.get('/pre-post', response_model=PrePostReport, operation_id='getResearchPrePost')
async def read_pre_post(request: Request, db: DB, _: Researcher):
    policy = study_policy(request.app.state.settings)
    return analysis.pre_post(request.app.state.content.campaign, await groups(db, policy), await collect(scope.matches(db, policy)))


@router.get('/decision-trends', response_model=DecisionTrends, operation_id='getResearchDecisionTrends')
async def read_trends(request: Request, db: DB, _: Researcher, chapter_id: ChapterFilter = None, group: CohortFilter = 'all'):
    policy = study_policy(request.app.state.settings)
    return analysis.trends(await groups(db, policy), await collect(scope.matches(db, policy)), chapter_id, group)


@router.get('/checks', response_model=CheckAccuracy, operation_id='getResearchCheckAccuracy')
async def read_checks(request: Request, db: DB, _: Researcher, chapter_id: ChapterFilter = None, group: CohortFilter = 'all'):
    policy = study_policy(request.app.state.settings)
    return analysis.check_accuracy(request.app.state.content.campaign, await groups(db, policy), await collect(scope.checks(db, policy)),
                                   chapter_id, group)


@router.get('/quizzes', response_model=QuizPerformance, operation_id='getResearchQuizPerformance')
async def read_quizzes(request: Request, db: DB, _: Researcher, group: CohortFilter = 'all'):
    policy, content = study_policy(request.app.state.settings), request.app.state.content
    return analysis.quiz_performance(content.campaign, content.quiz, await groups(db, policy), await collect(scope.quizzes(db, policy)), group)


@router.get('/exports/{kind}', operation_id='exportResearchCsv', response_class=CsvResponse,
            responses={200: {'description': 'CSV with a header row; one record per line', 'content': {'text/csv': {'schema': {'type': 'string'}}}}})
async def export_csv(kind: CsvKind, request: Request, _: Researcher):
    settings, content, database = request.app.state.settings, request.app.state.content, request.app.state.db
    policy, ids = study_policy(settings), Pseudonyms(settings.research_pseudonym_secret)

    async def stream():
        # The request session closes when this handler returns, so the stream reads in its own session.
        async with database.sessions() as db:
            async for chunk in EXPORTS[kind](db, policy, ids, content):
                yield chunk
    filename = f'traders-edge-research-{kind}-{now():%Y%m%d}.csv'
    return CsvResponse(stream(), headers={'Content-Disposition': f'attachment; filename="{filename}"'})
