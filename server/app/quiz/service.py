"""Quiz topics, attempts with shuffled options, first-answer-final grading, XP and classroom rooms."""

import random

from fastapi import HTTPException
from sqlalchemy import func, select

from app.campaign.progress import load_progress
from app.codes import new_code, normalise
from app.db import Profile
from app.player import badges, ledger
from app.quiz.models import QuizAttempt, QuizRoom, QuizRoomMember

SIZES = {'chapter': 10, 'review': 5, 'mixed': 20}
PASS_PERCENT = 80
XP = {'chapter': 20, 'review': 10, 'mixed': 50}
MISSED_WEIGHT = 3
shuffle = random.SystemRandom()


def topic_kind(topic_id):
    if topic_id == 'daily-review':
        return 'review'
    if topic_id == 'mixed':
        return 'mixed'
    return 'chapter'


def chapter_number(campaign, topic_id):
    number = topic_id.removeprefix('chapter-')
    if not topic_id.startswith('chapter-') or not number.isdigit() or not 1 <= int(number) <= len(campaign.chapters):
        raise HTTPException(404, 'Quiz topic not found')
    return int(number)


def topic_title(campaign, topic_id):
    kind = topic_kind(topic_id)
    if kind == 'review':
        return 'Daily Review'
    if kind == 'mixed':
        return 'Mixed Mastery'
    number = chapter_number(campaign, topic_id)
    return f'Chapter {number}: {campaign.chapters[number - 1]["title"]}'


def require_topic(content, topic_id):
    topic_title(content.campaign, topic_id)


def topic_size(content, topic_id, chapters):
    kind = topic_kind(topic_id)
    pool = len(content.quiz.chapter(chapter_number(content.campaign, topic_id))) if kind == 'chapter' else \
        sum(len(content.quiz.chapter(number)) for number in chapters)
    return min(SIZES[kind], pool)


def unlocked_chapters(progress):
    return [chapter['number'] for chapter in progress.campaign.chapters if progress.unlocked(chapter)]


def _weighted_sample(questions, weights, count):
    chosen, pool = [], list(zip(questions, weights))
    while pool and len(chosen) < count:
        pick = shuffle.uniform(0, sum(weight for _, weight in pool))
        for index, (question, weight) in enumerate(pool):
            pick -= weight
            if pick <= 0 or index == len(pool) - 1:
                chosen.append(question)
                pool.pop(index)
                break
    return chosen


def _interleaved(groups, count):
    for group in groups:
        shuffle.shuffle(group)
    chosen = []
    while len(chosen) < count and any(groups):
        for group in groups:
            if group and len(chosen) < count:
                chosen.append(group.pop())
    return chosen


async def missed_concepts(db, content, user_id):
    missed = {}
    for answers in await db.scalars(select(QuizAttempt.answers).where(QuizAttempt.user_id == user_id)):
        for question_id, answer in answers.items():
            item = content.quiz.questions.get(question_id)
            if item and not answer['correct']:
                for concept in item['concepts']:
                    missed[concept] = missed.get(concept, 0) + 1
    return missed


async def pick_questions(db, content, user_id, topic_id, chapters):
    kind = topic_kind(topic_id)
    if kind == 'chapter':
        pool = content.quiz.chapter(chapter_number(content.campaign, topic_id))
        return shuffle.sample(pool, min(SIZES[kind], len(pool)))
    if kind == 'mixed':
        return _interleaved([list(content.quiz.chapter(number)) for number in chapters], SIZES[kind])
    missed = await missed_concepts(db, content, user_id)
    pool = [item for number in chapters for item in content.quiz.chapter(number)]
    weights = [1 + MISSED_WEIGHT * sum(missed.get(concept, 0) > 0 for concept in item['concepts']) for item in pool]
    return _weighted_sample(pool, weights, SIZES[kind])


def available(content, attempt):
    """The attempt's items whose question (and every option) is still in the bank; removed questions are skipped."""
    entries = []
    for entry in attempt.items:
        item = content.quiz.questions.get(entry['question_id'])
        if item and set(entry['options']) <= {option['id'] for option in item['options']}:
            entries.append((entry, item))
    return entries


