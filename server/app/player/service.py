"""Player profile, ownership, login streak, collection, shop and leaderboards."""

from datetime import date, timedelta

from fastapi import HTTPException
from sqlalchemy import func, select

from app.campaign.models import BossResult, CampaignProgress
from app.campaign.progress import load_progress
from app.db import LearningActivity, Profile, XPLedger, aware
from app.game.models import GameParticipant
from app.multiplayer import elo
from app.multiplayer.models import Rating
from app.player import badges, ledger
from app.player.levels import level_for, rank_name
from app.quiz.models import QuizAttempt

LOGIN_DOUBLOONS = (20, 20, 20, 30, 30, 30, 50)
LOGIN_XP = (10, 10, 10, 10, 20, 20, 20)
DEFAULT_AVATAR = 'avatar-starter-1'
LEADERBOARD_SIZE = 50


def cycle_day(streak):
    return (streak - 1) % 7 + 1


def streak_state(wallet, instant):
    """(streak days alive, claimed today, cycle day of today's claim)."""
    days = badges.streak_days(wallet, instant)
    claimed = bool(wallet and wallet.login_last_day == ledger.day(instant))
    return days, claimed, cycle_day(days) if claimed else days % 7 + 1


async def ownership(db, content, user_id, level):
    """Item id -> owned-since (None for items everyone owns)."""
    owned = await ledger.owned(db, user_id)
    for item_id in content.cosmetics.starters():
        owned.setdefault(item_id, None)
    for item in content.cosmetics.rank_titles():
        if level >= item['level']:
            owned.setdefault(item['id'], None)
    for item in content.cosmetics.of('theme'):
        if item['source'] == 'free':
            owned.setdefault(item['id'], None)
    return owned


def unlocks(progress):
    chapters = progress.campaign.chapters
    return {'daily': progress.won(chapters[0]['id'], 'boss'),
            'ranked': len(chapters) >= 3 and progress.won(chapters[2]['id'], 'boss')}


def equipped_badge(content, profile):
    badge = content.cosmetics.items.get(profile.equipped_badge_id)
    return {'id': badge['id'], 'name': badge['name']} if badge and badge['kind'] == 'badge' else None


async def player_data(db, content, profile):
    instant = ledger.current()
    xp = await ledger.total_xp(db, profile.id)
    level, into, needed = level_for(xp)
    wallet = await ledger.read_account(db, profile.id)
    days, claimed, cycle = streak_state(wallet, instant)
    progress = await load_progress(db, content.campaign, profile.id)
    title = content.cosmetics.items.get(profile.equipped_title_id)
    return {
        'id': profile.id, 'display_name': profile.display_name, 'avatar_id': profile.equipped_avatar_id or DEFAULT_AVATAR,
        'avatar_image': content.cosmetics.image(profile.equipped_avatar_id or DEFAULT_AVATAR),
        'badge': equipped_badge(content, profile),
        'title_id': profile.equipped_title_id, 'title': title['name'] if title else rank_name(level), 'level': level,
        'rank_name': rank_name(level), 'xp': xp, 'xp_into_level': into, 'xp_for_next_level': needed,
        'wallet': {'doubloons': ledger.doubloons(wallet, instant), 'doubloons_week_ends_at': ledger.week_ends_at(instant).isoformat(),
                   'gems': wallet.premium_balance if wallet else 0},
        'streak': {'days': days, 'claimed_today': claimed, 'cycle_day': cycle},
        'unlocks': unlocks(progress), 'leaderboard_opt_in': profile.leaderboard_opt_in,
    }


async def update(db, content, profile, changes):
    level = level_for(await ledger.total_xp(db, profile.id))[0]
    owned = await ownership(db, content, profile.id, level)
    if 'display_name' in changes:
        if changes['display_name'] is None:
            raise HTTPException(422, 'Display name cannot be empty')
        profile.display_name = changes['display_name']
    if 'avatar_id' in changes:
        avatar = content.cosmetics.items.get(changes['avatar_id'])
        if changes['avatar_id'] is None or not avatar or avatar['kind'] != 'avatar':
            raise HTTPException(422, 'Choose one of the avatars in the collection')
        if avatar['id'] not in owned:
            raise HTTPException(403, 'You have not unlocked this avatar yet')
        profile.equipped_avatar_id = avatar['id']
    if 'title_id' in changes:
        title = content.cosmetics.items.get(changes['title_id']) if changes['title_id'] else None
        if changes['title_id'] and (not title or title['kind'] != 'title'):
            raise HTTPException(422, 'Choose one of the titles in the collection')
        if title and title['id'] not in owned:
            raise HTTPException(403, 'You have not unlocked this title yet')
        profile.equipped_title_id = title['id'] if title else None
    if 'badge_id' in changes:
        badge_id = changes['badge_id']
        badge = content.cosmetics.items.get(badge_id) if badge_id is not None else None
        if badge_id is not None and (not badge or badge['kind'] != 'badge'):
            raise HTTPException(422, 'Choose one of the badges in the collection')
        if badge and badge_id not in owned:
            raise HTTPException(403, 'You have not earned this badge yet')
        profile.equipped_badge_id = badge_id
    if 'leaderboard_opt_in' in changes:
        if changes['leaderboard_opt_in'] is None:
            raise HTTPException(422, 'Choose whether to appear on leaderboards')
        profile.leaderboard_opt_in = changes['leaderboard_opt_in']
    await db.flush()


