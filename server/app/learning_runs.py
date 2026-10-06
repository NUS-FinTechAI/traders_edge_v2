from copy import deepcopy
from datetime import timedelta
import hashlib
import json
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import Field
from sqlalchemy import select

from app.db import Attempt, LearningRun, LearningRunCommand, MasteredModule, aware, now, uid
from app.learning import DB, User, Payload, catalog, interactive_review, lesson_for, module_for, owned_review, practice_eligibility, profile_data, require_lesson
from app.progression import progress, record_lesson, reward
from app.content.validate import valid_choice_option_id
from app.simulation.bindings import public_binding, valid_binding

router = APIRouter(prefix='/api')


class Command(Payload):
    idempotency_key: str = Field(min_length=8, max_length=100, pattern=r'^[a-zA-Z0-9_-]+$')


class StartLevel(Command):
    purpose: Literal['practice', 'bonus'] = 'practice'


class StepAnswer(Payload):
    acknowledged: bool | None = Field(default=None, strict=True)
    option_id: str | None = Field(default=None, min_length=1, max_length=100)
    assignments: dict[str, str] | None = None
    confidence: int | None = Field(default=None, ge=0, le=100, strict=True)


class SubmitStep(Command):
    answer: StepAnswer


def public_task(task):
    public = {key: deepcopy(task[key]) for key in ('id', 'type', 'prompt', 'text') if key in task}
    for group in ('options', 'items', 'categories'):
        if group in task:
            public[group] = [{'id': entry['id'], 'text': entry['text']} for entry in task[group]]
    return public


def run_data(run):
    state = run.state_json
    tasks = run.snapshot_json['tasks']
    position = state['position']
    response = {'id': run.id, 'purpose': run.purpose, 'module_id': run.module_id, 'level_id': run.level_id, 'content_version': run.content_version, 'status': run.status, 'current_step': public_task(tasks[position]) if position < len(tasks) else None, 'feedback': deepcopy(state['feedback']), 'progress': {'completed_steps': position, 'total_steps': len(tasks)}, 'result': deepcopy(state['result'])}
    if run.purpose == 'review':
        response['review_id'] = run.snapshot_json['review_id']
    if 'simulation_binding' in run.snapshot_json:
        response['simulation'] = {'session_id': state.get('simulation_session_id'), 'url': f'/api/learning-runs/{run.id}/simulation', 'policy': public_binding(run.snapshot_json['simulation_binding'])}
    return response


def validate_pinned_content(run):
    def require(condition):
        if not condition:
            raise HTTPException(409, 'Invalid pinned learning content')

    def text(value):
        return isinstance(value, str) and bool(value.strip())

    def entries(values):
        require(isinstance(values, list) and len(values) >= 2)
        require(all(isinstance(value, dict) and text(value.get('id')) and value['id'] == value['id'].strip() and text(value.get('text')) for value in values))
        identifiers = {value['id'] for value in values}
        require(len(identifiers) == len(values))
        return identifiers

    snapshot = run.snapshot_json
    require(isinstance(snapshot, dict))
    if snapshot.get('rubric_version') not in {'interactive-1', 'interactive-2'}:
        raise HTTPException(409, 'Unsupported learning rubric version')
    bound = 'simulation_binding' in snapshot
    require(bound == (snapshot['rubric_version'] == 'interactive-2'))
    if bound:
        require(run.purpose == 'practice' and run.level_id == 'm05-l01' and valid_binding(snapshot['simulation_binding']))
    require(type(snapshot.get('approved')) is bool)
    require(run.purpose in {'diagnostic', 'practice', 'bonus', 'assessment', 'review'})
    if run.purpose in {'practice', 'review'}:
        require(type(snapshot.get('review_after_days')) is int and snapshot['review_after_days'] > 0)
    if run.purpose == 'review':
        require(text(snapshot.get('review_id')) and text(snapshot.get('lesson_id')) and snapshot['lesson_id'] == run.level_id)
    tasks = snapshot.get('tasks')
    require(isinstance(tasks, list) and bool(tasks))
    seen = set()
    graded = 0
    for task in tasks:
        require(isinstance(task, dict) and text(task.get('id')) and text(task.get('prompt')))
        require(task['id'] not in seen)
        seen.add(task['id'])
        kind = task.get('type')
        require(kind in ('instruction', 'choice', 'classification', 'simulation'))
        if run.purpose == 'review':
            require(kind == 'choice')
        if kind == 'instruction':
            require(run.purpose == 'practice' and text(task.get('text')))
            continue
        graded += 1
        require(text(task.get('explanation')) and type(task.get('critical')) is bool)
        if kind == 'simulation':
            require(bound and task is tasks[-1] and task['critical'] and set(task) == {'id', 'type', 'prompt', 'explanation', 'critical'})
            continue
        if kind == 'choice':
            options = entries(task.get('options'))
            require(all(valid_choice_option_id(value['id']) for value in task['options']))
            require(text(task.get('correct_option_id')) and task['correct_option_id'] in options)
        else:
            items, categories = entries(task.get('items')), entries(task.get('categories'))
            assignments = task.get('correct_assignments')
            require(isinstance(assignments, dict) and set(assignments) == items and all(text(value) and value in categories for value in assignments.values()))
    require(sum(t['type'] == 'simulation' for t in tasks) == int(bound))
    require(graded > int(bound))


