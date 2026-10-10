from copy import deepcopy
from decimal import InvalidOperation
import json
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import Field, field_validator
from sqlalchemy import select

from app.db import LearningRun, LearningRunCommand, SimulationSession, now
from app.learning import DB, User, Payload
from app import learning_runs as runs
from app.simulation import api, engine
from app.simulation.bindings import public_binding

router = APIRouter(prefix='/api/learning-runs', tags=['bound-simulation'])


class AuditOrder(Payload):
    order_id: str = Field(min_length=1, max_length=100, strict=True)
    status: Literal['open', 'partial', 'filled', 'cancelled', 'expired', 'rejected']
    filled_quantity: int = Field(ge=0, le=5, strict=True)
    limit_price: str = Field(min_length=1, max_length=30, strict=True, pattern=r'^\d+(?:\.\d+)?$')

    @field_validator('limit_price')
    @classmethod
    def price_cents(cls, value):
        if engine.cents(value) <= 0:
            raise ValueError('A positive unit price is required')
        return value


class Audit(Payload):
    tick: int = Field(ge=0, strict=True)
    engine_version: int = Field(ge=1, strict=True)
    observation_token: str | None = Field(default=None, min_length=64, max_length=64, strict=True, pattern=r'^[0-9a-f]{64}$', exclude_if=lambda value: value is None)
    orders: list[AuditOrder] = Field(max_length=2)
    session_fees: str = Field(min_length=1, max_length=30, strict=True, pattern=r'^\d+(?:\.\d+)?$')
    price_limit_guarantees_fill: bool = Field(strict=True)
    no_order_reason: Literal['no_thesis_supplied', 'current_ask_above_cap'] | None

    @field_validator('session_fees')
    @classmethod
    def fee_cents(cls, value):
        engine.cents(value)
        return value


class Review(runs.Command):
    audit: Audit


def require_current(run):
    position = run.state_json['position']
    tasks = run.snapshot_json['tasks']
    if run.status != 'active' or run.purpose != 'practice' or position >= len(tasks) or tasks[position]['type'] != 'simulation':
        raise HTTPException(409, 'Bind or review only the current active simulation step')
    evidence = {r['step_id']: r for r in run.state_json['responses']}
    if any(not evidence.get(t['id'], {}).get('correct') for t in tasks[:position]):
        raise HTTPException(409, 'Complete the earlier learning steps first')


def policy_for(run, session):
    opening = {**session.snapshot_json, 'tick': 0}
    return {**public_binding(run.snapshot_json['simulation_binding']),
            'run_id': run.id, 'session_id': session.id, 'content_version': run.content_version,
            'rubric_version': run.snapshot_json['rubric_version'],
            'unit_price_cap': engine.quote(opening, 'NORTH')['ask']}


def validate_market_data(state, binding):
    try:
        for field in ('prices', 'liquidity'):
            series = state.get(field)
            if not isinstance(series, dict) or set(series) != set(engine.SYMBOLS):
                raise ValueError
            for values in series.values():
                if not isinstance(values, list) or len(values) != binding['ticks']:
                    raise ValueError
                if field == 'prices':
                    if any(type(value) not in (str, int, float) or engine.cents(value) <= 0 for value in values):
                        raise ValueError
                elif any(type(value) is not int or value < 0 for value in values):
                    raise ValueError
        for symbol in engine.SYMBOLS:
            engine.quote(state, symbol)
            engine.quote({**state, 'tick': 0}, symbol)
    except (ValueError, InvalidOperation):
        raise HTTPException(409, 'Invalid bound market data') from None


async def validate_session(request, db, user, session, mutation=False):
    policy = session.snapshot_json.get('bound_policy')
    linked = await db.scalar(select(LearningRun).where(LearningRun.user_id == user.id, LearningRun.state_json['simulation_session_id'].as_string() == session.id))
    if policy is None and linked is None:
        return None
    if not isinstance(policy, dict) or linked is None or linked.id != policy.get('run_id') or linked.user_id != user.id or session.user_id != user.id:
        raise HTTPException(409, 'Invalid reciprocal learning-session binding')
    runs.pinned_publication(request, linked)
    binding = linked.snapshot_json.get('simulation_binding')
    state = session.snapshot_json
    if not binding or session.mode != 'guided' or session.version != binding['engine_version'] or state.get('version') != binding['engine_version'] or engine.VERSION != binding['engine_version']:
        raise HTTPException(409, 'Unsupported bound engine version')
    if session.scenario_kind != binding['kind'] or state.get('kind') != binding['kind']:
        raise HTTPException(409, 'Invalid bound scenario')
    if type(state.get('tick')) is not int or not 0 <= state['tick'] <= binding['max_tick']:
        raise HTTPException(409, 'Invalid bound observation tick')
    validate_market_data(state, binding)
    if json.dumps(policy, sort_keys=True) != json.dumps(policy_for(linked, session), sort_keys=True):
        raise HTTPException(409, 'Invalid pinned simulation policy')
    if mutation:
        require_current(linked)
        if state['finished']:
            raise HTTPException(409, 'This bound session is finished')
    return linked


