from copy import deepcopy
from datetime import datetime
import hashlib
import json
import secrets
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import DateTime, ForeignKey, JSON, String, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.auth import current_profile
from app.db import Base, Profile, SimulationSession, get_db, now, uid
from app.learning import catalog
from app.progression import progress
from app.simulation import engine

router = APIRouter(prefix='/api/simulations', tags=['simulation'])
DB = Annotated[AsyncSession, Depends(get_db, scope='function')]
User = Annotated[Profile, Depends(current_profile)]


class SimulationCommand(Base):
    __tablename__ = 'simulation_commands'
    user_id: Mapped[str] = mapped_column(ForeignKey('profiles.id'), primary_key=True)
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey('simulation_sessions.id'), index=True)
    request_hash: Mapped[str] = mapped_column(String(64))
    response: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Payload(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class Command(Payload):
    idempotency_key: str = Field(min_length=8, max_length=100, pattern=r'^[a-zA-Z0-9_-]+$')


class Create(Command):
    mode: Literal['guided', 'endless'] = 'guided'


class Plan(Payload):
    reason: str = Field(min_length=12, max_length=1500)
    risk: str = Field(min_length=12, max_length=1500)
    exit: str = Field(min_length=12, max_length=1500)
    size_reason: str = Field(min_length=12, max_length=1500)
    max_loss: str = Field(min_length=1, max_length=20)


class Order(Command):
    symbol: Literal['NORTH', 'HARBOR', 'PLAIN', 'COVE']
    side: Literal['buy', 'sell']
    type: Literal['market', 'limit', 'stop']
    quantity: int = Field(ge=1, le=1000, strict=True)
    price: str | None = Field(default=None, max_length=20)
    plan: Plan


class Advance(Command):
    steps: int = Field(default=1, ge=1, le=5, strict=True)


class Debrief(Command):
    reflection: str = Field(min_length=30, max_length=1500)


async def require_access(request, db, user, mode):
    _, mastered, _ = await progress(db, user.id)
    required = [m['id'] for m in catalog(request)['modules'] if m['order'] <= (4 if mode == 'guided' else 9)]
    if any(mid not in mastered for mid in required) or len(required) < (4 if mode == 'guided' else 9):
        raise HTTPException(403, {'message': 'Complete the prerequisite mastery checks before this practice mode', 'prerequisite_module_ids': required})


def response(session):
    return {'id': session.id, 'mode': session.mode, 'updated_at': session.updated_at.isoformat() if session.updated_at else None, **engine.public_view(session.snapshot_json)}


async def owned(db, user, session_id):
    session = await db.scalar(select(SimulationSession).where(SimulationSession.id == session_id, SimulationSession.user_id == user.id).with_for_update())
    if session is None:
        raise HTTPException(404, 'Practice session not found')
    if session.version != engine.VERSION:
        raise HTTPException(409, 'This saved scenario needs a version migration')
    return session


async def create_session(db, user, mode='guided', seed=None, kind=None):
    active = (await db.scalars(select(SimulationSession).where(SimulationSession.user_id == user.id))).all()
    if sum(not s.snapshot_json['finished'] for s in active) >= 3:
        raise HTTPException(409, 'Resume or finish an existing session before starting another')
    session = SimulationSession(id=uid(), user_id=user.id, mode=mode,
                                scenario_kind=kind or secrets.choice(engine.KINDS), version=engine.VERSION,
                                snapshot_json={}, updated_at=now())
    session.snapshot_json = engine.new_session(seed if seed is not None else secrets.randbits(63), session.scenario_kind)
    db.add(session)
    await db.flush()
    return session


@router.get('')
async def list_sessions(db: DB, user: User):
    sessions = (await db.scalars(select(SimulationSession).where(SimulationSession.user_id == user.id).order_by(SimulationSession.updated_at.desc()).limit(50))).all()
    return {'sessions': [{'id': s.id, 'mode': s.mode, 'tick': s.snapshot_json['tick'], 'finished': s.snapshot_json['finished'], 'updated_at': s.updated_at} for s in sessions]}


@router.post('', status_code=201)
async def start(body: Create, request: Request, db: DB, user: User):
    digest = hashlib.sha256(json.dumps({'operation': 'create', 'mode': body.mode}, sort_keys=True).encode()).hexdigest()
    previous = await db.get(SimulationCommand, (user.id, body.idempotency_key))
    if previous:
        if previous.request_hash != digest:
            raise HTTPException(409, 'This command key was used for a different action')
        return previous.response
    await require_access(request, db, user, body.mode)
    session = await create_session(db, user, body.mode)
    result = response(session)
    db.add(SimulationCommand(user_id=user.id, key=body.idempotency_key, session_id=session.id, request_hash=digest, response=result))
    await db.flush()
    return result


@router.get('/{session_id}')
async def resume(session_id: str, db: DB, user: User):
    return response(await owned(db, user, session_id))


async def execute(session_id, body, operation, db, user, order_id=None):
    session = await owned(db, user, session_id)
    payload = body.model_dump(exclude={'idempotency_key'})
    digest = hashlib.sha256(json.dumps({'session': session_id, 'operation': operation, 'order': order_id, 'payload': payload}, sort_keys=True).encode()).hexdigest()
    previous = await db.get(SimulationCommand, (user.id, body.idempotency_key))
    if previous:
        if previous.request_hash != digest:
            raise HTTPException(409, 'This command key was used for a different action')
        return previous.response
    state = deepcopy(session.snapshot_json)
    try:
        if operation == 'order':
            if len(state['orders']) >= 100:
                raise engine.SimulationError('This scenario has reached its order limit. Review your decisions before a new scenario.')
            engine.submit_order(state, payload)
        elif operation == 'advance':
            engine.advance(state, body.steps)
        elif operation == 'cancel':
            engine.cancel_order(state, order_id)
        elif operation == 'debrief':
            engine.finish(state, body.reflection)
    except engine.SimulationError as exc:
        raise HTTPException(422, str(exc)) from None
    session.snapshot_json = state
    session.updated_at = now()
    result = response(session)
    db.add(SimulationCommand(user_id=user.id, key=body.idempotency_key, session_id=session.id, request_hash=digest, response=result))
    await db.flush()
    return result


@router.post('/{session_id}/orders')
async def order(session_id: str, body: Order, db: DB, user: User):
    return await execute(session_id, body, 'order', db, user)


@router.post('/{session_id}/advance')
async def advance(session_id: str, body: Advance, db: DB, user: User):
    return await execute(session_id, body, 'advance', db, user)


@router.post('/{session_id}/orders/{order_id}/cancel')
async def cancel(session_id: str, order_id: str, body: Command, db: DB, user: User):
    return await execute(session_id, body, 'cancel', db, user, order_id)


@router.post('/{session_id}/debrief')
async def debrief(session_id: str, body: Debrief, db: DB, user: User):
    return await execute(session_id, body, 'debrief', db, user)
