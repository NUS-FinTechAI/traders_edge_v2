from copy import deepcopy

from fastapi import APIRouter, HTTPException, Request
from pydantic import ValidationError
from sqlalchemy import or_, select

from app import learning_runs as runs
from app.api_schemas.scenario_set_schema import ReviewScenarioCase, ScenarioCaseSummary, ScenarioSessionResponse, ScenarioSetResponse
from app.api_schemas.simulation_schema import BindLearningSimulation
from app.db import LearningRun, LearningRunCommand, SimulationSession, now
from app.learning import DB, User, catalog
from app.progression import progress
from app.simulation import api, engine
from app.simulation.bindings import SCENARIO_SET_BINDING

router = APIRouter()
CASE_IDS = tuple(SCENARIO_SET_BINDING['case_ids'])


def reverse_links(session_id):
    return or_(*(LearningRun.state_json['scenario_sessions'][identifier].as_string() == session_id for identifier in CASE_IDS))


def policy(binding):
    return {'id': binding['id'], 'engine_version': binding['engine_version'],
            'provenance': binding['provenance'], 'total_cases': len(binding['case_ids']),
            'brief': 'This fictional account has no supplied investment thesis. Trading is optional. Each actual order needs a prior written plan, at most five units, a declared loss boundary no greater than 100 units, and at most ten held units plus pending buys per asset. These case constraints are not investment recommendations or guaranteed loss limits.',
            'total_ticks': binding['ticks'], 'max_advance': binding['max_advance'],
            'max_order_quantity': binding['max_order_quantity'], 'max_asset_units': binding['max_asset_units'],
            'max_planned_loss': binding['max_planned_loss'],
            'investment_thesis_supplied': binding['investment_thesis_supplied'],
            'grade_basis': 'Accurate observed records and compliance with this fictional case\'s size and declared-loss constraints; no profit, trade-count or free-text reasoning grade.'}


def state_for(run):
    state = run.state_json
    sessions, reviews = state.get('scenario_sessions'), state.get('scenario_reviews')
    if not isinstance(sessions, dict) or not isinstance(reviews, dict):
        raise HTTPException(409, 'Invalid saved scenario-set state')
    expected = CASE_IDS[:len(reviews)]
    if set(reviews) != set(expected) or len(reviews) > 4 or any(identifier not in CASE_IDS for identifier in sessions):
        raise HTTPException(409, 'Invalid saved scenario-set sequence')
    if any(not isinstance(value, str) or not value for value in sessions.values()) or len(set(sessions.values())) != len(sessions):
        raise HTTPException(409, 'Invalid saved scenario-set links')
    if set(sessions) not in (set(expected), set(CASE_IDS[:min(len(reviews) + 1, 4)])):
        raise HTTPException(409, 'Invalid saved scenario-set links')
    try:
        for identifier in expected:
            summary = ScenarioCaseSummary.model_validate(reviews[identifier])
            if summary.case_id != identifier or summary.session_id != sessions[identifier]:
                raise ValueError
    except (ValidationError, ValueError, KeyError):
        raise HTTPException(409, 'Invalid saved scenario review') from None
    return state


def current_case(run):
    count = len(state_for(run)['scenario_reviews'])
    return CASE_IDS[count] if count < len(CASE_IDS) else None


def session_policy(run, session, identifier):
    return {**policy(run.snapshot_json['scenario_set_binding']), 'run_id': run.id,
            'case_id': identifier, 'session_id': session.id, 'content_version': run.content_version,
            'rubric_version': run.snapshot_json['rubric_version']}


