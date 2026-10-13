from copy import deepcopy
from datetime import datetime
import hashlib
import json
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy import DateTime, ForeignKey, JSON, String, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.auth import current_profile
from app.db import Base, LearningRun, Profile, SimulationSession, get_db, now, uid
from app.learning import catalog
from app.progression import progress
from app.simulation import engine
from app.api_schemas.simulation_schema import CreateSimulation, AdvanceSimulation, DebriefSimulation
from app.api_schemas.order_schema import SubmitOrder, CancelOrder

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


async def require_access(request, db, user, mode):
    _, mastered, _ = await progress(db, user.id)
    required = [m['id'] for m in catalog(request)['modules'] if m['order'] <= (4 if mode == 'guided' else 9)]
    if any(mid not in mastered for mid in required) or len(required) < (4 if mode == 'guided' else 9):
        raise HTTPException(403, {'message': 'Complete the prerequisite mastery checks before this practice mode', 'prerequisite_module_ids': required})


def observation_token(observed):
    return hashlib.sha256(json.dumps(observed, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def response(session):
    observed = engine.public_view(session.snapshot_json)
    result = {'id': session.id, 'mode': session.mode, 'updated_at': session.updated_at.isoformat() if session.updated_at else None, **observed}
    if 'bound_policy' in session.snapshot_json:
        result['bound_policy'] = deepcopy(session.snapshot_json['bound_policy'])
        result['audited_observation'] = deepcopy(session.snapshot_json.get('audited_observation'))
        result['observation_token'] = observation_token(observed)
    return result


async def owned(db, user, session_id):
    session = await db.scalar(select(SimulationSession).where(SimulationSession.id == session_id, SimulationSession.user_id == user.id).with_for_update())
    if session is None:
        raise HTTPException(404, 'Practice session not found')
    if session.version != engine.VERSION or session.snapshot_json.get('version') != engine.VERSION:
        raise HTTPException(409, 'This saved scenario needs a version migration')
    return session


async def create_session(db, user, mode='guided', seed=None, kind=None, ticks=120):
    active = await db.scalar(select(func.count()).select_from(SimulationSession).where(
        SimulationSession.user_id == user.id, SimulationSession.snapshot_json['finished'].as_boolean().is_not(True)))
    if active >= 3:
        raise HTTPException(409, 'Resume or finish an existing session before starting another')
    session = SimulationSession(id=uid(), user_id=user.id, mode=mode,
                                scenario_kind=kind or secrets.choice(engine.KINDS), version=engine.VERSION,
                                snapshot_json={}, updated_at=now())
    session.snapshot_json = engine.new_session(seed if seed is not None else secrets.randbits(63), session.scenario_kind, ticks=ticks)
    db.add(session)
    await db.flush()
    return session


@router.get('', operation_id='listSimulations')
async def list_sessions(db: DB, user: User):
    statement = select(SimulationSession.id, SimulationSession.mode, SimulationSession.updated_at,
                       SimulationSession.snapshot_json['tick'].as_integer().label('tick'),
                       SimulationSession.snapshot_json['finished'].as_boolean().label('finished'),
                       LearningRun.id.label('learning_run_id')).outerjoin(LearningRun,
                           (LearningRun.user_id == user.id)
                           & (LearningRun.id == SimulationSession.snapshot_json['bound_policy']['run_id'].as_string())
                           & (LearningRun.state_json['simulation_session_id'].as_string() == SimulationSession.id)
                       ).where(SimulationSession.user_id == user.id).order_by(SimulationSession.updated_at.desc()).limit(50)
    sessions = (await db.execute(statement)).mappings().all()
    return {'sessions': [dict(session) for session in sessions]}


@router.post('', status_code=201, operation_id='startSimulation')
async def start(body: CreateSimulation, request: Request, db: DB, user: User):
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


@router.get('/{session_id}', operation_id='resumeSimulation')
async def resume(session_id: str, request: Request, db: DB, user: User):
    from app.simulation.lesson_api import validate_session
    session = await owned(db, user, session_id)
    await validate_session(request, db, user, session)
    return response(session)


async def execute(session_id, body, operation, db, user, order_id=None, request=None):
    payload = body.model_dump(exclude={'idempotency_key'})
    digest = hashlib.sha256(json.dumps({'session': session_id, 'operation': operation, 'order': order_id, 'payload': payload}, sort_keys=True).encode()).hexdigest()
    previous = await db.get(SimulationCommand, (user.id, body.idempotency_key))
    if previous:
        if previous.request_hash != digest:
            raise HTTPException(409, 'This command key was used for a different action')
        return previous.response
    session = await owned(db, user, session_id)
    from app.simulation.lesson_api import restrict, validate_session
    bound = await validate_session(request, db, user, session, mutation=True)
    state = deepcopy(session.snapshot_json)
    if bound is not None:
        restrict(state, operation, payload)
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


@router.post('/{session_id}/orders/submit', operation_id='submitSimulationOrder')
async def order(session_id: str, body: SubmitOrder, request: Request, db: DB, user: User):
    return await execute(session_id, body, 'order', db, user, request=request)


@router.post('/{session_id}/advance', operation_id='advanceSimulation')
async def advance(session_id: str, body: AdvanceSimulation, request: Request, db: DB, user: User):
    return await execute(session_id, body, 'advance', db, user, request=request)


@router.post('/{session_id}/orders/{order_id}/cancel', operation_id='cancelSimulationOrder')
async def cancel(session_id: str, order_id: str, body: CancelOrder, request: Request, db: DB, user: User):
    return await execute(session_id, body, 'cancel', db, user, order_id, request=request)


@router.post('/{session_id}/debrief', operation_id='debriefSimulation')
async def debrief(session_id: str, body: DebriefSimulation, request: Request, db: DB, user: User):
    return await execute(session_id, body, 'debrief', db, user, request=request)
