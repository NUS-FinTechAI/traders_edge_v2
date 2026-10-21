"""The 16 process badges (game-spec §B6). Conditions are described to players in cosmetics.json."""

from datetime import timedelta

from sqlalchemy import func, or_, select

from app.campaign.models import BossResult, CampaignProgress
from app.campaign.progress import boss_key
from app.db import RewardGrant
from app.game.models import Game, GameOrder, GameParticipant
from app.player import ledger
from app.quiz.models import QuizAttempt

QUICK_LEARNER_LEVELS = 10
SNIPER_ORDERS = 5
STREAK_DAYS = 30
QUIZ_MASTER_QUIZZES = 10
RANKED_MATCHES = 5
CALIBRATION_ANSWERS = 20
CALIBRATION_RATE = 0.85


async def _count(db, query):
    return await db.scalar(select(func.count()).select_from(query.subquery()))


async def quick_learner(db, user_id):
    return await _count(db, select(CampaignProgress.level_id).where(
        CampaignProgress.user_id == user_id, CampaignProgress.check_done, CampaignProgress.check_total > 0,
        CampaignProgress.check_first_try == CampaignProgress.check_total))


def _finished(current):
    """Settled participants, plus the one being settled now (its result is stored after the hook returns)."""
    return or_(GameParticipant.result.is_not(None), GameParticipant.id == current) if current else GameParticipant.result.is_not(None)


async def sniper(db, user_id, current=None):
    return await _count(db, select(GameOrder.id).join(GameParticipant, GameParticipant.id == GameOrder.participant_id).where(
        GameParticipant.user_id == user_id, _finished(current), GameOrder.type == 'limit', GameOrder.cancelled_tick.is_(None)))


async def quiz_master(db, user_id):
    return await _count(db, select(QuizAttempt.id).where(QuizAttempt.user_id == user_id, QuizAttempt.room_id.is_(None),
                                                         QuizAttempt.status == 'complete', QuizAttempt.total > 0,
                                                         QuizAttempt.score == QuizAttempt.total))


async def ranked_matches(db, user_id, current=None):
    return await _count(db, select(GameParticipant.id).join(Game, Game.id == GameParticipant.game_id).where(
        GameParticipant.user_id == user_id, Game.mode == 'ranked', _finished(current), GameParticipant.forfeited.is_(False)))


async def calibration(db, user_id):
    sure = correct = 0
    for answers in await db.scalars(select(QuizAttempt.answers).where(QuizAttempt.user_id == user_id, QuizAttempt.room_id.is_(None))):
        for answer in answers.values():
            if answer.get('confidence') == 'sure':
                sure += 1
                correct += bool(answer['correct'])
    return sure, correct


def streak_days(wallet, instant):
    if wallet is None or wallet.login_last_day is None:
        return 0
    yesterday = ledger.day(instant - timedelta(days=1))
    return wallet.login_streak if wallet.login_last_day >= yesterday else 0


async def stats(db, content, user_id, instant, current=None):
    """Counters behind badge progress; `current` counts a participant whose result is being settled."""
    levels = {row.level_id: row for row in await db.scalars(select(CampaignProgress).where(CampaignProgress.user_id == user_id))}
    bosses = {(row.chapter_id, row.kind): row for row in await db.scalars(select(BossResult).where(BossResult.user_id == user_id))}
    sure, correct = await calibration(db, user_id)
    return {
        'levels': levels, 'bosses': bosses,
        'quick_learner': await quick_learner(db, user_id), 'sniper': await sniper(db, user_id, current),
        'quiz_master': await quiz_master(db, user_id), 'ranked': await ranked_matches(db, user_id, current),
        'sure': sure, 'sure_correct': correct, 'streak': streak_days(await ledger.read_account(db, user_id), instant),
    }


def _won(stats, chapter_id, kind):
    row = stats['bosses'].get((chapter_id, kind))
    return bool(row and row.won)


def _special(stats, item_id):
    row = stats['levels'].get(item_id)
    return bool(row and row.special_star)


