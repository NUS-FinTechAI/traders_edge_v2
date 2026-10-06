from copy import deepcopy
import hashlib
import json
import secrets
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import Field
from sqlalchemy import func, select

from app.db import now, uid
from app.simulation import engine
from app.simulation.api import Advance, Command, DB, Debrief, Order, User, require_access
from app.challenges import core
from app.challenges.models import ChallengeAttempt, ChallengeCommand

router = APIRouter(prefix='/api/challenges', tags=['challenges'])


class Create(Command):
    mode: Literal['practice', 'daily', 'chapter_entry', 'chapter_exit'] = 'practice'
    module_id: str | None = Field(default=None, min_length=1, max_length=120)
    opponent_count: int = Field(default=1, ge=1, le=3, strict=True)


def response(attempt):
    snapshot = attempt.snapshot_json
    return {'id': attempt.id, 'challenge_id': attempt.challenge_id, 'mode': attempt.mode,
            'attempt_number': attempt.attempt_number,
            'module_id': attempt.module_id, 'version': attempt.version, 'status': attempt.status,
            'policy': deepcopy(snapshot['policy']), 'player': engine.public_view(snapshot['human']),
            'opponents': [{'id': agent['id'], 'display_name': f'Opponent {index + 1}',
                           'tick': agent['state']['tick']} for index, agent in enumerate(snapshot['agents'])],
            'result': deepcopy(attempt.result_json)}


def request_hash(operation, attempt_id, payload, order_id=None):
    return hashlib.sha256(json.dumps({'operation': operation, 'attempt_id': attempt_id,
                                      'order_id': order_id, 'payload': payload}, sort_keys=True).encode()).hexdigest()


async def replay(db, user, key, digest):
    previous = await db.get(ChallengeCommand, (user.id, key))
    if previous:
        if previous.request_hash != digest:
            raise HTTPException(409, 'This command key was used for a different action')
        return deepcopy(previous.response)


async def owned(db, user, attempt_id, request=None):
    attempt = await db.scalar(select(ChallengeAttempt).where(ChallengeAttempt.id == attempt_id,
        ChallengeAttempt.user_id == user.id).with_for_update().execution_options(populate_existing=True))
    if attempt is None:
        raise HTTPException(404, 'Challenge attempt not found')
    snapshot = attempt.snapshot_json
    states = [snapshot.get('human', {}), *[agent.get('state', {}) for agent in snapshot.get('agents', [])]]
    if (attempt.version != core.VERSION or snapshot.get('version') != core.VERSION
            or snapshot.get('engine_version') != engine.VERSION
            or any(state.get('version') != engine.VERSION for state in states)):
        raise HTTPException(409, 'This saved challenge needs a version migration')
    if request is not None and request.app.state.settings.environment == 'production' and not snapshot.get('approved', False):
        raise HTTPException(503, 'Challenge content is awaiting independent publication review')
    return attempt


async def start_attempt(db, user, *, challenge_id, mode='practice', module_id=None,
                        seed=None, kind=None, opponents=1, policy=None, approved=False):
    active = await db.scalar(select(func.count()).select_from(ChallengeAttempt).where(
        ChallengeAttempt.user_id == user.id, ChallengeAttempt.status == 'active'))
    if active >= 3:
        raise HTTPException(409, 'Resume or abandon an active challenge before starting another')
    attempt_number = 1 + (await db.scalar(select(func.count()).select_from(ChallengeAttempt).where(
        ChallengeAttempt.user_id == user.id, ChallengeAttempt.challenge_id == challenge_id)))
    attempt = ChallengeAttempt(id=uid(), user_id=user.id, challenge_id=challenge_id, mode=mode,
        attempt_number=attempt_number,
        module_id=module_id, version=core.VERSION, status='active', result_json=None,
        snapshot_json=core.new_snapshot(seed if seed is not None else secrets.randbits(63),
            kind or secrets.choice(engine.KINDS), opponents, policy), created_at=now(), updated_at=now())
    attempt.snapshot_json = {**attempt.snapshot_json, 'approved': approved}
    db.add(attempt)
    await db.flush()
    return attempt


async def save_command(db, user, key, digest, attempt):
    result = response(attempt)
    db.add(ChallengeCommand(user_id=user.id, key=key, attempt_id=attempt.id,
                           request_hash=digest, response=result))
    await db.flush()
    return result


@router.post('', status_code=201)
async def start(body: Create, request: Request, db: DB, user: User):
    digest = request_hash('start', None, body.model_dump(exclude={'idempotency_key'}))
    previous = await replay(db, user, body.idempotency_key, digest)
    if previous is not None:
        return previous
    handler = getattr(request.app.state, 'challenge_start_handler', None)
    if handler:
        config = await handler(request, db, user, body)
    else:
        if body.mode != 'practice' or body.module_id is not None:
            raise HTTPException(409, 'This challenge mode requires its progression policy')
        await require_access(request, db, user, 'guided')
        config = {'challenge_id': 'practice-foundation-1', 'mode': 'practice', 'opponents': body.opponent_count}
    content = request.app.state.catalog
    config['approved'] = content.get('review_status') == 'approved' and all(module.get('review_status') == 'approved' and all(lesson.get('review_status') == 'approved' for lesson in module['lessons']) for module in content['modules'])
    if request.app.state.settings.environment == 'production' and not config['approved']:
        raise HTTPException(503, 'Challenge content is awaiting independent publication review')
    try:
        attempt = await start_attempt(db, user, **config)
    except engine.SimulationError as exc:
        raise HTTPException(422, str(exc)) from None
    created = getattr(request.app.state, 'challenge_created_handler', None)
    if created:
        await created(request, db, user, attempt)
    return await save_command(db, user, body.idempotency_key, digest, attempt)