async def validate_session(request, db, user, session, linked, mutation=False):
    from app.simulation.lesson_api import require_current, validate_market_data
    saved = session.snapshot_json.get('scenario_set_policy')
    if not isinstance(saved, dict) or linked is None or 'bound_policy' in session.snapshot_json:
        raise HTTPException(409, 'Invalid reciprocal scenario-set binding')
    runs.pinned_publication(request, linked)
    state_for(linked)
    identifier = saved.get('case_id')
    binding = linked.snapshot_json.get('scenario_set_binding')
    if (not binding or identifier not in CASE_IDS or session.user_id != user.id
            or linked.user_id != user.id or linked.state_json['scenario_sessions'].get(identifier) != session.id
            or saved != session_policy(linked, session, identifier)):
        raise HTTPException(409, 'Invalid reciprocal scenario-set binding')
    form = next(form for form in linked.snapshot_json['scenario_forms'] if form['id'] == identifier)
    market = session.snapshot_json
    if (session.mode != 'guided' or session.version != binding['engine_version']
            or market.get('version') != binding['engine_version'] or engine.VERSION != binding['engine_version']
            or market.get('seed') != form['seed'] or market.get('kind') != form['kind']
            or session.scenario_kind != form['kind'] or type(market.get('tick')) is not int
            or not 0 <= market['tick'] < binding['ticks']):
        raise HTTPException(409, 'Invalid pinned scenario-set market')
    validate_market_data(market, binding)
    try:
        ScenarioSessionResponse.model_validate(api.response(session))
    except (ValidationError, engine.SimulationError, KeyError, TypeError):
        raise HTTPException(409, 'Invalid saved scenario-set observations') from None
    reviewed = identifier in linked.state_json['scenario_reviews']
    if market.get('finished') is not reviewed:
        raise HTTPException(409, 'The scenario-set review does not match the saved market')
    if mutation:
        require_current(linked)
        if reviewed or identifier != current_case(linked):
            raise HTTPException(409, 'Only the current unfinished path can change')
    return linked


def restrict(state, operation, payload):
    saved = state['scenario_set_policy']
    if operation == 'debrief':
        raise HTTPException(409, 'Review this path through the scenario-set audit')
    if operation == 'advance' and (payload['steps'] > saved['max_advance']
            or state['tick'] + payload['steps'] >= saved['total_ticks']):
        raise HTTPException(422, 'Advance within the current path and its final observation')
    if operation == 'order':
        if payload['quantity'] > saved['max_order_quantity']:
            raise HTTPException(422, 'This fictional brief allows at most five units per order')
        try:
            exceeds_loss = engine.cents(payload['plan']['max_loss']) > engine.cents(saved['max_planned_loss'])
        except engine.SimulationError as exc:
            raise HTTPException(422, str(exc)) from None
        if exceeds_loss:
            raise HTTPException(422, 'The declared loss boundary exceeds this fictional brief\'s 100-unit ceiling')
        if payload['side'] == 'buy':
            symbol = payload['symbol']
            held = state['positions'].get(symbol, {}).get('quantity', 0)
            pending = sum(order['remaining'] for order in state['orders'] if engine.pending(order)
                          and order['symbol'] == symbol and order['side'] == 'buy')
            if held + pending + payload['quantity'] > saved['max_asset_units']:
                raise HTTPException(422, 'Held units plus pending buys exceed this fictional brief\'s ten-unit asset ceiling')


async def owned_run(request, db, user, run_id, active=False):
    run = await runs.owned_run(db, user, run_id)
    runs.pinned_publication(request, run)
    if 'scenario_set_binding' not in run.snapshot_json:
        raise HTTPException(409, 'This run has no scenario-set binding')
    state_for(run)
    if active:
        from app.simulation.lesson_api import require_current
        require_current(run)
    return run


async def require_foundations(request, db, user):
    _, mastered, _ = await progress(db, user.id)
    required = [module['id'] for module in catalog(request)['modules'] if module['order'] <= 8]
    if len(required) != 8 or any(identifier not in mastered for identifier in required):
        raise HTTPException(403, {'message': 'Complete the first eight chapter mastery checks before this integrated practice',
                                 'prerequisite_module_ids': required})


async def linked_session(request, db, user, run, identifier, mutation=False):
    sid = run.state_json['scenario_sessions'].get(identifier)
    if not sid:
        raise HTTPException(409, 'Bind the current path before trading or reviewing')
    session = await api.owned(db, user, sid)
    await validate_session(request, db, user, session, run, mutation)
    return session


async def response(request, db, user, run):
    identifier = current_case(run)
    session = None
    if identifier and identifier in run.state_json['scenario_sessions']:
        session = api.response(await linked_session(request, db, user, run, identifier))
    return {'run': runs.run_data(run), 'policy': policy(run.snapshot_json['scenario_set_binding']),
            'current_case_id': identifier, 'session': session,
            'completed_cases': [deepcopy(run.state_json['scenario_reviews'][key]) for key in CASE_IDS if key in run.state_json['scenario_reviews']],
            'issues': deepcopy(run.state_json.get('scenario_issues', []))}


