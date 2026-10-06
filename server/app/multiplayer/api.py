from copy import deepcopy
from datetime import timedelta
import hashlib
import json
import secrets

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import Field
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.db import Profile, aware, now, uid
from app.learning import catalog
from app.simulation import engine
from app.simulation.api import Command, DB, Debrief, Order, User, require_access
from app.multiplayer import core
from app.multiplayer.models import (MultiplayerCommand, MultiplayerJoinThrottle, MultiplayerLobby,
                                    MultiplayerMember, MultiplayerQueue, MultiplayerRating)

router = APIRouter(prefix='/api/multiplayer', tags=['multiplayer'])


class TickCommand(Command):
    expected_tick: int = Field(ge=0, le=29, strict=True)


class TickOrder(Order):
    expected_tick: int = Field(ge=0, le=29, strict=True)


class Join(Command):
    code: str = Field(min_length=16, max_length=16, pattern=r'^[A-F0-9]{16}$')


def digest(operation, lobby_id, payload, order_id=None):
    return hashlib.sha256(json.dumps({'operation': operation, 'lobby_id': lobby_id,
        'payload': payload, 'order_id': order_id}, sort_keys=True).encode()).hexdigest()


async def replay(db, user, key, request_hash):
    previous = await db.get(MultiplayerCommand, (user.id, key))
    if previous:
        if previous.request_hash != request_hash:
            raise HTTPException(409, 'This command key was used for a different action')
        return deepcopy(previous.response)


def view(lobby, user_id):
    participants = lobby.snapshot_json['participants']
    own = participants[user_id]
    return {'id': lobby.id, 'host_id': lobby.host_id, 'mode': lobby.mode, 'status': lobby.status,
        'policy': deepcopy(core.POLICY), 'version': lobby.version, 'attempt_number': own['attempt_number'],
        'player': engine.public_view(own['state']) if own['state'] else None,
        'participants': [{'user_id': identifier, 'display_name': p['name'], 'ready': p['ready'],
            'forfeit': p['forfeit'], 'departed': p['departed'], 'completed': p['completed']}
            for identifier, p in participants.items()],
        'result': deepcopy(lobby.result_json), 'awards': deepcopy(own['awards'])}


async def save_command(db, user, key, request_hash, lobby, extras=None):
    response = {**view(lobby, user.id), **(extras or {})}
    db.add(MultiplayerCommand(user_id=user.id, key=key, lobby_id=lobby.id,
        request_hash=request_hash, response=response))
    await db.flush()
    return response


async def owned(db, user, lobby_id, request=None):
    membership = select(MultiplayerMember.lobby_id).where(MultiplayerMember.lobby_id == lobby_id,
        MultiplayerMember.user_id == user.id).exists()
    lobby = await db.scalar(select(MultiplayerLobby).where(MultiplayerLobby.id == lobby_id, membership)
        .with_for_update().execution_options(populate_existing=True))
    if lobby is None:
        raise HTTPException(404, 'Match not found')
    if lobby.version != core.VERSION:
        raise HTTPException(409, 'This saved match needs a version migration')
    if any(p['state'] for p in lobby.snapshot_json['participants'].values()):
        if lobby.snapshot_json.get('engine_version') != engine.VERSION:
            raise HTTPException(409, 'This saved match needs an engine migration')
        if any(p['state'] and p['state'].get('version') != engine.VERSION for p in lobby.snapshot_json['participants'].values()):
            raise HTTPException(409, 'This saved match needs an engine migration')
    if request is not None:
        publication(request, lobby.snapshot_json)
    return lobby


def publication(request, snapshot):
    if request.app.state.settings.environment == 'production' and snapshot.get('approved') is not True:
        raise HTTPException(503, 'Match content is awaiting independent publication review')


def approved(request):
    content = catalog(request)
    return content.get('review_status') == 'approved' and all(module.get('review_status') == 'approved' and all(lesson.get('review_status') == 'approved' for lesson in module['lessons']) for module in content['modules'])


async def access(request, db, user, mode):
    catalog(request)
    handler = getattr(request.app.state, 'multiplayer_access_handler', None)
    if handler:
        await handler(request, db, user, mode)
    else:
        await require_access(request, db, user, 'guided')


async def membership(db, lobby, user):
    previous = await db.get(MultiplayerMember, (lobby.id, user.id))
    if previous:
        return previous.attempt_number
    number = 1 + (await db.scalar(select(func.count()).select_from(MultiplayerMember).join(MultiplayerLobby)
        .where(MultiplayerMember.user_id == user.id, MultiplayerLobby.mode == lobby.mode)))
    db.add(MultiplayerMember(lobby_id=lobby.id, user_id=user.id, attempt_number=number, joined_at=now()))
    if lobby.mode == 'public_ranked' and await db.get(MultiplayerRating, user.id) is None:
        db.add(MultiplayerRating(user_id=user.id, rating=1000, matches=0))
    await db.flush()
    return number