def pinned_publication(request, run):
    validate_pinned_content(run)
    if request.app.state.settings.environment == 'production' and not run.snapshot_json['approved']:
        raise HTTPException(503, 'Learning content is awaiting independent publication review')


async def owned_run(db, user, run_id):
    run = await db.get(LearningRun, run_id)
    if not run:
        raise HTTPException(404, 'Learning run not found')
    if run.user_id != user.id:
        raise HTTPException(403, 'This learning run belongs to another learner')
    return run


async def replay(db, user, body, operation, target):
    encoded = json.dumps({'operation': operation, 'target': target, 'payload': body.model_dump(exclude={'idempotency_key'})}, sort_keys=True, separators=(',', ':'))
    digest = hashlib.sha256(encoded.encode()).hexdigest()
    command = await db.get(LearningRunCommand, (user.id, body.idempotency_key))
    if command and command.request_hash != digest:
        raise HTTPException(409, 'This idempotency key was already used for a different learning command')
    return digest, deepcopy(command.response) if command else None


async def remember(db, user, body, digest, run):
    response = run_data(run)
    db.add(LearningRunCommand(user_id=user.id, key=body.idempotency_key, run_id=run.id, request_hash=digest, response=response))
    await db.flush()
    return response


async def diagnostic_run(db, user, module_id):
    return await db.scalar(select(LearningRun).where(LearningRun.user_id == user.id, LearningRun.module_id == module_id, LearningRun.purpose == 'diagnostic').order_by(LearningRun.created_at).limit(1))


async def require_diagnostic(db, user, module):
    baseline = await diagnostic_run(db, user, module['id'])
    if not baseline or baseline.status != 'completed':
        raise HTTPException(403, 'Complete the entry diagnostic first; correctness does not block learning')


def require_interactive(module):
    if not module.get('entry_tasks'):
        raise HTTPException(409, 'This module has not been authored for interactive runs; use its legacy lesson path')