async def remember(db, user, body, digest, run, result):
    db.add(LearningRunCommand(user_id=user.id, key=body.idempotency_key, run_id=run.id, request_hash=digest, response=result))
    await db.flush()
    return result


@router.post('/{run_id}/scenario-set', operation_id='bindLearningScenarioSet', response_model=ScenarioSetResponse, response_model_exclude_unset=True)
async def bind(run_id: str, body: BindLearningSimulation, request: Request, db: DB, user: User):
    digest, previous = await runs.replay(db, user, body, 'scenario-set:bind', run_id)
    if previous is not None:
        return previous
    run = await owned_run(request, db, user, run_id, active=True)
    await require_foundations(request, db, user)
    identifier = current_case(run)
    if identifier is None:
        raise HTTPException(409, 'All paths have already been reviewed')
    if identifier in run.state_json['scenario_sessions']:
        await linked_session(request, db, user, run, identifier, mutation=True)
    else:
        existing = await db.scalar(select(SimulationSession.id).where(SimulationSession.user_id == user.id,
            SimulationSession.snapshot_json['scenario_set_policy']['run_id'].as_string() == run.id,
            SimulationSession.snapshot_json['scenario_set_policy']['case_id'].as_string() == identifier))
        if existing is not None:
            raise HTTPException(409, 'Invalid reciprocal scenario-set binding')
        form = next(form for form in run.snapshot_json['scenario_forms'] if form['id'] == identifier)
        binding = run.snapshot_json['scenario_set_binding']
        if binding['engine_version'] != engine.VERSION:
            raise HTTPException(409, 'Unsupported scenario-set engine version')
        session = await api.create_session(db, user, seed=form['seed'], kind=form['kind'], ticks=binding['ticks'])
        session.snapshot_json = {**deepcopy(session.snapshot_json), 'scenario_set_policy': session_policy(run, session, identifier)}
        state = deepcopy(run.state_json)
        state['scenario_sessions'][identifier] = session.id
        run.state_json = state
    result = await response(request, db, user, run)
    return await remember(db, user, body, digest, run, result)


@router.get('/{run_id}/scenario-set', operation_id='resumeLearningScenarioSet', response_model=ScenarioSetResponse, response_model_exclude_unset=True)
async def resume(run_id: str, request: Request, db: DB, user: User):
    return await response(request, db, user, await owned_run(request, db, user, run_id))


def audit_issues(audit, state):
    observed = engine.public_view(state)
    issues = []
    def mismatch(code, expected, submitted, message, order_id=None):
        if expected != submitted:
            issues.append({'code': code, 'message': message, 'expected': expected, **({'order_id': order_id} if order_id else {})})
    orders = {order.order_id: order for order in audit.orders}
    mismatch('order_set', sorted(order['id'] for order in observed['orders']), sorted(orders), 'Report every recorded order exactly once.')
    if len(orders) != len(audit.orders):
        issues.append({'code': 'duplicate_order', 'message': 'Report each order only once.'})
    for actual in observed['orders']:
        saved = state['scenario_set_policy']
        if (actual['quantity'] > saved['max_order_quantity']
                or not 0 < engine.cents(actual['plan']['max_loss']) <= engine.cents(saved['max_planned_loss'])
                or any(not isinstance(actual['plan'].get(field), str) or len(actual['plan'][field].strip()) < 12
                       for field in ('reason', 'risk', 'exit', 'size_reason'))):
            issues.append({'code': 'order_policy', 'order_id': actual['id'],
                           'message': 'The recorded order violates this fictional brief\'s quantity, declared-loss or prior-plan requirements; profit cannot remove the breach.'})
        claim = orders.get(actual['id'])
        if claim:
            for field, submitted, expected in (
                ('status', claim.status, actual['status']), ('requested_quantity', claim.requested_quantity, actual['quantity']),
                ('filled_quantity', claim.filled_quantity, actual['filled']), ('remaining_quantity', claim.remaining_quantity, actual['remaining'])):
                mismatch(field, expected, submitted, 'Reconcile the recorded order rather than treating a request or cancellation as a fill.', actual['id'])
    held = {symbol: 0 for symbol in engine.SYMBOLS}
    for fill in observed['fills']:
        held[fill['symbol']] += fill['quantity'] * (1 if fill['side'] == 'buy' else -1)
        if not 0 <= held[fill['symbol']] <= state['scenario_set_policy']['max_asset_units']:
            issues.append({'code': 'asset_units_policy', 'message': 'Recorded fills exceed the fictional held-unit ceiling; a profitable result cannot erase this constraint breach.'})
            break
    positions = {position.symbol: position.quantity for position in audit.positions}
    mismatch('positions', {position['symbol']: position['quantity'] for position in observed['positions']}, positions, 'Holdings come from actual fills; cancelled or unfilled requests are not holdings.')
    if len(positions) != len(audit.positions):
        issues.append({'code': 'duplicate_position', 'message': 'Report each held asset only once.'})
    for field, submitted, expected in (('cash', audit.cash, observed['cash']),
            ('session_fees', audit.session_fees, observed['fees']), ('benchmark_value', audit.benchmark_value, observed['benchmark_value'])):
        mismatch(field, expected, engine.money(submitted), 'Use the recorded cash, paid fees or same-period passive comparison, with their stated assumptions.')
    mismatch('benchmark_basis', True, audit.benchmark_is_gross, 'This fractional equal-value passive basket is gross of fees; it is not a like-for-like net performance grade.')
    mismatch('process_outcome', False, audit.profit_proves_process, 'Profit alone does not establish the quality of a decision or its prior plan.')
    mismatch('loss_guarantee', False, audit.planned_loss_is_guaranteed, 'A written loss boundary is an intention; changing quotes and gaps can produce a worse execution.')
    mismatch('no_order_reason', None if observed['orders'] else 'no_thesis_supplied', audit.no_order_reason,
             'With no orders, identify the case fact that no executable investment thesis is supplied. With recorded orders, audit them instead.')
    return issues