async def create_lobby(db, user, mode, code=None, publication_approved=False):
    lobby = MultiplayerLobby(id=uid(), host_id=user.id, mode=mode, status='waiting',
        join_code_hash=hashlib.sha256(code.encode()).hexdigest() if code else None,
        version=core.VERSION, snapshot_json={'participants': {}, 'approved': publication_approved}, result_json=None,
        created_at=now(), updated_at=now())
    db.add(lobby)
    await db.flush()
    number = await membership(db, lobby, user)
    lobby.snapshot_json = {'participants': {user.id: core.waiting_participant(user.display_name, number)}, 'approved': publication_approved}
    return lobby


async def active_cap(db, user):
    count = await db.scalar(select(func.count()).select_from(MultiplayerMember).join(MultiplayerLobby)
        .where(MultiplayerMember.user_id == user.id, MultiplayerLobby.status.in_(['waiting', 'active']),
            MultiplayerLobby.snapshot_json['participants'][user.id]['departed'].as_boolean().is_not(True)))
    if count >= 3:
        raise HTTPException(409, 'Resume or abandon a match before joining another')


@router.post('/lobbies', status_code=201)
async def create(body: Command, request: Request, db: DB, user: User):
    request_hash = digest('create_private', None, {})
    previous = await replay(db, user, body.idempotency_key, request_hash)
    if previous is not None:
        return previous
    await access(request, db, user, 'private')
    await active_cap(db, user)
    code = secrets.token_hex(8).upper()
    lobby = await create_lobby(db, user, 'private', code, approved(request))
    return await save_command(db, user, body.idempotency_key, request_hash, lobby, {'join_code': code})


@router.post('/join')
async def join(body: Join, request: Request, db: DB, user: User):
    request_hash = digest('join_private', None, {'code': body.code})
    previous = await replay(db, user, body.idempotency_key, request_hash)
    if previous is not None:
        return previous
    await access(request, db, user, 'private')
    throttle = await db.get(MultiplayerJoinThrottle, user.id)
    current = now()
    if throttle is None:
        throttle = MultiplayerJoinThrottle(user_id=user.id, window_at=current, attempts=0)
        db.add(throttle)
    if aware(throttle.window_at) <= current - timedelta(minutes=10):
        throttle.window_at, throttle.attempts = current, 0
    if throttle.attempts >= 12:
        return JSONResponse(status_code=429, content={'detail': 'Too many join attempts; retry after the ten-minute window'}, headers={'Retry-After': '600'})
    throttle.attempts += 1
    code_hash = hashlib.sha256(body.code.encode()).hexdigest()
    lobby = await db.scalar(select(MultiplayerLobby).where(MultiplayerLobby.join_code_hash == code_hash,
        MultiplayerLobby.mode == 'private', MultiplayerLobby.status == 'waiting',
        MultiplayerLobby.version == core.VERSION).with_for_update()
        .execution_options(populate_existing=True))
    if lobby is None:
        await db.flush()
        return JSONResponse(status_code=404, content={'detail': 'Joinable lobby not found'})
    publication(request, lobby.snapshot_json)
    snapshot = deepcopy(lobby.snapshot_json)
    previous_member = snapshot['participants'].get(user.id)
    if previous_member and not previous_member['departed']:
        return await save_command(db, user, body.idempotency_key, request_hash, lobby)
    if previous_member is None and len(snapshot['participants']) >= core.MAX_PLAYERS:
        await db.flush()
        return JSONResponse(status_code=409, content={'detail': 'This lobby is full'})
    await active_cap(db, user)
    number = await membership(db, lobby, user)
    snapshot['participants'][user.id] = core.waiting_participant(user.display_name, number)
    lobby.snapshot_json, lobby.updated_at = snapshot, now()
    return await save_command(db, user, body.idempotency_key, request_hash, lobby)