async def start_run(request, db, user, body, purpose, target):
    digest, previous = await replay(db, user, body, 'start:' + purpose, target)
    if previous is not None:
        return previous
    if purpose in {'practice', 'bonus'}:
        module, lesson = lesson_for(request, target)
    else:
        module, lesson = module_for(request, target), None
    require_interactive(module)
    content = catalog(request)
    completed, mastered, _ = await progress(db, user.id)
    from app.gameplay import require_chapter
    await require_chapter(db, user.id, module, content['modules'], mastered)
    if purpose != 'diagnostic':
        await require_diagnostic(db, user, module)
    if lesson:
        require_lesson(module, lesson['id'], completed)
        if purpose == 'bonus' and lesson['id'] not in completed:
            raise HTTPException(403, 'Complete the required level before its optional bonus')
    if purpose == 'assessment' and any(l['id'] not in completed for l in module['lessons']):
        raise HTTPException(403, 'Pass every required level before the module assessment')
    if purpose == 'diagnostic':
        existing = await diagnostic_run(db, user, module['id'])
    else:
        existing = await db.scalar(select(LearningRun).where(LearningRun.user_id == user.id, LearningRun.module_id == module['id'], LearningRun.level_id == (lesson['id'] if lesson else None), LearningRun.purpose == purpose, LearningRun.status == 'active').order_by(LearningRun.created_at).limit(1))
    if existing:
        pinned_publication(request, existing)
        return await remember(db, user, body, digest, existing)
    if purpose == 'diagnostic':
        tasks = module['entry_tasks']
    elif purpose == 'assessment':
        tasks = [{**question, 'type': 'choice'} for question in module['assessment']]
    else:
        tasks = lesson['bonus_tasks' if purpose == 'bonus' else 'tasks']
    run = LearningRun(id=uid(), user_id=user.id, purpose=purpose, module_id=module['id'], level_id=lesson['id'] if lesson else None, content_version=content['content_version'], status='active', snapshot_json={'tasks': deepcopy(tasks), 'review_after_days': lesson.get('review_after_days', 1) if lesson else None, 'approved': content.get('review_status') == 'approved' and module.get('review_status') == 'approved' and all(l.get('review_status') == 'approved' for l in module['lessons']), 'rubric_version': 'interactive-1'}, state_json={'position': 0, 'first_responses': {}, 'responses': [], 'feedback': [], 'result': None})
    if purpose == 'practice' and 'simulation_binding' in lesson:
        run.snapshot_json = {**run.snapshot_json, 'rubric_version': 'interactive-2', 'simulation_binding': deepcopy(lesson['simulation_binding'])}
    pinned_publication(request, run)
    db.add(run)
    await db.flush()
    return await remember(db, user, body, digest, run)


@router.post('/modules/{module_id}/diagnostic-runs')
async def start_diagnostic(module_id: str, body: Command, request: Request, db: DB, user: User):
    return await start_run(request, db, user, body, 'diagnostic', module_id)


@router.post('/modules/{module_id}/assessment-runs')
async def start_assessment(module_id: str, body: Command, request: Request, db: DB, user: User):
    return await start_run(request, db, user, body, 'assessment', module_id)


@router.post('/levels/{level_id}/runs')
async def start_level(level_id: str, body: StartLevel, request: Request, db: DB, user: User):
    return await start_run(request, db, user, body, body.purpose, level_id)


def require_due_review(item):
    if item.completed_at is not None:
        raise HTTPException(409, 'This delayed review is already completed')
    if aware(item.due_at) > now():
        raise HTTPException(403, 'The delayed review is not due yet')


@router.post('/reviews/{review_id}/runs')
async def start_review(review_id: str, body: Command, request: Request, db: DB, user: User):
    digest, previous = await replay(db, user, body, 'start:review', review_id)
    if previous is not None:
        return previous
    item = await owned_review(db, user, review_id)
    require_due_review(item)
    existing = await db.scalar(select(LearningRun).where(LearningRun.user_id == user.id, LearningRun.purpose == 'review', LearningRun.status == 'active', LearningRun.snapshot_json['review_id'].as_string() == review_id).order_by(LearningRun.created_at).limit(1))
    if existing:
        pinned_publication(request, existing)
        return await remember(db, user, body, digest, existing)
    module, lesson = lesson_for(request, item.lesson_id)
    content = catalog(request)
    if not interactive_review(content, module):
        raise HTTPException(409, 'This review has not been authored for interactive runs; use its legacy review path')
    completed, mastered, _ = await progress(db, user.id)
    from app.gameplay import require_chapter
    await require_chapter(db, user.id, module, content['modules'], mastered)
    require_lesson(module, lesson['id'], completed)
    if lesson['id'] not in completed:
        raise HTTPException(403, 'Complete the lesson before its delayed review')
    run = LearningRun(id=uid(), user_id=user.id, purpose='review', module_id=module['id'], level_id=lesson['id'], content_version=content['content_version'], status='active', snapshot_json={'review_id': review_id, 'lesson_id': lesson['id'], 'tasks': [{**deepcopy(question), 'type': 'choice'} for question in lesson['questions']], 'review_after_days': lesson.get('review_after_days'), 'approved': content.get('review_status') == 'approved' and module.get('review_status') == 'approved' and all(l.get('review_status') == 'approved' for l in module['lessons']), 'rubric_version': 'interactive-1'}, state_json={'position': 0, 'first_responses': {}, 'responses': [], 'feedback': [], 'result': None})
    pinned_publication(request, run)
    db.add(run)
    await db.flush()
    return await remember(db, user, body, digest, run)


