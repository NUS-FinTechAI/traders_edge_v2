from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.db import AggregateEvent, LearningActivity, LessonCompletion, MasteredModule, ReviewItem, XPLedger, now


async def progress(db, user_id):
    completed = set((await db.scalars(select(LessonCompletion.lesson_id).where(LessonCompletion.user_id == user_id))).all())
    mastered = set((await db.scalars(select(MasteredModule.module_id).where(MasteredModule.user_id == user_id))).all())
    xp = await db.scalar(select(func.coalesce(func.sum(XPLedger.amount), 0)).where(XPLedger.user_id == user_id))
    return completed, mastered, xp


def require_module(module, modules, mastered):
    earlier = [m['id'] for m in modules if m['order'] < module['order']]
    missing = [m for m in earlier if m not in mastered]
    if missing:
        raise HTTPException(403, {'message': 'Complete the earlier module mastery checks first', 'prerequisite_module_ids': missing})


async def reward(db, profile, event_key, amount, reason):
    if await db.get(XPLedger, (profile.id, event_key)):
        return 0
    db.add(XPLedger(user_id=profile.id, event_key=event_key, amount=amount, reason=reason))
    day = now().date().isoformat()
    if not await db.get(LearningActivity, (profile.id, day)):
        db.add(LearningActivity(user_id=profile.id, day=day))
    if profile.analytics_opt_in:
        insert = {'sqlite': sqlite_insert, 'postgresql': postgresql_insert}[db.get_bind().dialect.name]
        statement = insert(AggregateEvent).values(day=day, kind='learning_completed', count=1)
        await db.execute(statement.on_conflict_do_update(
            index_elements=[AggregateEvent.day, AggregateEvent.kind],
            set_={'count': AggregateEvent.count + 1}))
    await db.flush()
    return amount


async def record_lesson(db, profile, lesson_id, attempt_id, review_after_days=1):
    if await db.get(LessonCompletion, (profile.id, lesson_id)):
        return 0
    db.add(LessonCompletion(user_id=profile.id, lesson_id=lesson_id, attempt_id=attempt_id))
    db.add(ReviewItem(user_id=profile.id, lesson_id=lesson_id, due_at=now() + timedelta(days=review_after_days)))
    return await reward(db, profile, 'lesson:' + lesson_id, 20, 'Passed lesson reasoning check')