def attempt_view(content, attempt):
    questions = []
    entries = available(content, attempt)
    for entry, item in entries:
        options = {option['id']: option for option in item['options']}
        answer = attempt.answers.get(item['id'])
        questions.append({'id': item['id'], 'prompt': item['prompt'], 'options': [options[key] for key in entry['options']],
                          'answered': None if answer is None else {'option_id': answer['option_id'], 'correct': answer['correct'],
                                                                   'correct_option_id': item['answer'], 'explanation': item['explanation']}})
    total = attempt.total if attempt.status == 'complete' else len(entries)
    return {'id': attempt.id, 'title': topic_title(content.campaign, attempt.topic_id), 'room_id': attempt.room_id, 'status': attempt.status,
            'questions': questions, 'score': attempt.score, 'total': total, 'passed': attempt.passed, 'xp': attempt.xp}


async def topics(db, content, profile):
    progress = await load_progress(db, content.campaign, profile.id)
    chapters = unlocked_chapters(progress)
    attempts = list(await db.scalars(select(QuizAttempt).where(QuizAttempt.user_id == profile.id, QuizAttempt.room_id.is_(None),
                                                               QuizAttempt.status == 'complete')))
    today = ledger.day(ledger.current())
    entries = []
    ids = [f'chapter-{chapter["number"]}' for chapter in content.campaign.chapters] + ['daily-review', 'mixed']
    for topic_id in ids:
        mine = [a for a in attempts if a.topic_id == topic_id]
        kind = topic_kind(topic_id)
        locked = kind == 'chapter' and chapter_number(content.campaign, topic_id) not in chapters
        passed = any(ledger.day(a.completed_at) == today for a in mine) if kind == 'review' else any(a.passed for a in mine)
        entries.append({'id': topic_id, 'kind': kind, 'title': topic_title(content.campaign, topic_id),
                        'questions': topic_size(content, topic_id, chapters), 'locked': locked, 'passed': passed,
                        'best': max((a.score for a in mine), default=None)})
    return {'topics': entries, 'rooms': await my_rooms(db, profile)}


async def start(db, content, profile, topic_id, room_code):
    room = None
    if room_code:
        room = await db.scalar(select(QuizRoom).where(QuizRoom.code == normalise(room_code)))
        if room is None:
            raise HTTPException(404, 'No quiz room has that code')
        if topic_id and topic_id != room.topic_id:
            raise HTTPException(422, 'This room uses a different quiz topic')
        if await db.get(QuizRoomMember, (room.id, profile.id)) is None:
            db.add(QuizRoomMember(room_id=room.id, user_id=profile.id, joined_at=ledger.current()))
        existing = await db.scalar(select(QuizAttempt).where(QuizAttempt.room_id == room.id, QuizAttempt.user_id == profile.id))
        if existing:
            return existing
        topic_id = room.topic_id
        chapters = [chapter['number'] for chapter in content.campaign.chapters]
    else:
        if not topic_id:
            raise HTTPException(422, 'Choose a quiz topic or enter a room code')
        progress = await load_progress(db, content.campaign, profile.id)
        chapters = unlocked_chapters(progress)
        require_topic(content, topic_id)
        if topic_kind(topic_id) == 'chapter' and chapter_number(content.campaign, topic_id) not in chapters:
            raise HTTPException(403, 'Unlock this chapter to take its quiz')
    questions = await pick_questions(db, content, profile.id, topic_id, chapters)
    if not questions:
        raise HTTPException(409, 'There are no questions for this quiz yet')
    items = []
    for item in questions:
        order = [option['id'] for option in item['options']]
        shuffle.shuffle(order)
        items.append({'question_id': item['id'], 'options': order})
    attempt = QuizAttempt(user_id=profile.id, topic_id=topic_id, room_id=room.id if room else None, bank_version=content.quiz.version,
                          items=items, answers={}, status='active', score=0, total=len(items), xp=0, created_at=ledger.current())
    db.add(attempt)
    await db.flush()
    return attempt


async def owned_attempt(db, profile, attempt_id, lock=False):
    query = select(QuizAttempt).where(QuizAttempt.id == attempt_id, QuizAttempt.user_id == profile.id)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    attempt = await db.scalar(query)
    if attempt is None:
        raise HTTPException(404, 'Quiz attempt not found')
    return attempt


