"""Owned operational evidence export and separately gated study metadata."""
from copy import deepcopy
import hashlib
import json
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import Field, field_validator
from sqlalchemy import and_, or_, select

from app.db import Attempt, LearningRun, LearningRunCommand, aware, now
from app.learning import DB, Payload, User
from app.learning_runs import public_task
from app.research_models import ResearchCommand, ResearchParticipant
from app.simulation import engine

router = APIRouter(prefix='/api/me/research', tags=['owned research evidence'])
PriorKnowledge = Literal['unknown', 'none', 'some', 'experienced']
ExportKind = Literal['learning-runs', 'learning-attempts', 'ai-challenges']


class Command(Payload):
    idempotency_key: str = Field(min_length=8, max_length=100, pattern=r'^[a-zA-Z0-9_-]+$')


class Metadata(Command):
    prior_knowledge: PriorKnowledge


class Consent(Command):
    accepted: bool = Field(strict=True)
    policy_version: str = Field(min_length=1, max_length=80)
    policy_digest: str = Field(strict=True, min_length=64, max_length=64, pattern=r'^[0-9a-f]{64}$')

    @field_validator('accepted')
    @classmethod
    def explicit_acceptance(cls, value):
        if value is not True:
            raise ValueError('Explicit acceptance is required; use withdrawals to withdraw')
        return value


def study_policy(settings):
    version = getattr(settings, 'research_policy_version', None)
    content = getattr(settings, 'research_policy_text', None)
    available = bool(getattr(settings, 'research_enabled', False) and isinstance(version, str) and version.strip() and isinstance(content, str) and content.strip())
    return {'available': available, 'version': version if available else None, 'text': content if available else None,
            'policy_digest': hashlib.sha256(content.encode('utf-8')).hexdigest() if available else None}


def metadata_data(participant, settings):
    policy = study_policy(settings)
    return {
        'prior_knowledge': participant.prior_knowledge if participant else 'unknown',
        'first_prior_knowledge': participant.first_prior_knowledge if participant else None,
        'prior_knowledge_basis': 'self_reported_unvalidated',
        'consented': participant.consented if participant else False,
        'participation_active': bool(participant and participant.consented and policy['available'] and participant.consent_version == policy['version'] and participant.consent_text == policy['text']),
        'consent_version': participant.consent_version if participant else None,
        'consent_text': participant.consent_text if participant else None,
        'consented_at': aware(participant.consented_at).isoformat() if participant and participant.consented_at else None,
        'withdrawn_at': aware(participant.withdrawn_at).isoformat() if participant and participant.withdrawn_at else None,
        'study_policy': policy,
        'analytics_consent_is_separate': True,
        'withdrawal_effect': 'Stops study participation; existing operational records are retained. Account deletion and study retention rules require a separate approved policy.',
    }


