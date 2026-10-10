from copy import deepcopy
from datetime import datetime
import secrets

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import DateTime, ForeignKey, JSON, String, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, now
from app.challenges.models import ChallengeAttempt
from app.economy import ServerChallengeResult, consume_daily_refresh, daily_can_start, settle_challenge
from app.learning import DB, User, catalog, module_for
from app.progression import progress
from app.simulation import engine
from app.simulation.api import require_access

router = APIRouter(prefix='/api', tags=['adventure'])
VERSION = 'adventure-1'


class ChallengeDefinition(Base):
    __tablename__ = 'game_challenge_definitions'
    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    config: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ChapterAccess(Base):
    __tablename__ = 'chapter_access'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    module_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    attempt_id: Mapped[str] = mapped_column(ForeignKey('challenge_attempts.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ChapterBossCompletion(Base):
    __tablename__ = 'chapter_boss_completions'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    module_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    purpose: Mapped[str] = mapped_column(String(30), primary_key=True)
    attempt_id: Mapped[str] = mapped_column(ForeignKey('challenge_attempts.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


async def chapter_access_ids(db, user_id):
    return set(await db.scalars(select(ChapterAccess.module_id).where(ChapterAccess.user_id == user_id)))


async def require_chapter(db, user_id, module, modules, mastered):
    if await db.get(ChapterAccess, (user_id, module['id'])):
        return
    from app.progression import require_module
    require_module(module, modules, mastered)


async def definition(db, identifier, config):
    insert = {'sqlite': sqlite_insert, 'postgresql': pg_insert}[db.get_bind().dialect.name]
    statement = insert(ChallengeDefinition).values(id=identifier, config=config, created_at=now())
    await db.execute(statement.on_conflict_do_nothing(index_elements=[ChallengeDefinition.id]))
    row = await db.get(ChallengeDefinition, identifier)
    return deepcopy(row.config)


async def start_policy(request, db, user, body):
    if body.mode == 'practice':
        if body.module_id is not None:
            raise HTTPException(422, 'Practice does not select a chapter')
        await require_access(request, db, user, 'guided')
        return {'challenge_id': 'practice-foundation-1', 'mode': 'practice', 'opponents': body.opponent_count}
    if body.opponent_count != 1:
        raise HTTPException(422, 'This mode selects its opponents on the server')
    content = catalog(request)
    instant = now()
    if body.mode == 'daily':
        if body.module_id is not None:
            raise HTTPException(422, 'Daily challenges do not select a chapter')
        await daily_can_start(db, user, instant)
        active = await db.scalar(select(ChallengeAttempt.id).where(ChallengeAttempt.user_id == user.id,
            ChallengeAttempt.mode == 'daily', ChallengeAttempt.status == 'active').limit(1))
        if active:
            raise HTTPException(409, {'message': 'Resume or abandon the current daily attempt', 'attempt_id': active})
        identifier = 'daily:' + instant.date().isoformat()
        config = await definition(db, identifier, {'challenge_id': identifier, 'mode': 'daily',
            'seed': secrets.randbits(63), 'kind': secrets.choice(engine.KINDS), 'opponents': 1,
            'policy': {'objective': 'Apply an execution plan in a common daily market', 'difficulty': 'daily-1'}})
        return config
    if body.module_id is None:
        raise HTTPException(422, 'Select a chapter for its boss fight')
    module = module_for(request, body.module_id)
    completed, mastered, _ = await progress(db, user.id)
    if body.mode == 'chapter_entry':
        if module['order'] == 1:
            raise HTTPException(422, 'Chapter 1 uses its introductory diagnostic instead of an entry boss')
    else:
        await require_chapter(db, user.id, module, content['modules'], mastered)
        if any(lesson['id'] not in completed for lesson in module['lessons']):
            raise HTTPException(403, 'Complete the required chapter levels before its exit boss')
        if module.get('entry_tasks'):
            from app.learning_runs import require_diagnostic
            await require_diagnostic(db, user, module)
    identifier = f"{VERSION}:{content.get('content_version', 'legacy')}:{module['id']}:{body.mode}"
    # Persist private parameters once so first attempts and retries use the same form.
    kinds = ('sideways', 'volatile', 'rising', 'falling')
    config = await definition(db, identifier, {'challenge_id': identifier, 'mode': body.mode,
        'module_id': module['id'], 'seed': secrets.randbits(63), 'kind': kinds[(module['order'] - 1) % 4],
        'opponents': min(3, 1 + (module['order'] - 1) // 3),
        'policy': {'objective': f"Apply planned decisions and compare outcomes for {module['title']}",
            'difficulty': f"chapter-{module['order']}"}})
    return config


async def created(request, db, user, attempt):
    if attempt.mode == 'chapter_exit':
        ordered = sorted(request.app.state.catalog['modules'], key=lambda module: module['order'])
        following = next((ordered[index + 1]['id'] for index, module in enumerate(ordered[:-1]) if module['id'] == attempt.module_id), None)
        attempt.snapshot_json = {**attempt.snapshot_json, 'chapter_successor': following}
    if attempt.mode == 'daily':
        receipt = await consume_daily_refresh(db, user, attempt.id)
        attempt.snapshot_json = {**attempt.snapshot_json, 'research': {'premium_retry': receipt is not None,
            'refresh_event_key': receipt, 'daily_date': attempt.challenge_id.removeprefix('daily:')}}


async def complete_policy(db, user, result):
    mode = result['mode']
    instant = now()
    attempt = await db.get(ChallengeAttempt, result['attempt_id'])
    if attempt is None or attempt.user_id != user.id or result.get('user_id') != user.id:
        raise HTTPException(409, 'Challenge evidence is unavailable')
    if mode in {'chapter_entry', 'chapter_exit'} and result['win']:
        module_id = result['module_id']
        if not await db.get(ChapterBossCompletion, (user.id, module_id, mode)):
            db.add(ChapterBossCompletion(user_id=user.id, module_id=module_id, purpose=mode, attempt_id=attempt.id))
        if mode == 'chapter_entry' and not await db.get(ChapterAccess, (user.id, module_id)):
            db.add(ChapterAccess(user_id=user.id, module_id=module_id, attempt_id=attempt.id))
        if mode == 'chapter_exit':
            modules = attempt.snapshot_json.get('chapter_successor')
            if modules and not await db.get(ChapterAccess, (user.id, modules)):
                db.add(ChapterAccess(user_id=user.id, module_id=modules, attempt_id=attempt.id))
    day = attempt.snapshot_json.get('research', {}).get('daily_date')
    awarded = await settle_challenge(db, user, ServerChallengeResult(attempt_id=attempt.id,
        mode=mode, won=result['win'], completed_at=instant, chapter_id=result.get('module_id'),
        challenge_day=day))
    return {**awarded, 'chapter_entry_unlocked': mode == 'chapter_entry' and result['win'],
        'chapter_exit_completed': mode == 'chapter_exit' and result['win']}


async def abandoned(db, user, result):
    await settle_challenge(db, user, ServerChallengeResult(attempt_id=result['attempt_id'], mode=result['mode'],
        won=False, completed_at=now(), chapter_id=result.get('module_id'), abandoned=True))


@router.get('/adventure', operation_id='getAdventure')
async def adventure(request: Request, db: DB, user: User):
    content = catalog(request)
    completed, mastered, _ = await progress(db, user.id)
    access = await chapter_access_ids(db, user.id)
    bosses = list(await db.scalars(select(ChapterBossCompletion).where(ChapterBossCompletion.user_id == user.id)))
    entries = {(boss.module_id, boss.purpose) for boss in bosses}
    modules = []
    ordered = sorted(content['modules'], key=lambda module: module['order'])
    for module in ordered:
        normal = all(previous['id'] in mastered for previous in ordered if previous['order'] < module['order'])
        modules.append({'module_id': module['id'], 'title': module['title'], 'order': module['order'],
            'unlocked': normal or module['id'] in access, 'early_entry_available': module['order'] > 1,
            'entry_boss_passed': (module['id'], 'chapter_entry') in entries,
            'exit_boss_passed': (module['id'], 'chapter_exit') in entries,
            'completed_required_levels': sum(lesson['id'] in completed for lesson in module['lessons']),
            'total_required_levels': len(module['lessons']),
            'beginner_recommendation': 'New to trading? Learn the chapters in order before trying an early boss fight.',
            'assessment_basis': 'Game outcome; structured learning evidence is recorded separately'})
    return {'policy_version': VERSION, 'chapters': modules}
