from copy import deepcopy
from dataclasses import dataclass
from datetime import date, timedelta, timezone
import hashlib
import json
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import Field
from sqlalchemy import or_, select

from app.db import LearningActivity, MasteredModule, RewardCommand, RewardGrant, XPLedger, aware, now
from app.learning import DB, User, Payload, catalog

router = APIRouter(prefix='/api/me')

FOUNDATIONS_MODULE_IDS = (
    'm01-money-before-markets',
    'm02-how-markets-work',
    'm03-investment-products',
    'm04-building-a-portfolio',
)
CORE_MODULE_IDS = FOUNDATIONS_MODULE_IDS + (
    'm05-safe-execution',
    'm06-managing-risk',
    'm07-making-decisions',
    'm08-psychology-and-protection',
    'm09-integrated-simulation',
)


@dataclass(frozen=True)
class RewardDefinition:
    id: str
    kind: Literal['badge', 'avatar', 'title']
    name: str
    visual_key: str
    criterion: str
    event_prefix: str | None = None
    module_ids: tuple[str, ...] = ()
    rule_version: str = '1'


REWARD_POLICY = (
    RewardDefinition('badge-first-lesson', 'badge', 'First lesson', 'badge.first_lesson', 'At least one recorded lesson check with positive learning XP.', event_prefix='lesson:'),
    RewardDefinition('badge-foundations', 'badge', 'Foundations complete', 'badge.foundations', 'Recorded mastery checks for all four foundation modules.', module_ids=FOUNDATIONS_MODULE_IDS),
    RewardDefinition('badge-core', 'badge', 'Core learning complete', 'badge.core', 'Recorded mastery checks for all nine core modules.', module_ids=CORE_MODULE_IDS),
    RewardDefinition('badge-first-review', 'badge', 'First review', 'badge.first_review', 'At least one recorded delayed review with positive learning XP.', event_prefix='review:'),
    RewardDefinition('avatar-compass', 'avatar', 'Compass', 'avatar.compass', 'At least one recorded lesson check with positive learning XP.', event_prefix='lesson:'),
    RewardDefinition('title-foundations-complete', 'title', 'Foundations complete', 'title.foundations_complete', 'Recorded mastery checks for all four foundation modules.', module_ids=FOUNDATIONS_MODULE_IDS),
)


class RewardPayload(Payload):
    idempotency_key: str = Field(min_length=8, max_length=100, pattern=r'^[a-zA-Z0-9_-]+$')


class Claim(RewardPayload):
    item_id: str = Field(min_length=1, max_length=120)


class Equipment(RewardPayload):
    avatar_id: str | None = Field(default=None, min_length=1, max_length=120)
    title_id: str | None = Field(default=None, min_length=1, max_length=120)


def public_definition(item):
    criteria = {'description': item.criterion}
    if item.module_ids:
        criteria['mastered_module_ids'] = list(item.module_ids)
    else:
        criteria.update({'positive_xp_event_prefix': item.event_prefix, 'minimum_events': 1})
    return {'id': item.id, 'kind': item.kind, 'name': item.name, 'visual_key': item.visual_key, 'rule_version': item.rule_version, 'criteria': criteria}


def owned_item(grant):
    return {**deepcopy(grant.public_snapshot), 'id': grant.item_id, 'rule_version': grant.rule_version, 'status': 'owned', 'evidence': deepcopy(grant.evidence), 'created_at': aware(grant.created_at).isoformat()}


def equipment_data(user):
    return {'avatar_id': user.equipped_avatar_id, 'title_id': user.equipped_title_id}


async def learning_evidence(db, user_id):
    events = (await db.scalars(select(XPLedger).where(XPLedger.user_id == user_id, XPLedger.amount > 0, or_(XPLedger.event_key.startswith('lesson:'), XPLedger.event_key.startswith('review:'))).order_by(XPLedger.created_at, XPLedger.event_key))).all()
    mastery = (await db.scalars(select(MasteredModule).where(MasteredModule.user_id == user_id))).all()
    return events, {entry.module_id: entry for entry in mastery}


def qualifying_evidence(item, events, mastery):
    if item.module_ids:
        if not all(module_id in mastery for module_id in item.module_ids):
            return []
        return [{'type': 'recorded_mastery_check', 'module_id': module_id, 'attempt_id': mastery[module_id].attempt_id} for module_id in item.module_ids]
    event = next((entry for entry in events if entry.event_key.startswith(item.event_prefix)), None)
    return [{'type': 'rewarded_learning_event', 'event_key': event.event_key}] if event else []