@router.get('/learning-runs/{run_id}')
async def get_run(run_id: str, request: Request, db: DB, user: User):
    run = await owned_run(db, user, run_id)
    pinned_publication(request, run)
    return run_data(run)


def grade_task(task, answer):
    values = answer.model_dump(exclude_none=True)
    fields = set(values) - {'confidence'}
    kind = task['type']
    if kind == 'instruction':
        if fields != {'acknowledged'} or values['acknowledged'] is not True or 'confidence' in values:
            raise HTTPException(422, 'Acknowledge this instruction with acknowledged: true')
        return True
    if kind == 'choice':
        if fields != {'option_id'} or values['option_id'] not in {o['id'] for o in task['options']}:
            raise HTTPException(422, 'Submit one known option_id for this choice')
        return values['option_id'] == task['correct_option_id']
    if fields != {'assignments'} or set(values['assignments']) != {i['id'] for i in task['items']} or any(v not in {c['id'] for c in task['categories']} for v in values['assignments'].values()):
        raise HTTPException(422, 'Assign every item exactly once to a known category')
    return values['assignments'] == task['correct_assignments']


async def finish_run(db, user, run, state):
    tasks = run.snapshot_json['tasks']
    graded = [t for t in tasks if t['type'] != 'instruction']
    evidence = {r['step_id']: r for r in state['responses']}
    correct_count = sum(evidence[t['id']]['correct'] for t in graded)
    critical = all(evidence[t['id']]['correct'] for t in graded if t.get('critical'))
    score = round(100 * correct_count / len(graded))
    passed = correct_count * 100 >= len(graded) * (80 if run.purpose == 'assessment' else 100) and critical
    attempt_id = uid()
    attempt = Attempt(id=attempt_id, user_id=user.id, kind=run.purpose, target_id=run.snapshot_json['review_id'] if run.purpose == 'review' else run.level_id or run.module_id, idempotency_key='run:' + run.id, request_hash=hashlib.sha256(run.id.encode()).hexdigest(), answers=deepcopy(state['responses']), reflection='', score=score, passed=passed if run.purpose != 'diagnostic' else False, result={})
    db.add(attempt)
    await db.flush()
    awarded = 0
    if run.purpose == 'review':
        item = await owned_review(db, user, run.snapshot_json['review_id'])
        require_due_review(item)
        if item.lesson_id != run.level_id:
            raise HTTPException(409, 'The review does not match its pinned lesson')
        if passed:
            item.completed_at = now()
            awarded = await reward(db, user, 'review:' + item.lesson_id, 10, 'Passed delayed learning review')
        else:
            item.due_at = now() + timedelta(days=run.snapshot_json['review_after_days'])
    elif run.purpose == 'practice' and passed:
        awarded = await record_lesson(db, user, run.level_id, attempt_id, run.snapshot_json['review_after_days'])
    elif run.purpose == 'assessment' and passed and not await db.get(MasteredModule, (user.id, run.module_id)):
        db.add(MasteredModule(user_id=user.id, module_id=run.module_id, attempt_id=attempt_id))
        awarded = await reward(db, user, 'mastery:' + run.module_id, 50, 'Passed module risk and reasoning check')
    await db.flush()
    state['result'] = {'attempt_id': attempt_id, 'passed': None if run.purpose == 'diagnostic' else passed, 'score_percent': score, 'critical_items_passed': critical, 'standard_star': run.purpose == 'practice' and passed, 'bonus_star': run.purpose == 'bonus' and passed, 'xp_awarded': awarded, 'profile': await profile_data(db, user)}
    if run.purpose in {'diagnostic', 'assessment', 'review'}:
        state['feedback'] = [{'step_id': t['id'], 'correct': evidence[t['id']]['correct'], 'explanation': t['explanation']} for t in graded]
    run.status = 'completed'
    attempt.result = {'run_id': run.id, 'purpose': run.purpose, 'content_version': run.content_version, **deepcopy(state['result']), 'feedback': deepcopy(state['feedback'])}