@router.post('/matchmaking')
async def matchmaking(body: Command, request: Request, db: DB, user: User):
    request_hash = digest('matchmaking', None, {})
    previous = await replay(db, user, body.idempotency_key, request_hash)
    if previous is not None:
        return previous
    await access(request, db, user, 'public_ranked')
    factory = {'sqlite': sqlite_insert, 'postgresql': pg_insert}[db.bind.dialect.name]
    await db.execute(factory(MultiplayerQueue).values(channel=core.VERSION).on_conflict_do_nothing(index_elements=['channel']))
    await db.scalar(select(MultiplayerQueue).where(MultiplayerQueue.channel == core.VERSION).with_for_update())
    existing = await db.scalar(select(MultiplayerLobby).join(MultiplayerMember)
        .where(MultiplayerMember.user_id == user.id, MultiplayerLobby.mode == 'public_ranked',
            MultiplayerLobby.status.in_(['waiting', 'active']))
        .with_for_update(of=MultiplayerLobby).execution_options(populate_existing=True))
    if existing:
        publication(request, existing.snapshot_json)
        return await save_command(db, user, body.idempotency_key, request_hash, existing)
    await active_cap(db, user)
    lobby = await db.scalar(select(MultiplayerLobby).where(MultiplayerLobby.mode == 'public_ranked',
        MultiplayerLobby.status == 'waiting', MultiplayerLobby.version == core.VERSION)
        .order_by(MultiplayerLobby.created_at, MultiplayerLobby.id).limit(1).with_for_update()
        .execution_options(populate_existing=True))
    if lobby is None:
        lobby = await create_lobby(db, user, 'public_ranked', publication_approved=approved(request))
    else:
        publication(request, lobby.snapshot_json)
        snapshot = deepcopy(lobby.snapshot_json)
        number = await membership(db, lobby, user)
        snapshot['participants'][user.id] = core.waiting_participant(user.display_name, number)
        core.start(snapshot, secrets.randbits(63), secrets.choice(engine.KINDS))
        lobby.snapshot_json, lobby.status, lobby.updated_at = snapshot, 'active', now()
    return await save_command(db, user, body.idempotency_key, request_hash, lobby)


@router.get('/matches')
async def matches(db: DB, user: User):
    rows = (await db.execute(select(MultiplayerLobby.id, MultiplayerLobby.mode, MultiplayerLobby.status,
        MultiplayerLobby.created_at, MultiplayerLobby.updated_at).join(MultiplayerMember)
        .where(MultiplayerMember.user_id == user.id).order_by(MultiplayerLobby.updated_at.desc(), MultiplayerLobby.id)
        .limit(50))).mappings().all()
    return {'matches': [dict(row) for row in rows]}


@router.get('/leaderboard')
async def leaderboard(db: DB, user: User):
    rows = (await db.execute(select(MultiplayerRating.user_id, Profile.display_name, MultiplayerRating.rating,
        MultiplayerRating.matches).join(Profile).where(MultiplayerRating.matches > 0)
        .order_by(MultiplayerRating.rating.desc(), MultiplayerRating.user_id).limit(100))).mappings().all()
    own = await db.get(MultiplayerRating, user.id)
    return {'policy_version': core.VERSION, 'players': [dict(row) for row in rows],
            'your_rating': own.rating if own else 1000, 'your_matches': own.matches if own else 0}


@router.get('/{lobby_id}')
async def resume(lobby_id: str, request: Request, db: DB, user: User):
    return view(await owned(db, user, lobby_id, request), user.id)


async def settle_rating(db, lobby, result):
    if lobby.mode == 'private':
        return
    entries = sorted(result['leaderboard'], key=lambda entry: entry['user_id'])
    if len(entries) != 2:
        raise HTTPException(409, 'The public rating policy requires a paired match')
    identifiers = [entry['user_id'] for entry in entries]
    ratings = list((await db.scalars(select(MultiplayerRating).where(MultiplayerRating.user_id.in_(identifiers))
        .order_by(MultiplayerRating.user_id).with_for_update().execution_options(populate_existing=True))).all())
    if len(ratings) != 2:
        raise HTTPException(409, 'The match needs its participant rating records restored')
    first, second = entries
    score = 1 if first['rank'] < second['rank'] else 0 if first['rank'] > second['rank'] else 0.5
    delta = core.elo_delta(ratings[0].rating, ratings[1].rating, score)
    for entry, rating, adjustment in zip(entries, ratings, (delta, -delta)):
        entry['rating_before'], entry['rating_delta'] = rating.rating, adjustment
        rating.rating += adjustment
        rating.matches += 1
        entry['rating_after'] = rating.rating


