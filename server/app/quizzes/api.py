from copy import deepcopy
import hashlib
import json
import secrets

from fastapi import APIRouter, HTTPException, Request
from pydantic import Field
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from app.db import Profile, XPLedger, now, uid
from app.learning import Answer, DB, Payload, User, catalog, grade, public_question
from app.quizzes.models import QuizAttempt, QuizCommand, QuizMember, QuizRoom

router = APIRouter(prefix='/api/quizzes', tags=['quizzes'])
VERSION = 'quiz-1'
MAX_ROOM_MEMBERS = 30
STANDALONE_ATTEMPT_LIMIT = 3


class Command(Payload):
    idempotency_key: str = Field(min_length=8, max_length=100, pattern=r'^[a-zA-Z0-9_-]+$')


class Start(Command):
    module_id: str | None = Field(default=None, min_length=1, max_length=120)
    room_id: str | None = Field(default=None, min_length=1, max_length=36)


class Response(Command):
    answer: Answer


class CreateRoom(Command):
    title: str = Field(min_length=2, max_length=80)
    question_ids: list[str] = Field(min_length=1, max_length=20)
    attempt_limit: int = Field(default=1, ge=1, le=3, strict=True)


class Join(Command):
    join_code: str = Field(pattern=r'^[A-Z2-9]{8}$')


def instructor(settings, user):
    if settings.auth_mode == 'firebase':
        return bool(user.firebase_uid and user.firebase_uid in getattr(settings, 'instructor_firebase_uids', ()))
    return settings.environment != 'production' and user.id in getattr(settings, 'instructor_profile_ids', ())


def require_instructor(request, user):
    if not instructor(request.app.state.settings, user):
        raise HTTPException(403, 'An instructor account configured by the server is required')


def approved(content):
    return content.get('review_status') == 'approved' and all(
        module.get('review_status') == 'approved' and all(lesson.get('review_status') == 'approved'
                                                       for lesson in module['lessons'])
        for module in content['modules'])


def require_publication(request, snapshot):
    if request.app.state.settings.environment == 'production' and snapshot.get('approved') is not True:
        raise HTTPException(503, 'Quiz content is awaiting independent publication review')


def bank(content):
    questions = {}
    for module in content['modules']:
        for question in [*[question for lesson in module['lessons'] for question in lesson['questions']], *module['assessment']]:
            questions[question['id']] = {'module_id': module['id'], 'question': question}
    return questions


def form(module):
    questions = [*[question for lesson in module['lessons'] for question in lesson['questions']], *module['assessment']]
    return list({question['id']: question for question in questions}.values())


def request_hash(operation, target, body):
    return hashlib.sha256(json.dumps({'operation': operation, 'target': target,
        'payload': body.model_dump(exclude={'idempotency_key'})}, sort_keys=True).encode()).hexdigest()


async def replay(db, user, body, operation, target=None):
    digest = request_hash(operation, target, body)
    command = await db.get(QuizCommand, (user.id, body.idempotency_key))
    if command and command.request_hash != digest:
        raise HTTPException(409, 'This command key was used for a different quiz action')
    return digest, deepcopy(command.response) if command else None


async def remember(db, user, body, digest, response):
    db.add(QuizCommand(user_id=user.id, key=body.idempotency_key, request_hash=digest, response=deepcopy(response)))
    await db.flush()
    return response


def attempt_view(attempt):
    questions = attempt.snapshot_json['questions']
    position = len(attempt.state_json['first_answers'])
    return {'id': attempt.id, 'quiz_id': attempt.quiz_id, 'room_id': attempt.room_id,
            'content_version': attempt.content_version, 'policy_version': VERSION,
            'attempt_number': attempt.attempt_number, 'status': attempt.status,
            'current_question': public_question(questions[position]) if position < len(questions) else None,
            'progress': {'answered': position, 'total': len(questions)}, 'result': deepcopy(attempt.result_json)}


async def room_view(db, room):
    count = await db.scalar(select(func.count()).select_from(QuizMember).where(QuizMember.room_id == room.id))
    return {'id': room.id, 'host_id': room.host_id, 'title': room.title, 'join_code': room.join_code,
            'status': room.status, 'content_version': room.content_version, 'policy_version': VERSION,
            'attempt_limit': room.attempt_limit, 'question_count': len(room.snapshot_json['questions']),
            'member_count': count, 'capacity': MAX_ROOM_MEMBERS, 'private': True, 'xp_rewards': False}