@router.post('/learning-runs/{run_id}/steps/{step_id}/submit')
async def submit_step(run_id: str, step_id: str, body: SubmitStep, request: Request, db: DB, user: User):
    digest, previous = await replay(db, user, body, 'submit-step', [run_id, step_id])
    if previous is not None:
        return previous
    run = await owned_run(db, user, run_id)
    pinned_publication(request, run)
    if run.status != 'active':
        if run.purpose == 'review':
            raise HTTPException(409, 'This review run is complete; a failed review can be retried when due again')
        raise HTTPException(409, 'This run is complete; start a new practice or assessment run to retry')
    state = deepcopy(run.state_json)
    task = run.snapshot_json['tasks'][state['position']]
    if task['id'] != step_id:
        raise HTTPException(409, 'Submit only the current step; completed responses cannot be replaced')
    if task['type'] == 'simulation':
        raise HTTPException(409, 'Submit the current session audit through the simulation review route')
    correct = grade_task(task, body.answer)
    evidence = {'step_id': step_id, 'answer': body.answer.model_dump(exclude_none=True), 'correct': correct}
    state['responses'].append(evidence)
    state['first_responses'].setdefault(step_id, deepcopy(evidence))
    withheld = run.purpose in {'diagnostic', 'assessment', 'review'}
    if correct or withheld:
        state['position'] += 1
    state['feedback'] = [] if withheld or task['type'] == 'instruction' else [{'step_id': step_id, 'correct': correct, 'explanation': task['explanation']}]
    if state['position'] == len(run.snapshot_json['tasks']):
        await finish_run(db, user, run, state)
    run.state_json = state
    await db.flush()
    return await remember(db, user, body, digest, run)


async def run_summaries(db, user, module_id=None):
    statement = select(LearningRun.id, LearningRun.module_id, LearningRun.level_id, LearningRun.purpose, LearningRun.status, LearningRun.state_json['result']['bonus_star'].as_boolean().label('bonus_star')).where(LearningRun.user_id == user.id)
    if module_id is not None:
        statement = statement.where(LearningRun.module_id == module_id)
    return (await db.execute(statement.order_by(LearningRun.created_at))).all()


def map_data(content, module, progress_state, runs, chapter_access=None):
    completed, mastered, _ = progress_state
    missing = [] if module['id'] in (chapter_access or set()) else [m['id'] for m in content['modules'] if m['order'] < module['order'] and m['id'] not in mastered]
    interactive = bool(module.get('entry_tasks'))
    baseline = next((r for r in runs if r.purpose == 'diagnostic'), None) if interactive else None
    baseline_done = baseline is not None and baseline.status == 'completed'
    levels = []
    for index, lesson in enumerate(module['lessons']):
        unlocked = not missing and (baseline_done or not interactive) and all(l['id'] in completed for l in module['lessons'][:index])
        own_runs = [r for r in runs if r.level_id == lesson['id']]
        required = any(r.purpose == 'practice' and r.status == 'completed' for r in own_runs)
        bonus = any(r.purpose == 'bonus' and r.status == 'completed' and r.bonus_star for r in own_runs)
        active = next((r for r in reversed(own_runs) if r.status == 'active' and r.purpose == 'practice'), None)
        done = lesson['id'] in completed
        levels.append({'id': lesson['id'], 'title': lesson['title'], 'objective': lesson['objective'], 'unlocked': unlocked, 'status': 'completed' if done else 'active' if active else 'available' if unlocked else 'locked', 'standard_star': done, 'bonus_star': bonus, 'completion_source': 'interactive' if required else 'legacy' if done else None, 'bonus_available': interactive and unlocked and done, 'active_run_id': active.id if active else None})
    return {'module_id': module['id'], 'title': module['title'], 'content_version': content.get('content_version'), 'interactive_available': interactive, 'unlocked': not missing, 'prerequisite_module_ids': missing, 'mastered': module['id'] in mastered, 'diagnostic': {'required': interactive, 'completed': baseline_done, 'run_id': baseline.id if baseline else None}, 'levels': levels, 'assessment_available': not missing and (baseline_done or not interactive) and all(l['id'] in completed for l in module['lessons'])}