async def answer(db, content, profile, attempt_id, body):
    attempt = await owned_attempt(db, profile, attempt_id, lock=True)
    if not any(entry['question_id'] == body.question_id for entry in attempt.items):
        raise HTTPException(404, 'That question is not part of this quiz')
    entries = available(content, attempt)
    entry = next((entry for entry, _ in entries if entry['question_id'] == body.question_id), None)
    if entry is None:
        raise HTTPException(409, 'This question is no longer available')
    if body.option_id not in entry['options']:
        raise HTTPException(422, 'That option is not part of this question')
    previous = attempt.answers.get(body.question_id)
    if previous is not None:
        if previous['option_id'] != body.option_id:
            raise HTTPException(409, 'Your first answer to this question is final')
        return attempt
    correct = body.option_id == content.quiz.questions[body.question_id]['answer']
    attempt.answers = {**attempt.answers, body.question_id: {'option_id': body.option_id, 'correct': correct, 'confidence': body.confidence}}
    attempt.score += int(correct)
    if all(item['id'] in attempt.answers for _, item in entries):
        attempt.total = len(entries)
        await complete(db, content, profile, attempt)
    await db.flush()
    return attempt


async def complete(db, content, profile, attempt):
    instant = ledger.current()
    kind = topic_kind(attempt.topic_id)
    attempt.status, attempt.completed_at = 'complete', instant
    attempt.passed = None if kind == 'review' else 100 * attempt.score >= PASS_PERCENT * attempt.total
    if attempt.room_id is not None:
        return
    key = {'chapter': f'quiz-pass:{attempt.topic_id}', 'mixed': 'quiz-pass:mixed', 'review': f'quiz-review:{ledger.day(instant)}'}[kind]
    if kind == 'review' or attempt.passed:
        attempt.xp = await ledger.award_xp(db, profile.id, key, XP[kind], f'Quiz: {topic_title(content.campaign, attempt.topic_id)}', instant)
    await ledger.record_activity(db, profile.id, instant)
    await db.flush()
    await badges.award(db, content, profile.id, instant)


async def create_room(db, content, profile, body):
    require_topic(content, body.topic_id)
    room = QuizRoom(code=await new_code(db, QuizRoom), host_user_id=profile.id, topic_id=body.topic_id, title=body.title,
                    created_at=ledger.current())
    db.add(room)
    await db.flush()
    return room


async def _members(db, room_id):
    return await db.scalar(select(func.count()).select_from(QuizRoomMember).where(QuizRoomMember.room_id == room_id))


async def summary(db, room, profile):
    return {'id': room.id, 'title': room.title, 'code': room.code, 'is_host': room.host_user_id == profile.id,
            'members': await _members(db, room.id)}


async def my_rooms(db, profile):
    joined = select(QuizRoomMember.room_id).where(QuizRoomMember.user_id == profile.id)
    rooms = await db.scalars(select(QuizRoom).where((QuizRoom.host_user_id == profile.id) | QuizRoom.id.in_(joined))
                             .order_by(QuizRoom.created_at.desc()))
    return [await summary(db, room, profile) for room in rooms]


async def room_view(db, content, profile, room_id):
    room = await db.get(QuizRoom, room_id)
    is_member = room is not None and await db.get(QuizRoomMember, (room.id, profile.id)) is not None
    if room is None or not (is_member or room.host_user_id == profile.id):
        raise HTTPException(404, 'Quiz room not found')
    rows = (await db.execute(select(Profile, QuizAttempt).join(QuizRoomMember, QuizRoomMember.user_id == Profile.id)
                             .outerjoin(QuizAttempt, (QuizAttempt.room_id == room.id) & (QuizAttempt.user_id == Profile.id))
                             .where(QuizRoomMember.room_id == room.id).order_by(QuizRoomMember.joined_at, Profile.id))).all()
    total = topic_size(content, room.topic_id, [chapter['number'] for chapter in content.campaign.chapters])
    results = [{'name': person.display_name, 'score': attempt.score if attempt and attempt.status == 'complete' else None,
                'total': attempt.total if attempt else total, 'finished': bool(attempt and attempt.status == 'complete')}
               for person, attempt in rows if room.host_user_id == profile.id or person.id == profile.id]
    mine = next((attempt.id for person, attempt in rows if person.id == profile.id and attempt), None)
    return {**await summary(db, room, profile), 'topic_title': topic_title(content.campaign, room.topic_id), 'results': results,
            'my_attempt_id': mine}