async def locked_room(db, room_id, request):
    room = await db.scalar(select(QuizRoom).where(QuizRoom.id == room_id).with_for_update()
                           .execution_options(populate_existing=True))
    if room is None:
        raise HTTPException(404, 'Quiz room not found')
    if room.snapshot_json.get('version') != VERSION:
        raise HTTPException(409, 'This saved quiz room needs a version migration')
    require_publication(request, room.snapshot_json)
    return room


@router.get('/forms')
async def forms(request: Request, user: User):
    content = catalog(request)
    return {'content_version': content['content_version'], 'policy_version': VERSION,
            'forms': [{'module_id': module['id'], 'title': module['title'], 'question_count': len(form(module)),
                       'attempt_limit': STANDALONE_ATTEMPT_LIMIT, 'pass_rule': '80% correct and all critical risk items correct',
                       'passing_xp': 20, 'source_basis': module.get('source_basis', [])} for module in content['modules']]}


@router.get('/question-bank')
async def question_bank(request: Request, user: User):
    require_instructor(request, user)
    content = catalog(request)
    return {'content_version': content['content_version'], 'questions': [
        {'module_id': entry['module_id'], **public_question(entry['question'])} for entry in bank(content).values()]}


@router.post('/rooms', status_code=201)
async def create_room(body: CreateRoom, request: Request, db: DB, user: User):
    digest, previous = await replay(db, user, body, 'create-room')
    if previous is not None:
        return previous
    require_instructor(request, user)
    content = catalog(request)
    questions = bank(content)
    if len(set(body.question_ids)) != len(body.question_ids) or any(key not in questions for key in body.question_ids):
        raise HTTPException(422, 'Select distinct known question identifiers')
    for _ in range(3):
        room = QuizRoom(id=uid(), host_id=user.id, join_code=''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(8)),
                        title=body.title, content_version=content['content_version'], status='waiting',
                        attempt_limit=body.attempt_limit, snapshot_json={'version': VERSION,
                            'questions': [deepcopy(questions[key]['question']) for key in body.question_ids],
                            'approved': approved(content)})
        try:
            async with db.begin_nested():
                db.add(room)
                await db.flush()
            break
        except IntegrityError:
            room = None
    if room is None:
        raise HTTPException(409, 'A join code could not be allocated; retry')
    return await remember(db, user, body, digest, await room_view(db, room))


@router.post('/rooms/join')
async def join_room(body: Join, request: Request, db: DB, user: User):
    digest, previous = await replay(db, user, body, 'join-room')
    if previous is not None:
        return previous
    room = await db.scalar(select(QuizRoom).where(QuizRoom.join_code == body.join_code).with_for_update()
                           .execution_options(populate_existing=True))
    if room is None:
        raise HTTPException(404, 'Quiz room not found')
    if room.snapshot_json.get('version') != VERSION:
        raise HTTPException(409, 'This saved quiz room needs a version migration')
    require_publication(request, room.snapshot_json)
    if room.host_id == user.id:
        raise HTTPException(422, 'The instructor hosts this room rather than joining as a student')
    member = await db.get(QuizMember, (room.id, user.id))
    if member is None:
        if room.status != 'waiting':
            raise HTTPException(409, 'This room is no longer accepting students')
        count = await db.scalar(select(func.count()).select_from(QuizMember).where(QuizMember.room_id == room.id))
        if count >= MAX_ROOM_MEMBERS:
            raise HTTPException(409, 'This quiz room is full')
        db.add(QuizMember(room_id=room.id, user_id=user.id))
        await db.flush()
    return await remember(db, user, body, digest, await room_view(db, room))


@router.get('/rooms')
async def list_rooms(db: DB, user: User):
    joined = select(QuizMember.room_id).where(QuizMember.user_id == user.id)
    rooms = (await db.scalars(select(QuizRoom).where(or_(QuizRoom.host_id == user.id, QuizRoom.id.in_(joined)))
                              .order_by(QuizRoom.created_at.desc(), QuizRoom.id).limit(50))).all()
    return {'rooms': [await room_view(db, room) for room in rooms]}