def standing(content, stats):
    """Map badge key -> (earned now, progress text or None) for badges that depend only on saved records."""
    chapters = content.campaign.chapters
    first_level = chapters[0]['levels'][0]['id']
    third = chapters[2]['id'] if len(chapters) >= 3 else None
    first = stats['levels'].get(first_level)
    bosses_won = sum(_won(stats, chapter['id'], 'boss') for chapter in chapters)
    sure = stats['sure']
    return {
        'first-steps': (bool(first and first.normal_star), None),
        'quick-learner': (stats['quick_learner'] >= QUICK_LEARNER_LEVELS, f'{min(stats["quick_learner"], QUICK_LEARNER_LEVELS)}/{QUICK_LEARNER_LEVELS}'),
        'chart-reader': (bool(third) and _won(stats, third, 'boss'), None),
        'sniper': (stats['sniper'] >= SNIPER_ORDERS, f'{min(stats["sniper"], SNIPER_ORDERS)}/{SNIPER_ORDERS}'),
        'explorer': (any(all(_special(stats, level['id']) for level in chapter['levels']) and _special(stats, boss_key(chapter))
                         for chapter in chapters), None),
        'gatecrasher': (any(row.won for (_, kind), row in stats['bosses'].items() if kind == 'gate'), None),
        'boss-slayer': (bosses_won == len(chapters), f'{bosses_won}/{len(chapters)}'),
        'streak-master': (stats['streak'] >= STREAK_DAYS, f'{min(stats["streak"], STREAK_DAYS)}/{STREAK_DAYS}'),
        'quiz-master': (stats['quiz_master'] >= QUIZ_MASTER_QUIZZES, f'{min(stats["quiz_master"], QUIZ_MASTER_QUIZZES)}/{QUIZ_MASTER_QUIZZES}'),
        'ranked-debut': (stats['ranked'] >= RANKED_MATCHES, f'{min(stats["ranked"], RANKED_MATCHES)}/{RANKED_MATCHES}'),
        'calibrated': (sure >= CALIBRATION_ANSWERS and stats['sure_correct'] >= CALIBRATION_RATE * sure,
                       f'{min(sure, CALIBRATION_ANSWERS)}/{CALIBRATION_ANSWERS} Sure answers'),
    }


def _orders_before_sale_ok(orders):
    """Every buy after a sale is no larger than the buy before it; needs at least one such buy."""
    previous_buy, sold, checked = None, False, 0
    for order in orders:
        if order.side == 'sell':
            sold = True
            continue
        if sold and previous_buy is not None:
            if order.qty > previous_buy:
                return False
            checked += 1
        previous_buy, sold = order.qty, False
    return checked > 0


def standing_orders(orders):
    """Orders that were not cancelled on the tick they were placed."""
    return [order for order in orders if order.cancelled_tick is None or order.cancelled_tick > order.tick]


def match_badges(game, participant, result, orders, ticks):
    """Badges judged on the match being settled. None needs a profit-ranked win."""
    finished = not result['forfeited']
    stats = result['stats']
    orders = standing_orders(orders)
    bought = {order.symbol for order in orders if order.side == 'buy'}
    stopped = {order.symbol for order in orders if order.type == 'stop'}
    kept_plan = bool(result.get('plan_review') and result['plan_review']['kept_loss_limit'])
    scenario = game.scenario_id
    earned = set()
    if finished and participant.plan and stats['trades'] >= 1:
        earned.add('first-plan')
    if finished and bought and bought <= stopped and stats['max_drawdown_pct'] <= 2:
        earned.add('risk-manager')
    if finished and ('chop' in scenario or 'range' in scenario) and stats['trades'] >= 3 and stats['fees'] < 30:
        earned.add('fee-fighter')
    if finished and len(orders) >= 3 and _orders_before_sale_ok(orders):
        earned.add('cool-head')
    if finished and orders and kept_plan and all(order.tick >= 0.4 * ticks for order in orders):
        earned.add('patient-trader')
    return earned


async def award(db, content, user_id, instant, match=None, current=None):
    """Grant every newly earned badge. `match` is the set from match_badges for the game being settled."""
    owned = set(await db.scalars(select(RewardGrant.item_id).where(RewardGrant.user_id == user_id, RewardGrant.item_id.like('badge-%'))))
    values = await stats(db, content, user_id, instant, current)
    earned = {key for key, (done, _) in standing(content, values).items() if done} | (match or set())
    rewards = []
    for key in sorted(earned):
        item_id = 'badge-' + key
        if item_id in owned or item_id not in content.cosmetics.items:
            continue
        reward = await ledger.grant(db, user_id, item_id, content.cosmetics, [{'badge': key}], instant)
        rewards.append({'id': reward['id'], 'name': reward['name']})
    return rewards