async def execute(lobby_id, body, operation, request, db, user, order_id=None):
    payload = body.model_dump(exclude={'idempotency_key'})
    request_hash = digest(operation, lobby_id, payload, order_id)
    previous = await replay(db, user, body.idempotency_key, request_hash)
    if previous is not None:
        return previous
    lobby = await owned(db, user, lobby_id, request)
    snapshot = deepcopy(lobby.snapshot_json)
    participant = snapshot['participants'][user.id]
    before = engine.public_view(participant['state']) if participant['state'] else None
    if operation == 'start':
        if lobby.mode != 'private' or lobby.host_id != user.id:
            raise HTTPException(403, 'Only the private lobby host can start this match')
        if lobby.status != 'waiting':
            raise HTTPException(409, 'This lobby has already started or ended')
        if sum(not p['departed'] for p in snapshot['participants'].values()) < 2:
            raise HTTPException(409, 'At least two players must join before the host starts')
        core.start(snapshot, secrets.randbits(63), secrets.choice(engine.KINDS))
        lobby.status = 'active'
    elif operation == 'abandon' and lobby.status == 'waiting':
        participant['departed'] = True
        if lobby.host_id == user.id:
            lobby.status = 'cancelled'
    elif operation == 'complete':
        if lobby.status != 'finished' or participant['forfeit'] or participant['completed'] or not participant['state']:
            raise HTTPException(409, 'Complete only an unfinished reflection for a finished match')
        try:
            engine.finish(participant['state'], body.reflection)
        except engine.SimulationError as exc:
            raise HTTPException(422, str(exc)) from None
        participant['completed'] = True
        participant['awards'] = {}
        handler = getattr(request.app.state, 'multiplayer_result_handler', None)
        if lobby.mode == 'public_ranked' and handler:
            entry = next(entry for entry in lobby.result_json['leaderboard'] if entry['user_id'] == user.id)
            server_result = {**deepcopy(entry), 'attempt_id': f'{lobby.id}:{user.id}', 'user_id': user.id,
                'challenge_id': lobby.id, 'mode': lobby.mode, 'status': 'completed',
                'attempt_number': participant['attempt_number'], 'policy_version': core.VERSION}
            participant['awards'] = await handler(db, user, server_result)
    else:
        if lobby.status != 'active' or participant['forfeit'] or participant['departed'] or not participant['state']:
            raise HTTPException(409, 'This participant cannot act in the current match')
        state = participant['state']
        if operation in {'order', 'cancel', 'ready'} and body.expected_tick != state['tick']:
            raise HTTPException(409, 'The match advanced; fetch the current observation before this action')
        try:
            if operation in ('order', 'cancel'):
                if participant['ready']:
                    raise HTTPException(409, 'Wait for the next observation after confirming readiness')
                if operation == 'order':
                    if len(state['orders']) >= 50:
                        raise engine.SimulationError('This match has reached its order limit')
                    engine.submit_order(state, {key: value for key, value in payload.items() if key != 'expected_tick'})
                else:
                    engine.cancel_order(state, order_id)
            elif operation == 'ready':
                if participant['ready']:
                    raise HTTPException(409, 'This participant is already ready')
                participant['ready'] = True
                core.advance_if_ready(snapshot)
            elif operation == 'abandon':
                participant['forfeit'], participant['ready'] = True, False
                for order in state['orders']:
                    if engine.pending(order):
                        order['status'] = 'cancelled'
                if all(p['forfeit'] for p in snapshot['participants'].values() if p['state']):
                    lobby.status = 'cancelled'
                else:
                    core.advance_if_ready(snapshot)
            else:
                raise ValueError('Unknown match operation')
        except engine.SimulationError as exc:
            raise HTTPException(422, str(exc)) from None
        if lobby.status == 'active' and all(p['state']['tick'] == core.TICKS - 1 for p in snapshot['participants'].values() if p['state']):
            result = core.result(snapshot)
            await settle_rating(db, lobby, result)
            lobby.result_json, lobby.status = result, 'finished'
    core.event(participant, operation, {**payload, **({'order_id': order_id} if order_id else {})}, before)
    lobby.snapshot_json, lobby.updated_at = snapshot, now()
    return await save_command(db, user, body.idempotency_key, request_hash, lobby)


@router.post('/{lobby_id}/start')
async def start(lobby_id: str, body: Command, request: Request, db: DB, user: User):
    return await execute(lobby_id, body, 'start', request, db, user)


@router.post('/{lobby_id}/orders')
async def order(lobby_id: str, body: TickOrder, request: Request, db: DB, user: User):
    return await execute(lobby_id, body, 'order', request, db, user)


@router.post('/{lobby_id}/orders/{order_id}/cancel')
async def cancel(lobby_id: str, order_id: str, body: TickCommand, request: Request, db: DB, user: User):
    return await execute(lobby_id, body, 'cancel', request, db, user, order_id)


@router.post('/{lobby_id}/ready')
async def ready(lobby_id: str, body: TickCommand, request: Request, db: DB, user: User):
    return await execute(lobby_id, body, 'ready', request, db, user)


@router.post('/{lobby_id}/complete')
async def complete(lobby_id: str, body: Debrief, request: Request, db: DB, user: User):
    return await execute(lobby_id, body, 'complete', request, db, user)


@router.post('/{lobby_id}/abandon')
async def abandon(lobby_id: str, body: Command, request: Request, db: DB, user: User):
    return await execute(lobby_id, body, 'abandon', request, db, user)