@router.get('/rooms/{room_id}')
async def get_room(room_id: str, request: Request, db: DB, user: User):
    room = await db.get(QuizRoom, room_id)
    if room is None or (room.host_id != user.id and not await db.get(QuizMember, (room.id, user.id))):
        raise HTTPException(404, 'Quiz room not found')
    if room.snapshot_json.get('version') != VERSION:
        raise HTTPException(409, 'This saved quiz room needs a version migration')
    require_publication(request, room.snapshot_json)
    return await room_view(db, room)


async def change_room(room_id, body, request, db, user, operation):
    digest, previous = await replay(db, user, body, operation, room_id)
    if previous is not None:
        return previous
    require_instructor(request, user)
    room = await locked_room(db, room_id, request)
    if room.host_id != user.id:
        raise HTTPException(404, 'Quiz room not found')
    if operation == 'start-room':
        if room.status != 'waiting':
            raise HTTPException(409, 'This room cannot start again')
        if not await db.scalar(select(func.count()).select_from(QuizMember).where(QuizMember.room_id == room.id)):
            raise HTTPException(409, 'At least one student must join before the quiz starts')
        room.status = 'started'
    else:
        if room.status == 'closed':
            raise HTTPException(409, 'This room has already closed')
        room.status = 'closed'
    return await remember(db, user, body, digest, await room_view(db, room))


@router.post('/rooms/{room_id}/start')
async def start_room(room_id: str, body: Command, request: Request, db: DB, user: User):
    return await change_room(room_id, body, request, db, user, 'start-room')


@router.post('/rooms/{room_id}/close')
async def close_room(room_id: str, body: Command, request: Request, db: DB, user: User):
    return await change_room(room_id, body, request, db, user, 'close-room')


@router.get('/rooms/{room_id}/results')
async def room_results(room_id: str, request: Request, db: DB, user: User):
    require_instructor(request, user)
    room = await db.get(QuizRoom, room_id)
    if room is None or room.host_id != user.id:
        raise HTTPException(404, 'Quiz room not found')
    if room.snapshot_json.get('version') != VERSION:
        raise HTTPException(409, 'This saved quiz room needs a version migration')
    require_publication(request, room.snapshot_json)
    rows = (await db.execute(select(QuizMember.user_id, Profile.display_name).join(Profile, Profile.id == QuizMember.user_id)
                             .where(QuizMember.room_id == room_id))).all()
    attempts = (await db.scalars(select(QuizAttempt).where(QuizAttempt.room_id == room_id)
                                .order_by(QuizAttempt.user_id, QuizAttempt.attempt_number))).all()
    return {'room': await room_view(db, room), 'students': [
        {'user_id': identifier, 'display_name': name, 'attempts': [
            {'id': attempt.id, 'attempt_number': attempt.attempt_number, 'status': attempt.status,
             'result': deepcopy(attempt.result_json) if attempt.status == 'completed' else None}
            for attempt in attempts if attempt.user_id == identifier]} for identifier, name in rows]}


@router.post('/attempts', status_code=201)
async def start_attempt(body: Start, request: Request, db: DB, user: User):
    digest, previous = await replay(db, user, body, 'start-attempt')
    if previous is not None:
        return previous
    if bool(body.module_id) == bool(body.room_id):
        raise HTTPException(422, 'Choose one standalone module or one joined classroom room')
    if body.room_id:
        room = await locked_room(db, body.room_id, request)
        if not await db.get(QuizMember, (room.id, user.id)):
            raise HTTPException(404, 'Quiz room not found')
        if room.status != 'started':
            raise HTTPException(409, 'The instructor must start an open quiz room first')
        questions, content_version, limit = deepcopy(room.snapshot_json['questions']), room.content_version, room.attempt_limit
        publication_approved = room.snapshot_json.get('approved') is True
        quiz_id = 'room:' + room.id
    else:
        content = catalog(request)
        module = next((module for module in content['modules'] if module['id'] == body.module_id), None)
        if module is None:
            raise HTTPException(404, 'Quiz module not found')
        questions, content_version, limit = deepcopy(form(module)), content['content_version'], STANDALONE_ATTEMPT_LIMIT
        publication_approved = approved(content)
        form_hash = hashlib.sha256(json.dumps(questions, sort_keys=True).encode()).hexdigest()
        quiz_id = 'standalone:' + form_hash
    count = await db.scalar(select(func.count()).select_from(QuizAttempt).where(QuizAttempt.user_id == user.id,
        QuizAttempt.quiz_id == quiz_id, QuizAttempt.content_version == content_version))
    if count >= limit:
        raise HTTPException(403, 'The configured attempt limit for this quiz has been reached')
    active = await db.scalar(select(QuizAttempt.id).where(QuizAttempt.user_id == user.id, QuizAttempt.quiz_id == quiz_id,
        QuizAttempt.content_version == content_version, QuizAttempt.status == 'active'))
    if active:
        raise HTTPException(409, {'message': 'Resume the existing quiz attempt first', 'attempt_id': active})
    attempt = QuizAttempt(id=uid(), user_id=user.id, room_id=body.room_id, quiz_id=quiz_id,
                          content_version=content_version, attempt_number=count + 1, status='active',
                          snapshot_json={'version': VERSION, 'questions': questions, 'attempt_limit': limit,
                                         'approved': publication_approved},
                          state_json={'first_answers': []}, result_json=None)
    db.add(attempt)
    await db.flush()
    return await remember(db, user, body, digest, attempt_view(attempt))