@router.get('')
async def list_attempts(db: DB, user: User):
    rows = (await db.execute(select(ChallengeAttempt.id, ChallengeAttempt.challenge_id,
        ChallengeAttempt.mode, ChallengeAttempt.module_id, ChallengeAttempt.status,
        ChallengeAttempt.created_at, ChallengeAttempt.updated_at).where(ChallengeAttempt.user_id == user.id)
        .order_by(ChallengeAttempt.updated_at.desc(), ChallengeAttempt.id).limit(50))).mappings().all()
    return {'attempts': [dict(row) for row in rows]}


@router.get('/{attempt_id}')
async def resume(attempt_id: str, request: Request, db: DB, user: User):
    return response(await owned(db, user, attempt_id, request))


async def execute(attempt_id, body, operation, request, db, user, order_id=None):
    payload = body.model_dump(exclude={'idempotency_key'})
    digest = request_hash(operation, attempt_id, payload, order_id)
    previous = await replay(db, user, body.idempotency_key, digest)
    if previous is not None:
        return previous
    attempt = await owned(db, user, attempt_id, request)
    if attempt.status != 'active':
        raise HTTPException(409, 'This challenge attempt has ended')
    snapshot = deepcopy(attempt.snapshot_json)
    before = engine.public_view(snapshot['human'])
    result = None
    try:
        if operation == 'order':
            if len(snapshot['human']['orders']) >= core.MAX_ORDERS:
                raise engine.SimulationError('This challenge has reached its order limit')
            engine.submit_order(snapshot['human'], payload)
        elif operation == 'cancel':
            engine.cancel_order(snapshot['human'], order_id)
        elif operation == 'advance':
            core.advance(snapshot, body.steps)
        elif operation == 'complete':
            result = core.complete(snapshot, body.reflection)
            attempt.status = 'completed'
        elif operation == 'abandon':
            for state in [snapshot['human'], *[agent['state'] for agent in snapshot['agents']]]:
                state['finished'] = True
                for order in state['orders']:
                    if engine.pending(order):
                        order['status'] = 'cancelled'
            attempt.status = 'abandoned'
        else:
            raise ValueError('Unknown challenge command')
    except engine.SimulationError as exc:
        raise HTTPException(422, str(exc)) from None
    core.record_event(snapshot, operation, {**payload, **({'order_id': order_id} if order_id else {})}, before)
    snapshot['events'][-1]['attempt_number'] = attempt.attempt_number
    attempt.snapshot_json = snapshot
    attempt.updated_at = now()
    if result is not None:
        result.update({'attempt_id': attempt.id, 'user_id': user.id, 'mode': attempt.mode,
                       'module_id': attempt.module_id, 'challenge_id': attempt.challenge_id,
                       'attempt_number': attempt.attempt_number})
        handler = getattr(request.app.state, 'challenge_result_handler', None)
        if handler:
            result['awards'] = await handler(db, user, deepcopy(result))
        attempt.result_json = result
    elif operation == 'abandon':
        handler = getattr(request.app.state, 'challenge_abandon_handler', None)
        if handler:
            await handler(db, user, {'attempt_id': attempt.id, 'user_id': user.id,
                'mode': attempt.mode, 'module_id': attempt.module_id, 'challenge_id': attempt.challenge_id,
                'attempt_number': attempt.attempt_number, 'status': 'abandoned', 'win': False})
    return await save_command(db, user, body.idempotency_key, digest, attempt)


@router.post('/{attempt_id}/orders')
async def order(attempt_id: str, body: Order, request: Request, db: DB, user: User):
    return await execute(attempt_id, body, 'order', request, db, user)


@router.post('/{attempt_id}/orders/{order_id}/cancel')
async def cancel(attempt_id: str, order_id: str, body: Command, request: Request, db: DB, user: User):
    return await execute(attempt_id, body, 'cancel', request, db, user, order_id)


@router.post('/{attempt_id}/advance')
async def advance(attempt_id: str, body: Advance, request: Request, db: DB, user: User):
    return await execute(attempt_id, body, 'advance', request, db, user)


@router.post('/{attempt_id}/complete')
async def complete(attempt_id: str, body: Debrief, request: Request, db: DB, user: User):
    return await execute(attempt_id, body, 'complete', request, db, user)


@router.post('/{attempt_id}/abandon')
async def abandon(attempt_id: str, body: Command, request: Request, db: DB, user: User):
    return await execute(attempt_id, body, 'abandon', request, db, user)