async def replay(db, user, body, operation, target):
    encoded = json.dumps({'operation': operation, 'target': target, 'payload': body.model_dump(exclude={'idempotency_key'}, exclude_unset=True)}, sort_keys=True, separators=(',', ':'))
    digest = hashlib.sha256(encoded.encode()).hexdigest()
    command = await db.get(RewardCommand, (user.id, body.idempotency_key))
    if command and command.request_hash != digest:
        raise HTTPException(409, 'This idempotency key was already used for a different reward command')
    return digest, deepcopy(command.response) if command else None


async def remember(db, user, body, digest, response):
    db.add(RewardCommand(user_id=user.id, key=body.idempotency_key, request_hash=digest, response=deepcopy(response)))
    await db.flush()
    return response


@router.get('/rewards')
async def inventory(db: DB, user: User):
    grants = {grant.item_id: grant for grant in (await db.scalars(select(RewardGrant).where(RewardGrant.user_id == user.id))).all()}
    events, mastery = await learning_evidence(db, user.id)
    items = []
    for item in REWARD_POLICY:
        grant = grants.pop(item.id, None)
        if grant:
            items.append(owned_item(grant))
        else:
            eligible = bool(qualifying_evidence(item, events, mastery))
            items.append({**public_definition(item), 'status': 'eligible' if eligible else 'locked', 'evidence': [], 'created_at': None})
    items.extend(owned_item(grants[item_id]) for item_id in sorted(grants))
    return {'items': items, 'equipment': equipment_data(user)}


@router.post('/rewards/claims')
async def claim(body: Claim, request: Request, db: DB, user: User):
    digest, previous = await replay(db, user, body, 'claim', body.item_id)
    if previous is not None:
        return previous
    grant = await db.get(RewardGrant, (user.id, body.item_id))
    if grant is None:
        item = next((item for item in REWARD_POLICY if item.id == body.item_id), None)
        if item is None:
            raise HTTPException(404, 'Reward item not found')
        catalog(request)
        events, mastery = await learning_evidence(db, user.id)
        evidence = qualifying_evidence(item, events, mastery)
        if not evidence:
            raise HTTPException(403, 'The recorded learning criteria for this reward are not met')
        grant = RewardGrant(user_id=user.id, item_id=item.id, rule_version=item.rule_version, public_snapshot=public_definition(item), evidence=evidence, created_at=now())
        db.add(grant)
    return await remember(db, user, body, digest, {'item': owned_item(grant)})


@router.patch('/rewards/equipment')
async def equip(body: Equipment, db: DB, user: User):
    digest, previous = await replay(db, user, body, 'equip', 'profile-equipment')
    if previous is not None:
        return previous
    await db.refresh(user)
    slots = body.model_dump(exclude={'idempotency_key'}, exclude_unset=True)
    requested_ids = {item_id for item_id in slots.values() if item_id is not None}
    grants = {grant.item_id: grant for grant in (await db.scalars(select(RewardGrant).where(RewardGrant.user_id == user.id, RewardGrant.item_id.in_(requested_ids)))).all()} if requested_ids else {}
    for slot, item_id in slots.items():
        if item_id is None:
            continue
        grant = grants.get(item_id)
        if grant is None:
            raise HTTPException(403, 'Only owned reward items can be equipped')
        if grant.public_snapshot['kind'] != slot.removesuffix('_id'):
            raise HTTPException(422, 'The reward item does not match this equipment slot')
    for slot, item_id in slots.items():
        setattr(user, 'equipped_' + slot, item_id)
    return await remember(db, user, body, digest, {'equipment': equipment_data(user)})


@router.get('/activity')
async def activity(db: DB, user: User, start_date: date | None = None, end_date: date | None = None):
    today = aware(now()).astimezone(timezone.utc).date()
    end = end_date or today
    start = start_date or date.fromordinal(max(1, end.toordinal() - 29))
    length = (end - start).days + 1
    if length < 1 or length > 366:
        raise HTTPException(422, 'Request an ordered calendar window of at most 366 days')
    recorded = list((await db.scalars(select(LearningActivity.day).where(LearningActivity.user_id == user.id).order_by(LearningActivity.day))).all())
    days = {date.fromisoformat(day) for day in recorded}
    longest = streak = 0
    previous = None
    for day in sorted(days):
        streak = streak + 1 if previous is not None and (day - previous).days == 1 else 1
        longest = max(longest, streak)
        previous = day
    current = 0
    cursor = today if today in days else today - timedelta(days=1)
    while cursor in days:
        current += 1
        cursor -= timedelta(days=1)
    calendar = [{'date': (start + timedelta(days=offset)).isoformat(), 'active': start + timedelta(days=offset) in days} for offset in range(length)]
    return {'basis': 'days with rewarded learning events', 'timezone': 'UTC', 'start_date': start.isoformat(), 'end_date': end.isoformat(), 'days': calendar, 'current_streak_days': current, 'longest_streak_days': longest}