async def owned_attempt(db, user, attempt_id, request):
    attempt = await db.scalar(select(QuizAttempt).where(QuizAttempt.id == attempt_id, QuizAttempt.user_id == user.id)
                              .with_for_update().execution_options(populate_existing=True))
    if attempt is None:
        raise HTTPException(404, 'Quiz attempt not found')
    if attempt.snapshot_json.get('version') != VERSION:
        raise HTTPException(409, 'This saved quiz needs a version migration')
    require_publication(request, attempt.snapshot_json)
    return attempt


@router.get('/attempts')
async def list_attempts(db: DB, user: User):
    rows = (await db.execute(select(QuizAttempt.id, QuizAttempt.room_id, QuizAttempt.quiz_id,
        QuizAttempt.content_version, QuizAttempt.attempt_number, QuizAttempt.status, QuizAttempt.created_at)
        .where(QuizAttempt.user_id == user.id).order_by(QuizAttempt.created_at.desc(), QuizAttempt.id).limit(50))).mappings().all()
    return {'attempts': [dict(row) for row in rows]}


@router.get('/attempts/{attempt_id}')
async def get_attempt(attempt_id: str, request: Request, db: DB, user: User):
    return attempt_view(await owned_attempt(db, user, attempt_id, request))


@router.post('/attempts/{attempt_id}/answers')
async def answer(attempt_id: str, body: Response, request: Request, db: DB, user: User):
    digest, previous = await replay(db, user, body, 'answer', attempt_id)
    if previous is not None:
        return previous
    attempt = await owned_attempt(db, user, attempt_id, request)
    if attempt.status != 'active':
        raise HTTPException(409, 'This quiz attempt has ended')
    if attempt.room_id:
        room = await locked_room(db, attempt.room_id, request)
        if room.status != 'started':
            raise HTTPException(409, 'The instructor has closed this quiz room')
    state = deepcopy(attempt.state_json)
    questions = attempt.snapshot_json['questions']
    question = questions[len(state['first_answers'])]
    if body.answer.question_id != question['id'] or body.answer.option_id not in {option['id'] for option in question['options']}:
        raise HTTPException(422, 'Answer the current question with a known option')
    state['first_answers'].append({**body.answer.model_dump(), 'recorded_at': now().isoformat()})
    attempt.state_json = state
    if len(state['first_answers']) == len(questions):
        answers = [Answer(**{key: response[key] for key in ('question_id', 'option_id', 'confidence')}) for response in state['first_answers']]
        score, passed, critical, feedback = grade(questions, answers)
        earned = 0
        if passed and attempt.room_id is None:
            key = 'game:quiz:' + hashlib.sha256((attempt.quiz_id + ':' + attempt.content_version).encode()).hexdigest()
            if not await db.get(XPLedger, (user.id, key)):
                db.add(XPLedger(user_id=user.id, event_key=key, amount=20, reason='Passed supplementary quiz'))
                earned = 20
        attempt.status = 'completed'
        attempt.result_json = {'score': score, 'passed': passed, 'critical_passed': critical,
                               'feedback': feedback, 'first_answers': deepcopy(state['first_answers']), 'xp_earned': earned}
    return await remember(db, user, body, digest, attempt_view(attempt))