async def claim_login(db, content, profile):
    instant = ledger.current()
    today = ledger.day(instant)
    wallet = await ledger.account(db, profile.id, instant)
    if wallet.login_last_day == today:
        claimed = await ledger.event(db, profile.id, f'login:{today}')
        return {'day': cycle_day(wallet.login_streak), 'doubloons': claimed.stocks_delta if claimed else 0,
                'xp': claimed.context.get('xp', 0) if claimed else 0, 'already_claimed': True}
    yesterday = ledger.day(instant - timedelta(days=1))
    streak = wallet.login_streak + 1 if wallet.login_last_day == yesterday else 1
    day = cycle_day(streak)
    stocks, xp = LOGIN_DOUBLOONS[day - 1], LOGIN_XP[day - 1]
    await ledger.credit(db, profile.id, f'login:{today}', instant, stocks=stocks, context={'streak': streak, 'xp': xp})
    wallet.login_last_day, wallet.login_streak = today, streak
    xp = await ledger.award_xp(db, profile.id, f'login:{today}', xp, f'Login streak day {day}', instant)
    await ledger.record_activity(db, profile.id, instant)
    await db.flush()
    await badges.award(db, content, profile.id, instant)
    return {'day': day, 'doubloons': stocks, 'xp': xp, 'already_claimed': False}


async def activity(db, profile):
    """Days with recorded activity; each counts its XP events (at least 1)."""
    instant = ledger.current()
    first = ledger.day(instant - timedelta(days=364))
    days = set(await db.scalars(select(LearningActivity.day).where(LearningActivity.user_id == profile.id, LearningActivity.day >= first)))
    counts = {}
    for created_at in await db.scalars(select(XPLedger.created_at).where(XPLedger.user_id == profile.id,
                                                                         XPLedger.created_at >= ledger.day_start(first))):
        key = ledger.day(aware(created_at))
        counts[key] = counts.get(key, 0) + 1
    wallet = await ledger.read_account(db, profile.id)
    streak, claimed, cycle = streak_state(wallet, instant)
    start = date.fromisoformat(ledger.day(instant)) - timedelta(days=cycle - 1)
    week = []
    for index in range(7):
        current = (start + timedelta(days=index)).isoformat()
        done = bool(wallet and wallet.login_last_day and streak and current <= wallet.login_last_day)
        week.append({'date': current, 'claimed': done, 'xp': LOGIN_XP[index], 'doubloons': LOGIN_DOUBLOONS[index]})
    return {'days': [{'date': key, 'count': max(1, counts.get(key, 0))} for key in sorted(days | set(counts))],
            'streak_days': streak, 'week': week}


def _how(item):
    return item.get('how') or item.get('description', '')


async def collection(db, content, profile):
    instant = ledger.current()
    xp = await ledger.total_xp(db, profile.id)
    level = level_for(xp)[0]
    owned = await ownership(db, content, profile.id, level)
    values = await badges.stats(db, content, profile.id, instant)
    standing = badges.standing(content, values)
    badge_list = []
    for item in content.cosmetics.of('badge'):
        key = item['id'].removeprefix('badge-')
        earned_at = owned.get(item['id'])
        badge_list.append({'id': item['id'], 'name': item['name'], 'description': item['description'], 'earned': item['id'] in owned,
                           'equipped': item['id'] == profile.equipped_badge_id,
                           'earned_at': aware(earned_at).isoformat() if earned_at else None,
                           'progress': None if item['id'] in owned else standing.get(key, (False, None))[1]})
    equipped = {profile.equipped_avatar_id or DEFAULT_AVATAR, profile.equipped_title_id}

    def entries(kind):
        return [{'id': item['id'], 'name': item['name'], 'image': item.get('image'), 'owned': item['id'] in owned,
                 'equipped': item['id'] in equipped, 'how': _how(item)} for item in content.cosmetics.of(kind)]
    progress = await load_progress(db, content.campaign, profile.id)
    levels = [level['id'] for chapter in content.campaign.chapters for level in chapter['levels']]
    profits = [row for row in await db.scalars(select(CampaignProgress.best_profit).where(CampaignProgress.user_id == profile.id))]
    profits += [row for row in await db.scalars(select(BossResult.best_profit).where(BossResult.user_id == profile.id))]
    profits = [float(value) for value in profits if value is not None]
    return {
        'badges': badge_list, 'avatars': entries('avatar'), 'titles': entries('title'),
        'stats': {
            'levels_done': sum(progress.star(level_id, 'normal') for level_id in levels),
            'stars': sum(progress.stars(chapter) for chapter in content.campaign.chapters),
            'bosses_won': sum(progress.won(chapter['id'], 'boss') for chapter in content.campaign.chapters),
            'quizzes_passed': await db.scalar(select(func.count()).select_from(QuizAttempt).where(
                QuizAttempt.user_id == profile.id, QuizAttempt.room_id.is_(None), QuizAttempt.passed.is_(True))),
            'matches_played': await db.scalar(select(func.count()).select_from(GameParticipant).where(
                GameParticipant.user_id == profile.id, GameParticipant.result.is_not(None))),
            'best_profit': max(profits) if profits else None,
        },
    }


