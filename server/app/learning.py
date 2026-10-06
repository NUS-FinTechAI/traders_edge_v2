from datetime import timedelta
import hashlib
import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import case, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import current_profile
from app.db import Attempt, JournalEntry, LearningActivity, LearningRun, LessonCompletion, MasteredModule, Profile, ReviewItem, XPLedger, aware, get_db, now, uid
from app.progression import progress, record_lesson, require_module, reward

router = APIRouter(prefix='/api')
DB = Annotated[AsyncSession, Depends(get_db, scope='function')]
User = Annotated[Profile, Depends(current_profile)]


class Payload(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class Answer(Payload):
    question_id: str = Field(min_length=1, max_length=120)
    option_id: str = Field(min_length=1, max_length=100)
    confidence: int | None = Field(default=None, ge=0, le=100, strict=True)


class Submission(Payload):
    idempotency_key: str = Field(min_length=8, max_length=100, pattern=r'^[a-zA-Z0-9_-]+$')
    answers: list[Answer] = Field(min_length=1, max_length=100)
    reflection: str = Field(min_length=10, max_length=2000)


class ProfileUpdate(Payload):
    display_name: str | None = Field(default=None, min_length=2, max_length=40)
    leaderboard_opt_in: bool | None = None
    analytics_opt_in: bool | None = None

    @field_validator('display_name')
    @classmethod
    def readable_name(cls, value):
        if value is not None and (not value.isprintable() or '<' in value or '>' in value):
            raise ValueError('Use a readable pseudonym without markup')
        return value


class JournalCreate(Payload):
    text: str = Field(min_length=10, max_length=2000)
    lesson_id: str | None = Field(default=None, max_length=120)


def catalog(request):
    value = request.app.state.catalog
    if request.app.state.settings.environment == 'production' and (value.get('review_status') != 'approved' or any(m.get('review_status') != 'approved' or any(l.get('review_status') != 'approved' for l in m['lessons']) for m in value['modules'])):
        raise HTTPException(503, 'Learning content is awaiting independent publication review')
    return value


def module_for(request, module_id):
    for module in catalog(request)['modules']:
        if module['id'] == module_id:
            return module
    raise HTTPException(404, 'Module not found')


def lesson_for(request, lesson_id):
    for module in catalog(request)['modules']:
        for lesson in module['lessons']:
            if lesson['id'] == lesson_id:
                return module, lesson
    raise HTTPException(404, 'Lesson not found')


def require_lesson(module, lesson_id, completed):
    prior = []
    for lesson in module['lessons']:
        if lesson['id'] == lesson_id:
            break
        if lesson['id'] not in completed:
            prior.append(lesson['id'])
    if prior:
        raise HTTPException(403, {'message': 'Complete the earlier lessons first', 'prerequisite_lesson_ids': prior})


def public_question(question):
    return {'id': question['id'], 'prompt': question['prompt'], 'options': [{'id': option['id'], 'text': option['text']} for option in question['options']]}


def public_lesson(lesson):
    value = {key: lesson[key] for key in ('id', 'title', 'objective', 'source_basis', 'explanation', 'worked_example') if key in lesson}
    cycle = lesson.get('learning_cycle', {})
    value['learning_cycle'] = {key: cycle[key] for key in ('question', 'explanation', 'worked_example', 'prediction', 'guided_decision', 'feedback', 'reflection', 'delayed_review', 'mastery_check') if isinstance(cycle.get(key), str)}
    value['questions'] = [public_question(q) for q in lesson['questions']]
    return value


async def profile_data(db, profile, progress_state=None):
    completed, mastered, xp = progress_state if progress_state is not None else await progress(db, profile.id)
    activity = (await db.scalars(select(LearningActivity.day).where(LearningActivity.user_id == profile.id).order_by(LearningActivity.day.desc()).limit(90))).all()
    due = await db.scalar(select(func.count()).select_from(ReviewItem).where(ReviewItem.user_id == profile.id, ReviewItem.completed_at.is_(None), ReviewItem.due_at <= now()))
    xp, game_xp = (await db.execute(select(func.coalesce(func.sum(XPLedger.amount), 0), func.coalesce(func.sum(case((XPLedger.event_key.like('game:%'), XPLedger.amount), else_=0)), 0)).where(XPLedger.user_id == profile.id))).one()
    return {'id': profile.id, 'display_name': profile.display_name, 'leaderboard_opt_in': profile.leaderboard_opt_in, 'analytics_opt_in': profile.analytics_opt_in, 'xp': xp, 'completed_lesson_ids': sorted(completed), 'mastered_module_ids': sorted(mastered), 'activity_days': list(activity), 'activity_timezone': 'UTC', 'due_review_count': due, 'learning_only': game_xp == 0, 'learning_xp': xp - game_xp, 'game_xp': game_xp, 'player_level': 1 + xp // 100, 'player_level_policy': '100-xp-per-level-1', 'xp_basis': 'learning and game events'}


@router.get('/me/profile')
async def get_profile(db: DB, user: User):
    return await profile_data(db, user)


@router.patch('/me/profile')
async def patch_profile(body: ProfileUpdate, db: DB, user: User):
    for key, value in body.model_dump(exclude_unset=True).items():
        if value is None:
            raise HTTPException(422, 'Profile fields cannot be null')
        setattr(user, key, value)
    await db.flush()
    return await profile_data(db, user)


def practice_eligibility(ordered, mastered):
    required = [m['id'] for m in ordered if m['order'] <= 9]
    practice = len(required) == 9 and all(mid in mastered for mid in required)
    foundations = [m['id'] for m in ordered if m['order'] <= 4]
    simulation = len(foundations) == 4 and all(mid in mastered for mid in foundations)
    return {'simulation': simulation, 'multiplayer': practice, 'endless': practice, 'prerequisite_module_ids': required}


@router.get('/curriculum')
async def get_curriculum(request: Request, db: DB, user: User):
    content = catalog(request)
    completed, mastered, _ = await progress(db, user.id)
    modules = []
    diagnosed = set((await db.scalars(select(LearningRun.module_id).where(LearningRun.user_id == user.id, LearningRun.purpose == 'diagnostic', LearningRun.status == 'completed'))).all())
    ordered = sorted(content['modules'], key=lambda m: m['order'])
    for module in ordered:
        prerequisites = [m['id'] for m in ordered if m['order'] < module['order']]
        unlocked = all(mid in mastered for mid in prerequisites)
        ready = unlocked and (not module.get('entry_tasks') or module['id'] in diagnosed)
        lessons = [{'id': lesson['id'], 'title': lesson['title'], 'objective': lesson['objective'], 'completed': lesson['id'] in completed, 'unlocked': ready and all(previous['id'] in completed for previous in module['lessons'][:index])} for index, lesson in enumerate(module['lessons'])]
        modules.append({'id': module['id'], 'order': module['order'], 'title': module['title'], 'description': module.get('description', ''), 'optional': module['order'] == 10, 'unlocked': unlocked, 'mastered': module['id'] in mastered, 'prerequisite_module_ids': prerequisites, 'assessment_available': ready and all(l['completed'] for l in lessons), 'lessons': lessons})
    return {'schema_version': content.get('schema_version', 1), 'review_status': content.get('review_status', 'unreviewed'), 'modules': modules, 'sources': content.get('sources', []), 'practice_eligibility': practice_eligibility(ordered, mastered)}


@router.get('/archive')
async def archive(request: Request, user: User):
    content = catalog(request)
    return {'terms': content.get('glossary', []), 'sources': content.get('sources', []), 'review_status': content.get('review_status', 'unreviewed')}


@router.get('/lessons/{lesson_id}')
async def get_lesson(lesson_id: str, request: Request, db: DB, user: User):
    module, lesson = lesson_for(request, lesson_id)
    completed, mastered, _ = await progress(db, user.id)
    require_module(module, catalog(request)['modules'], mastered)
    require_lesson(module, lesson_id, completed)
    if module.get('entry_tasks'):
        from app.learning_runs import require_diagnostic
        await require_diagnostic(db, user, module)
    return {'module_id': module['id'], 'completed': lesson_id in completed, 'review_status': catalog(request).get('review_status', 'unreviewed'), 'lesson': public_lesson(lesson), 'sources': catalog(request).get('sources', [])}


def grade(questions, answers, minimum_percent=80):
    submitted = {answer.question_id: answer for answer in answers}
    expected = {q['id'] for q in questions}
    if len(submitted) != len(answers) or set(submitted) != expected or not expected:
        raise HTTPException(422, 'Submit exactly one answer for every question')
    feedback = []
    critical_passed = True
    for question in questions:
        answer = submitted[question['id']]
        if answer.option_id not in {o['id'] for o in question['options']}:
            raise HTTPException(422, 'Unknown answer option')
        correct = answer.option_id == question['correct_option_id']
        if question.get('critical') and not correct:
            critical_passed = False
        feedback.append({'question_id': question['id'], 'correct': correct, 'selected_option_id': answer.option_id, 'correct_option_id': question['correct_option_id'], 'explanation': question['explanation'], 'confidence': answer.confidence})
    correct_count = sum(f['correct'] for f in feedback)
    score = round(100 * correct_count / len(questions))
    passed = correct_count * 100 >= len(questions) * minimum_percent and critical_passed
    return score, passed, critical_passed, feedback


async def submission_replay(db, user, body, kind, target_id):
    encoded = json.dumps({'kind': kind, 'target': target_id, 'payload': body.model_dump(exclude={'idempotency_key'})}, sort_keys=True, separators=(',', ':'))
    digest = hashlib.sha256(encoded.encode()).hexdigest()
    existing = await db.scalar(select(Attempt).where(Attempt.user_id == user.id, Attempt.idempotency_key == body.idempotency_key))
    if existing:
        if existing.request_hash != digest:
            raise HTTPException(409, 'This idempotency key was already used for a different submission')
        return digest, existing.result
    return digest, None


async def submit(request, db, user, body, kind, target_id, module, lesson=None, review=None):
    digest, existing = await submission_replay(db, user, body, kind, target_id)
    if existing is not None:
        return existing
    if module.get('entry_tasks') and kind in {'lesson', 'assessment'}:
        raise HTTPException(403, 'Use interactive learning runs for this module; whole-lesson submissions cannot bypass its tasks')
    completed, mastered, _ = await progress(db, user.id)
    require_module(module, catalog(request)['modules'], mastered)
    if kind == 'lesson':
        require_lesson(module, lesson['id'], completed)
    if kind == 'assessment' and any(l['id'] not in completed for l in module['lessons']):
        raise HTTPException(403, 'Pass every required lesson before the module assessment')
    if review and aware(review.due_at) > now():
        raise HTTPException(403, 'The delayed review is not due yet')
    questions = module['assessment'] if kind == 'assessment' else lesson['questions']
    score, passed, critical_passed, feedback = grade(questions, body.answers, 80 if kind == 'assessment' else 100)
    attempt_id = uid()
    attempt = Attempt(id=attempt_id, user_id=user.id, kind=kind, target_id=target_id, idempotency_key=body.idempotency_key, request_hash=digest, answers=[a.model_dump() for a in body.answers], reflection=body.reflection, score=score, passed=passed, result={})
    db.add(attempt)
    await db.flush()
    awarded = 0
    if passed:
        if kind == 'lesson':
            awarded = await record_lesson(db, user, lesson['id'], attempt_id, lesson.get('review_after_days', 1))
        elif kind == 'assessment' and module['id'] not in mastered:
            db.add(MasteredModule(user_id=user.id, module_id=module['id'], attempt_id=attempt_id))
            awarded = await reward(db, user, 'mastery:' + module['id'], 50, 'Passed module risk and reasoning check')
        elif kind == 'review' and not review.completed_at:
            review.completed_at = now()
            awarded = await reward(db, user, 'review:' + review.lesson_id, 10, 'Passed delayed learning review')
    elif review:
        review.due_at = now() + timedelta(days=lesson.get('review_after_days', 1))
    await db.flush()
    confidence_items = [(item['confidence'] / 100 - int(item['correct'])) ** 2 for item in feedback if item['confidence'] is not None]
    calibration = {'mean_brier_score': round(sum(confidence_items) / len(confidence_items), 6), 'sample_size': len(confidence_items), 'scope': 'This attempt only; lower is closer to observed correctness. No reward is attached.'} if confidence_items else None
    result = {'calibration': calibration, 'attempt_id': attempt_id, 'kind': kind, 'target_id': target_id, 'score_percent': score, 'passed': passed, 'critical_items_passed': critical_passed, 'feedback': feedback, 'xp_awarded': awarded, 'mastery_rule': 'At least 80% correct and every critical risk item correct' if kind == 'assessment' else 'Every reasoning item correct', 'reflection_recorded': True, 'reflection_assessed': False, 'profile': await profile_data(db, user)}
    attempt.result = result
    await db.flush()
    return result


@router.post('/lessons/{lesson_id}/complete')
async def complete_lesson(lesson_id: str, body: Submission, request: Request, db: DB, user: User):
    _, existing = await submission_replay(db, user, body, 'lesson', lesson_id)
    if existing is not None:
        return existing
    module, lesson = lesson_for(request, lesson_id)
    return await submit(request, db, user, body, 'lesson', lesson_id, module, lesson)


@router.get('/modules/{module_id}/assessment')
async def get_assessment(module_id: str, request: Request, db: DB, user: User):
    module = module_for(request, module_id)
    completed, mastered, _ = await progress(db, user.id)
    require_module(module, catalog(request)['modules'], mastered)
    if any(lesson['id'] not in completed for lesson in module['lessons']):
        raise HTTPException(403, 'Pass every required lesson before the module assessment')
    if module.get('entry_tasks'):
        from app.learning_runs import require_diagnostic
        await require_diagnostic(db, user, module)
    return {'module_id': module_id, 'mastered': module_id in mastered, 'questions': [public_question(q) for q in module['assessment']], 'mastery_rule': 'At least 80% correct and every critical risk item correct', 'reflection_required': not bool(module.get('entry_tasks')), 'interactive_required': bool(module.get('entry_tasks'))}


@router.post('/modules/{module_id}/assessment')
async def complete_assessment(module_id: str, body: Submission, request: Request, db: DB, user: User):
    _, existing = await submission_replay(db, user, body, 'assessment', module_id)
    if existing is not None:
        return existing
    return await submit(request, db, user, body, 'assessment', module_id, module_for(request, module_id))


@router.get('/attempts/{attempt_id}')
async def get_attempt(attempt_id: str, db: DB, user: User):
    attempt = await db.get(Attempt, attempt_id)
    if not attempt:
        raise HTTPException(404, 'Attempt not found')
    if attempt.user_id != user.id:
        raise HTTPException(403, 'This attempt belongs to another learner')
    return attempt.result


def interactive_review(content, module):
    return bool(content.get('content_version') and module.get('entry_tasks'))


async def owned_review(db, user, review_id):
    item = await db.get(ReviewItem, review_id)
    if not item:
        raise HTTPException(404, 'Review not found')
    if item.user_id != user.id:
        raise HTTPException(403, 'This review belongs to another learner')
    return item


async def review_data(request, db, user, items):
    content = catalog(request)
    lessons = {lesson['id']: (module, lesson) for module in content['modules'] for lesson in module['lessons']}
    summaries = (await db.execute(select(LearningRun.id, LearningRun.status, LearningRun.snapshot_json['review_id'].as_string().label('review_id')).where(LearningRun.user_id == user.id, LearningRun.purpose == 'review').order_by(LearningRun.created_at, LearningRun.id))).all()
    latest, active = {}, {}
    for summary in summaries:
        latest[summary.review_id] = summary.id
        if summary.status == 'active':
            active[summary.review_id] = summary.id
    result = []
    instant = now()
    for item in items:
        module, lesson = lessons.get(item.lesson_id, ({}, {}))
        required = interactive_review(content, module) or item.id in latest
        due = item.completed_at is None and aware(item.due_at) <= instant
        result.append({'id': item.id, 'lesson_id': item.lesson_id, 'title': lesson.get('title', item.lesson_id), 'due_at': aware(item.due_at), 'completed': item.completed_at is not None, 'due': due, 'questions': [public_question(q) for q in lesson.get('questions', [])] if due else [], 'interactive_required': required, 'reflection_required': not required, 'run_id': latest.get(item.id), 'active_run_id': active.get(item.id)})
    return result


@router.get('/reviews')
async def reviews(request: Request, db: DB, user: User):
    items = (await db.scalars(select(ReviewItem).where(ReviewItem.user_id == user.id).order_by(ReviewItem.due_at))).all()
    return {'reviews': await review_data(request, db, user, items)}


@router.get('/reviews/{review_id}')
async def get_review(review_id: str, request: Request, db: DB, user: User):
    item = await owned_review(db, user, review_id)
    return (await review_data(request, db, user, [item]))[0]


@router.post('/reviews/{review_id}/submit')
async def submit_review(review_id: str, body: Submission, request: Request, db: DB, user: User):
    _, existing = await submission_replay(db, user, body, 'review', review_id)
    if existing is not None:
        return existing
    item = await owned_review(db, user, review_id)
    module, lesson = lesson_for(request, item.lesson_id)
    if interactive_review(catalog(request), module) or await db.scalar(select(LearningRun.id).where(LearningRun.user_id == user.id, LearningRun.purpose == 'review', LearningRun.snapshot_json['review_id'].as_string() == review_id).limit(1)):
        raise HTTPException(403, 'Use interactive review runs; whole-review submissions cannot bypass their tasks')
    return await submit(request, db, user, body, 'review', review_id, module, lesson, item)


@router.get('/journal')
async def journal(db: DB, user: User, limit: int = 50):
    if limit < 1 or limit > 100:
        raise HTTPException(422, 'Limit must be between 1 and 100')
    items = (await db.scalars(select(JournalEntry).where(JournalEntry.user_id == user.id).order_by(JournalEntry.created_at.desc()).limit(limit))).all()
    return {'entries': [{'id': e.id, 'text': e.text, 'lesson_id': e.lesson_id, 'created_at': e.created_at} for e in items]}


@router.post('/journal', status_code=201)
async def add_journal(body: JournalCreate, request: Request, db: DB, user: User):
    if body.lesson_id:
        lesson_for(request, body.lesson_id)
    entry = JournalEntry(user_id=user.id, text=body.text, lesson_id=body.lesson_id)
    db.add(entry)
    await db.flush()
    return {'id': entry.id, 'text': entry.text, 'lesson_id': entry.lesson_id, 'created_at': entry.created_at}


@router.delete('/journal/{entry_id}', status_code=204)
async def delete_journal(entry_id: str, db: DB, user: User):
    entry = await db.get(JournalEntry, entry_id)
    if not entry:
        raise HTTPException(404, 'Journal entry not found')
    if entry.user_id != user.id:
        raise HTTPException(403, 'This journal entry belongs to another learner')
    await db.delete(entry)


@router.get('/leaderboard')
async def leaderboard(db: DB, user: User):
    if not user.leaderboard_opt_in:
        return {'opted_in': False, 'basis': 'Verified learning checks and delayed review; never trading profit or volume', 'entries': []}
    totals = select(XPLedger.user_id, func.sum(XPLedger.amount).label('xp')).where(~XPLedger.event_key.like('game:%')).group_by(XPLedger.user_id).subquery()
    rows = (await db.execute(select(Profile.display_name, totals.c.xp).join(totals, totals.c.user_id == Profile.id).where(Profile.leaderboard_opt_in.is_(True)).order_by(totals.c.xp.desc(), Profile.created_at).limit(50))).all()
    return {'opted_in': True, 'basis': 'Verified learning checks and delayed review; never trading profit or volume', 'entries': [{'rank': i + 1, 'display_name': name, 'xp': xp} for i, (name, xp) in enumerate(rows)]}