@router.post('/{run_id}/scenario-set/review', operation_id='reviewLearningScenarioCase', response_model=ScenarioSetResponse, response_model_exclude_unset=True)
async def review(run_id: str, body: ReviewScenarioCase, request: Request, db: DB, user: User):
    digest, previous = await runs.replay(db, user, body, 'scenario-set:review', run_id)
    if previous is not None:
        return previous
    run = await owned_run(request, db, user, run_id, active=True)
    identifier = current_case(run)
    if body.audit.case_id != identifier:
        raise HTTPException(409, 'Review only the current path')
    session = await linked_session(request, db, user, run, identifier, mutation=True)
    market = deepcopy(session.snapshot_json)
    audit = body.audit
    if (audit.tick != market['tick'] or audit.engine_version != market['version']
            or audit.observation_token != api.observation_token(engine.public_view(market))):
        raise HTTPException(409, 'The audit is stale; inspect the latest observed state')
    if market['tick'] != run.snapshot_json['scenario_set_binding']['ticks'] - 1:
        raise HTTPException(409, 'Observe this path through its final observation before the audit')
    issues = audit_issues(audit, market)
    state = deepcopy(run.state_json)
    task = run.snapshot_json['tasks'][state['position']]
    evidence = {'step_id': task['id'], 'answer': {'case_id': identifier, 'audit': audit.model_dump()}, 'correct': not issues}
    state['responses'].append(evidence)
    state['first_responses'].setdefault(task['id'], deepcopy(evidence))
    state.setdefault('scenario_first_responses', {}).setdefault(identifier, deepcopy(evidence))
    state['scenario_issues'] = issues
    state['feedback'] = [{'step_id': task['id'], 'correct': not issues, 'explanation': task['explanation'], 'issues': issues}]
    if not issues:
        observed = engine.public_view(market)
        state['scenario_reviews'][identifier] = {'case_id': identifier, 'session_id': session.id,
            'generator_profile': market['kind'], **{field: observed[field] for field in ('cash', 'equity', 'fees', 'benchmark_value', 'max_drawdown_percent')},
            'audit': deepcopy(audit.model_dump())}
        market['audited_observation'] = deepcopy(audit.model_dump())
        engine.finish(market, 'Learner-verified observed orders, holdings, cash, fees and comparison assumptions. This structured reconciliation does not grade reasoning quality or profit.')
        session.snapshot_json = market
        session.updated_at = now()
        if len(state['scenario_reviews']) == len(CASE_IDS):
            state['position'] += 1
            await runs.finish_run(db, user, run, state)
    run.state_json = state
    await db.flush()
    return await remember(db, user, body, digest, run, await response(request, db, user, run))