def restrict(state, operation, payload):
    policy = state['bound_policy']
    if operation == 'debrief':
        raise HTTPException(409, 'Finish this bound session through its graded learning audit')
    if operation == 'advance' and (payload['steps'] > policy['max_advance'] or state['tick'] + payload['steps'] > policy['max_tick']):
        raise HTTPException(422, 'Advance at most two observations without exceeding the final tick')
    if operation == 'order':
        if len(state['orders']) >= policy['max_orders']:
            raise HTTPException(422, 'This lesson allows at most two orders, including cancelled orders')
        if (payload['symbol'], payload['side'], payload['type']) != (policy['symbol'], policy['side'], policy['order_type']) or payload['quantity'] > policy['max_quantity']:
            raise HTTPException(422, 'Use only NORTH buy limits of at most five units in this lesson')
        try:
            if engine.cents(payload['price']) > engine.cents(policy['unit_price_cap']):
                raise HTTPException(422, 'The unit price exceeds the opening-ask cap, before fees')
        except engine.SimulationError as exc:
            raise HTTPException(422, str(exc)) from None


async def bound_run(request, db, user, run_id, active=False):
    run = await runs.owned_run(db, user, run_id)
    runs.pinned_publication(request, run)
    if 'simulation_binding' not in run.snapshot_json:
        raise HTTPException(409, 'This run has no simulation binding')
    if active:
        require_current(run)
    return run


async def linked_session(request, db, user, run, mutation=False):
    sid = run.state_json.get('simulation_session_id')
    if not sid:
        raise HTTPException(409, 'Bind the current simulation step first')
    session = await api.owned(db, user, sid)
    linked = await validate_session(request, db, user, session, mutation)
    if linked is None or linked.id != run.id:
        raise HTTPException(409, 'Invalid reciprocal learning-session binding')
    return session


@router.post('/{run_id}/simulation', operation_id='bindLearningSimulation')
async def bind(run_id: str, body: runs.Command, request: Request, db: DB, user: User):
    digest, previous = await runs.replay(db, user, body, 'simulation:bind', run_id)
    if previous is not None:
        return previous
    run = await bound_run(request, db, user, run_id, active=True)
    from app.gameplay import ChapterAccess
    if not await db.get(ChapterAccess, (user.id, run.module_id)):
        await api.require_access(request, db, user, 'guided')
    binding = run.snapshot_json['simulation_binding']
    if binding['engine_version'] != engine.VERSION:
        raise HTTPException(409, 'Unsupported bound engine version')
    if run.state_json.get('simulation_session_id'):
        session = await linked_session(request, db, user, run, mutation=True)
    else:
        existing = await db.scalar(select(SimulationSession.id).where(SimulationSession.user_id == user.id, SimulationSession.snapshot_json['bound_policy']['run_id'].as_string() == run.id))
        if existing is not None:
            raise HTTPException(409, 'Invalid reciprocal learning-session binding')
        session = await api.create_session(db, user, kind=binding['kind'], ticks=binding['ticks'])
        session.snapshot_json = {**deepcopy(session.snapshot_json), 'bound_policy': policy_for(run, session)}
        run.state_json = {**deepcopy(run.state_json), 'simulation_session_id': session.id}
    result = api.response(session)
    db.add(LearningRunCommand(user_id=user.id, key=body.idempotency_key, run_id=run.id, request_hash=digest, response=result))
    await db.flush()
    return result


@router.get('/{run_id}/simulation', operation_id='resumeLearningSimulation')
async def resume(run_id: str, request: Request, db: DB, user: User):
    run = await bound_run(request, db, user, run_id)
    return api.response(await linked_session(request, db, user, run))