@router.get('/modules/{module_id}/map')
async def get_map(module_id: str, request: Request, db: DB, user: User):
    module = module_for(request, module_id)
    from app.gameplay import chapter_access_ids
    return map_data(catalog(request), module, await progress(db, user.id), await run_summaries(db, user, module_id), await chapter_access_ids(db, user.id))


@router.get('/levels/{level_id}')
async def get_level(level_id: str, request: Request, db: DB, user: User):
    module, lesson = lesson_for(request, level_id)
    from app.gameplay import chapter_access_ids
    mapping = map_data(catalog(request), module, await progress(db, user.id), await run_summaries(db, user, module['id']), await chapter_access_ids(db, user.id))
    node = next(n for n in mapping['levels'] if n['id'] == level_id)
    return {'module_id': module['id'], 'content_version': mapping['content_version'], 'interactive_available': mapping['interactive_available'], 'level': {**node, 'source_basis': lesson.get('source_basis', []), 'required_steps': len(lesson.get('tasks', [])), 'bonus_steps': len(lesson.get('bonus_tasks', [])), 'completion_rule': 'Complete each required task in order; retry incorrect practice decisions' if mapping['interactive_available'] else 'Pass the complete legacy lesson question set', 'bonus_rule': 'Optional verified decision; never required for the next level' if mapping['interactive_available'] else 'No interactive bonus is available for this level', 'review_after_days': lesson.get('review_after_days', 1)}}


@router.get('/me/workflow')
async def workflow(request: Request, db: DB, user: User):
    content = catalog(request)
    progress_state = await progress(db, user.id, include_xp=False)
    from app.gameplay import chapter_access_ids
    chapter_access = await chapter_access_ids(db, user.id)
    summaries = await run_summaries(db, user)
    by_module = {}
    for summary in summaries:
        by_module.setdefault(summary.module_id, []).append(summary)
    ordered = sorted(content['modules'], key=lambda m: m['order'])
    maps = [map_data(content, module, progress_state, by_module.get(module['id'], []), chapter_access) for module in ordered]
    active = await db.scalar(select(LearningRun).where(LearningRun.user_id == user.id, LearningRun.status == 'active').order_by(LearningRun.updated_at.desc()).limit(1))
    if active:
        pinned_publication(request, active)
    next_action = None
    if active:
        next_action = {'kind': 'resume', 'run_id': active.id, 'module_id': active.module_id, 'level_id': active.level_id}
    else:
        for mapping in maps:
            if not mapping['unlocked'] or mapping['mastered']:
                continue
            if mapping['interactive_available'] and not mapping['diagnostic']['completed']:
                next_action = {'kind': 'diagnostic', 'module_id': mapping['module_id']}
            else:
                level = next((n for n in mapping['levels'] if n['unlocked'] and not n['standard_star']), None)
                next_action = {'kind': 'level' if mapping['interactive_available'] else 'legacy_lesson', 'module_id': mapping['module_id'], 'level_id': level['id']} if level else {'kind': 'assessment' if mapping['interactive_available'] else 'legacy_assessment', 'module_id': mapping['module_id']}
            break
    return {'profile': await profile_data(db, user, progress_state), 'resume': run_data(active) if active else None, 'next_action': next_action, 'modules': maps, 'practice_eligibility': practice_eligibility(ordered, progress_state[1])}