async def mutation(db, user, body, operation, settings):
    digest = hashlib.sha256(json.dumps({'operation': operation, 'payload': body.model_dump(exclude={'idempotency_key'})}, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    command = await db.get(ResearchCommand, (user.id, body.idempotency_key))
    if command:
        if command.request_hash != digest:
            raise HTTPException(409, 'This key was already used for a different research metadata command')
        return deepcopy(command.response)
    policy = study_policy(settings)
    if operation == 'consent':
        if not policy['available']:
            raise HTTPException(409, 'Study enrollment is disabled or its approved policy is not configured')
        if body.policy_version != policy['version']:
            raise HTTPException(409, 'Accept the currently configured study policy version')
        if body.policy_digest != policy['policy_digest']:
            raise HTTPException(409, 'The study policy text changed; read and accept the current policy')
    participant = await db.scalar(select(ResearchParticipant).where(ResearchParticipant.user_id == user.id).with_for_update().execution_options(populate_existing=True))
    if participant is None:
        knowledge = body.prior_knowledge if operation == 'metadata' else 'unknown'
        participant = ResearchParticipant(user_id=user.id, first_prior_knowledge=body.prior_knowledge if operation == 'metadata' else None, prior_knowledge=knowledge, consented=False)
        db.add(participant)
    instant = now()
    if operation == 'metadata':
        participant.prior_knowledge = body.prior_knowledge
        if participant.first_prior_knowledge is None:
            participant.first_prior_knowledge = body.prior_knowledge
    elif operation == 'consent':
        if participant.consent_version == policy['version'] and participant.consent_text != policy['text']:
            raise HTTPException(409, 'Changed policy text requires a new policy version')
        if not participant.consented or participant.consent_version != policy['version']:
            participant.consented = True
            participant.consent_version = policy['version']
            participant.consent_text = policy['text']
            participant.consented_at = instant
    elif operation == 'withdrawal':
        if participant.consented:
            participant.consented = False
            participant.withdrawn_at = instant
    participant.updated_at = instant
    await db.flush()
    result = metadata_data(participant, settings)
    db.add(ResearchCommand(user_id=user.id, key=body.idempotency_key, request_hash=digest, response=deepcopy(result)))
    await db.flush()
    return result


@router.get('')
async def read_metadata(request: Request, db: DB, user: User):
    return metadata_data(await db.get(ResearchParticipant, user.id), request.app.state.settings)


@router.post('/metadata')
async def set_metadata(body: Metadata, request: Request, db: DB, user: User):
    return await mutation(db, user, body, 'metadata', request.app.state.settings)


@router.post('/consents')
async def consent(body: Consent, request: Request, db: DB, user: User):
    return await mutation(db, user, body, 'consent', request.app.state.settings)


@router.post('/withdrawals')
async def withdraw(body: Command, request: Request, db: DB, user: User):
    return await mutation(db, user, body, 'withdrawal', request.app.state.settings)


def fields(value, keys):
    return {key: deepcopy(value[key]) for key in keys if key in value and (value[key] is None or isinstance(value[key], (str, int, float, bool)))} if isinstance(value, dict) else {}


def answer(value):
    result = fields(value, ('acknowledged', 'option_id', 'confidence'))
    if isinstance(value, dict) and isinstance(value.get('assignments'), dict):
        result['assignments'] = {key: item for key, item in value['assignments'].items() if isinstance(key, str) and isinstance(item, str)}
    if isinstance(value, dict) and isinstance(value.get('audit'), dict):
        audit = value['audit']
        result['audit'] = fields(audit, ('tick', 'engine_version', 'observation_token', 'session_fees', 'price_limit_guarantees_fill', 'no_order_reason'))
        result['audit']['orders'] = [fields(order, ('order_id', 'filled_quantity', 'limit_price', 'status')) for order in audit.get('orders', []) if isinstance(order, dict)]
    return result


def learning_run_data(run, commands):
    state = run.state_json
    counts = {}
    responses = []
    for value in state.get('responses', []):
        step = value.get('step_id')
        counts[step] = counts.get(step, 0) + 1
        responses.append({'step_id': step, 'response_number': counts[step], 'first_response': counts[step] == 1, 'answer': answer(value.get('answer', {}))})
    observed_ids = {response['step_id'] for response in responses}
    tasks = run.snapshot_json.get('tasks', [])
    position = state.get('position', 0)
    if isinstance(position, int) and 0 <= position < len(tasks):
        observed_ids.add(tasks[position]['id'])
    observed = []
    for task in tasks:
        if task.get('id') in observed_ids:
            public = public_task(task)
            observed.append({**fields(public, ('id', 'type', 'prompt', 'text')), **{group: [fields(item, ('id', 'text')) for item in public[group]] for group in ('options', 'items', 'categories') if group in public}})
    result = fields(state.get('result'), ('attempt_id', 'passed', 'score_percent', 'critical_items_passed', 'xp_awarded')) if run.status == 'completed' else None
    return {'id': run.id, 'purpose': run.purpose, 'module_id': run.module_id, 'level_id': run.level_id, 'content_version': run.content_version, 'status': run.status,
            'created_at': aware(run.created_at).isoformat(), 'updated_at': aware(run.updated_at).isoformat(),
            'observed_tasks': observed, 'first_responses': {key: {'step_id': key, 'answer': answer(value.get('answer', {}))} for key, value in state.get('first_responses', {}).items()},
            'responses': responses, 'result': result,
            'command_timestamps': [{'recorded_at': aware(command.created_at).isoformat(), 'progress': fields(command.response.get('progress'), ('completed_steps', 'total_steps'))} for command in commands]}


def observation(value):
    result = fields(value, ('version', 'tick', 'total_ticks', 'scenario', 'finished', 'cash', 'available_cash', 'equity', 'fees', 'benchmark_value', 'max_drawdown_percent', 'reflection'))
    for group, keys in {
        'quotes': ('symbol', 'mid', 'bid', 'ask', 'available_units'),
        'positions': ('symbol', 'quantity', 'cost', 'realized', 'value', 'weight_percent'),
        'fills': ('order_id', 'symbol', 'side', 'quantity', 'price', 'fee', 'tick'),
        'orders': ('id', 'symbol', 'side', 'type', 'quantity', 'remaining', 'price', 'status', 'submitted_tick', 'triggered', 'filled', 'reason'),
    }.items():
        result[group] = []
        for entry in value.get(group, []):
            public = fields(entry, keys)
            if group == 'positions' and 'value' in public and 'cost' in public:
                public['unrealized_profit'] = engine.money(engine.amount(public['value']) - engine.amount(public['cost']))
            if group == 'orders':
                public['plan'] = fields(entry.get('plan'), ('reason', 'risk', 'exit', 'size_reason', 'max_loss'))
            result[group].append(public)
    tick = result.get('tick', -1)
    result['history'] = {symbol: [item for item in prices[:max(0, tick + 1)] if isinstance(item, str)] for symbol, prices in value.get('history', {}).items() if symbol in engine.SYMBOLS and isinstance(prices, list)}
    result['rules'] = fields(value.get('rules'), ('max_asset_weight_percent', 'shorting', 'leverage', 'fee_rate', 'first_fill_fee', 'spread_percent', 'settlement', 'benchmark'))
    return result


def decision_payload(payload):
    result = fields(payload, ('symbol', 'side', 'type', 'quantity', 'price', 'steps', 'reflection', 'order_id', 'expected_tick'))
    if isinstance(payload.get('plan'), dict):
        result['plan'] = fields(payload['plan'], ('reason', 'risk', 'exit', 'size_reason', 'max_loss'))
    return result


def challenge_data(attempt):
    snapshot = attempt.snapshot_json
    result = None
    if attempt.status == 'completed' and isinstance(attempt.result_json, dict):
        result = fields(attempt.result_json, ('win', 'profit', 'final_tick', 'policy_version'))
        result['leaderboard'] = [fields(item, ('participant_id', 'display_name', 'profit', 'final_value', 'fees', 'rank')) for item in attempt.result_json.get('leaderboard', [])]
    return {'id': attempt.id, 'challenge_id': attempt.challenge_id, 'attempt_number': attempt.attempt_number, 'first_attempt': attempt.attempt_number == 1,
            'mode': attempt.mode, 'module_id': attempt.module_id, 'version': attempt.version, 'status': attempt.status,
            'created_at': aware(attempt.created_at).isoformat(), 'updated_at': aware(attempt.updated_at).isoformat(),
            'policy': fields(snapshot.get('policy'), ('version', 'objective', 'difficulty', 'provenance', 'ticks', 'starting_value', 'profit', 'ties', 'liquidity', 'early_exit', 'resume')),
            'retry_context': fields(snapshot.get('research'), ('premium_retry', 'refresh_event_key', 'daily_date')),
            'events': [{'sequence': event.get('sequence'), 'attempt_number': event.get('attempt_number'), 'recorded_at': event.get('recorded_at'), 'operation': event.get('operation'),
                        'payload': decision_payload(event.get('payload', {})), 'before': observation(event.get('before', {})), 'after': observation(event.get('after', {}))} for event in snapshot.get('events', [])],
            'result': result}


@router.get('/export/{kind}')
async def export(kind: ExportKind, request: Request, response: Response, db: DB, user: User, cursor: str | None = Query(default=None, max_length=36), limit: int = Query(default=50, ge=1, le=100)):
    if kind == 'ai-challenges':
        from app.challenges.models import ChallengeAttempt
        model = ChallengeAttempt
    else:
        model = LearningRun if kind == 'learning-runs' else Attempt
    statement = select(model).where(model.user_id == user.id)
    if cursor:
        previous = await db.scalar(select(model).where(model.id == cursor, model.user_id == user.id))
        if previous is None:
            raise HTTPException(404, 'Export cursor not found in your records')
        statement = statement.where(or_(model.created_at > previous.created_at, and_(model.created_at == previous.created_at, model.id > previous.id)))
    rows = list(await db.scalars(statement.order_by(model.created_at, model.id).limit(limit + 1)))
    selected = rows[:limit]
    commands = {}
    if kind == 'learning-runs' and selected:
        for command in await db.scalars(select(LearningRunCommand).where(LearningRunCommand.user_id == user.id, LearningRunCommand.run_id.in_([row.id for row in selected])).order_by(LearningRunCommand.created_at, LearningRunCommand.key)):
            commands.setdefault(command.run_id, []).append(command)
    records = []
    for row in selected:
        if kind == 'learning-runs':
            records.append(learning_run_data(row, commands.get(row.id, [])))
        elif kind == 'ai-challenges':
            records.append(challenge_data(row))
        else:
            responses = [{'question_id': value.get('question_id'), **fields(value, ('option_id', 'confidence'))} if 'question_id' in value else {'step_id': value.get('step_id'), 'answer': answer(value.get('answer', {}))} for value in row.answers]
            records.append({'id': row.id, 'kind': row.kind, 'target_id': row.target_id, 'created_at': aware(row.created_at).isoformat(), 'answers': responses, 'reflection': row.reflection, 'score_percent': row.score, 'passed': row.result.get('passed', row.passed), 'run_id': row.result.get('run_id')})
    response.headers['Content-Disposition'] = f'attachment; filename="traders-edge-{kind}.json"'
    return {'format_version': 1, 'scope': 'your_operational_records', 'kind': kind, 'records': records,
            'next_cursor': selected[-1].id if len(rows) > limit else None,
            'assessment_limit': 'Operational evidence and self-reported metadata are not a validated learning rubric or approved study enrollment.'}