def audit_issues(audit, state):
    policy = state['bound_policy']
    actual = state['orders']
    claimed = {o.order_id: o for o in audit.orders}
    issues = []
    if len(claimed) != len(audit.orders) or set(claimed) != {o['id'] for o in actual}:
        issues.append({'code': 'order_set', 'message': 'Report every recorded order exactly once, including cancelled or unfilled orders; do not add orders that were not placed.', 'expected': [o['id'] for o in actual]})
    if audit.price_limit_guarantees_fill:
        issues.append({'code': 'limit_guarantee', 'message': 'A buy limit caps the unit price before fees; it does not guarantee execution or a full fill.', 'expected': False})
    if engine.cents(audit.session_fees) != engine.cents(state['fees']):
        issues.append({'code': 'session_fees', 'message': 'Report the total fees recorded for this session, not an estimated fee or the unit-price cap.', 'expected': engine.money(state['fees'])})
    for order in actual:
        claim = claimed.get(order['id'])
        if claim is not None:
            for code, submitted, expected, message in (
                ('order_status', claim.status, order['status'], 'Use the currently recorded status, before finishing cancels any pending remainder.'),
                ('filled_quantity', claim.filled_quantity, order['filled'], 'Filled quantity is the executed quantity, not the requested quantity or pending remainder.'),
                ('unit_price', engine.cents(claim.limit_price), engine.cents(order['price']), 'Report the submitted limit price, not the current quote or a fill price.'),
            ):
                if submitted != expected:
                    issues.append({'code': code, 'order_id': order['id'], 'message': message, 'expected': engine.money(expected) if code == 'unit_price' else expected})
        if (order['symbol'], order['side'], order['type']) != ('NORTH', 'buy', 'limit') or order['quantity'] > policy['max_quantity'] or engine.cents(order['price']) > engine.cents(policy['unit_price_cap']):
            issues.append({'code': 'order_policy', 'order_id': order['id'], 'message': 'The recorded order does not respect this lesson policy; it cannot earn completion.', 'expected': {'symbol': 'NORTH', 'side': 'buy', 'type': 'limit', 'max_quantity': policy['max_quantity'], 'unit_price_cap': policy['unit_price_cap']}})
    if actual:
        if audit.no_order_reason is not None:
            issues.append({'code': 'no_order_reason_with_orders', 'message': 'A no-order reason applies only when no orders were placed. Audit all recorded orders instead, even if none filled.', 'expected': None})
        if len(actual) > policy['max_orders']:
            issues.append({'code': 'order_count', 'message': 'The recorded session exceeds the lesson order cap; it cannot earn completion.', 'expected': policy['max_orders']})
    else:
        current_ask = engine.quote(state, 'NORTH')['ask']
        above_cap = engine.cents(current_ask) > engine.cents(policy['unit_price_cap'])
        if audit.no_order_reason == 'no_thesis_supplied':
            if policy['investment_thesis_supplied'] is not False:
                issues.append({'code': 'no_thesis_not_supported', 'message': 'The no-thesis reason requires a case that supplies no investment thesis.', 'observed': {'investment_thesis_supplied': policy['investment_thesis_supplied']}})
        elif audit.no_order_reason == 'current_ask_above_cap':
            if not above_cap:
                issues.append({'code': 'current_ask_not_above_cap', 'message': 'The current NORTH ask is not above the unit-price cap. Compare the current ask, not the midpoint or an earlier observation.', 'observed': {'current_ask': current_ask, 'unit_price_cap': policy['unit_price_cap']}})
        else:
            supported = (['no_thesis_supplied'] if policy['investment_thesis_supplied'] is False else []) + (['current_ask_above_cap'] if above_cap else [])
            issues.append({'code': 'no_order_reason_required', 'message': 'With no recorded orders, select a supported reason for observing. This case supplies no investment thesis; an above-cap reason requires the current ask to exceed the cap.', 'expected': supported})
    return issues


@router.post('/{run_id}/simulation/review', operation_id='reviewLearningSimulation')
async def review(run_id: str, body: Review, request: Request, db: DB, user: User):
    digest, previous = await runs.replay(db, user, body, 'simulation:review', run_id)
    if previous is not None:
        return previous
    run = await bound_run(request, db, user, run_id, active=True)
    session = await linked_session(request, db, user, run, mutation=True)
    simulation = deepcopy(session.snapshot_json)
    audit = body.audit
    if audit.tick != simulation['tick'] or audit.engine_version != simulation['version'] or audit.observation_token != api.observation_token(engine.public_view(simulation)):
        raise HTTPException(409, 'The audit is stale; reload the current simulation observations')
    if simulation['tick'] < simulation['bound_policy']['min_observe']:
        raise HTTPException(409, 'Observe at least ten steps before submitting an audit')
    issues = audit_issues(audit, simulation)
    correct = not issues
    state = deepcopy(run.state_json)
    task = run.snapshot_json['tasks'][state['position']]
    evidence = {'step_id': task['id'], 'answer': {'audit': audit.model_dump()}, 'correct': correct}
    state['responses'].append(evidence)
    state['first_responses'].setdefault(task['id'], deepcopy(evidence))
    state['feedback'] = [{'step_id': task['id'], 'correct': correct, 'explanation': task['explanation'], 'issues': issues, 'audited_observation': deepcopy(audit.model_dump()), 'observation_phase': 'before_finish_cancellation'}]
    if correct:
        summary = 'Learner-selected structured facts and reason (not a free-text reasoning-quality assessment): ' + json.dumps(audit.model_dump(), sort_keys=True)
        simulation['audited_observation'] = deepcopy(audit.model_dump())
        engine.finish(simulation, summary)
        session.snapshot_json = simulation
        session.updated_at = now()
        state['position'] += 1
        await runs.finish_run(db, user, run, state)
    run.state_json = state
    await db.flush()
    return await runs.remember(db, user, body, digest, run)