async def shop(db, content, profile):
    level = level_for(await ledger.total_xp(db, profile.id))[0]
    owned = await ownership(db, content, profile.id, level)
    return {'items': [{'id': item['id'], 'kind': item['kind'], 'name': item['name'], 'description': _how(item),
                       'currency': item['price']['currency'], 'price': item['price']['amount'], 'owned': item['id'] in owned,
                       'weekly': item['source'] == 'weekly'} for item in content.cosmetics.shop()]}


async def purchase(db, content, profile, item_id):
    item = content.cosmetics.items.get(item_id)
    if item is None or 'price' not in item:
        raise HTTPException(404, 'That item is not in the shop')
    instant = ledger.current()
    if item_id in await ledger.owned(db, profile.id):
        raise HTTPException(409, 'You already own this item')
    wallet = await ledger.account(db, profile.id, instant)
    currency, price = item['price']['currency'], item['price']['amount']
    balance = wallet.stocks_balance if currency == 'stocks' else wallet.premium_balance
    if balance < price:
        name = 'Doubloons' if currency == 'stocks' else 'Gems'
        raise HTTPException(409, f'You need {price - balance} more {name} for this item')
    await ledger.credit(db, profile.id, f'purchase:{item_id}', instant, stocks=-price if currency == 'stocks' else 0,
                        gems=-price if currency == 'gems' else 0, context={'item_id': item_id})
    await ledger.grant(db, profile.id, item_id, content.cosmetics, [{'purchase': currency, 'price': price}], instant)


def _ranked(rows, value_of):
    entries, previous, rank = [], None, 0
    for index, row in enumerate(rows, 1):
        if value_of(row) != previous:
            rank, previous = index, value_of(row)
        entries.append((rank, row))
    return entries


async def xp_leaderboard(db, content, profile):
    totals = func.coalesce(func.sum(XPLedger.amount), 0).label('xp')
    rows = (await db.execute(select(Profile, totals).outerjoin(XPLedger, XPLedger.user_id == Profile.id)
                             .where(Profile.leaderboard_opt_in.is_(True)).group_by(Profile.id).order_by(totals.desc(), Profile.id))).all()
    ranked = _ranked(rows, lambda row: row[1])
    mine = await ledger.total_xp(db, profile.id)
    return {'entries': [{'rank': rank, 'name': person.display_name, 'avatar_id': person.equipped_avatar_id or DEFAULT_AVATAR,
                         'badge': equipped_badge(content, person),
                         'level': level_for(xp)[0], 'value': xp, 'is_me': person.id == profile.id}
                        for rank, (person, xp) in ranked[:LEADERBOARD_SIZE]],
            'me': {'rank': next((rank for rank, (person, _) in ranked if person.id == profile.id), None), 'value': mine}}


async def ranked_leaderboard(db, content, profile):
    rows = (await db.execute(select(Profile, Rating).join(Rating, Rating.user_id == Profile.id)
                             .where(Profile.leaderboard_opt_in.is_(True)).order_by(Rating.rating.desc(), Profile.id))).all()
    ranked = _ranked(rows, lambda row: row[1].rating)
    people = [person.id for _, (person, _) in ranked[:LEADERBOARD_SIZE]]
    xp = dict((await db.execute(select(XPLedger.user_id, func.sum(XPLedger.amount)).where(XPLedger.user_id.in_(people))
                                .group_by(XPLedger.user_id))).all()) if people else {}
    mine = await db.get(Rating, profile.id)
    return {'entries': [{'rank': rank, 'name': person.display_name, 'avatar_id': person.equipped_avatar_id or DEFAULT_AVATAR,
                         'badge': equipped_badge(content, person),
                         'level': level_for(xp.get(person.id, 0))[0], 'value': rating.rating, 'tier': elo.tier(rating.rating),
                         'is_me': person.id == profile.id} for rank, (person, rating) in ranked[:LEADERBOARD_SIZE]],
            'me': {'rank': next((rank for rank, (person, _) in ranked if person.id == profile.id), None),
                   'value': mine.rating if mine else elo.START}}
