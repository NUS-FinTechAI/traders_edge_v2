"""The settle_game hook: stars, boss results, unlocks, XP, currencies, Elo and badges for one human participant."""

from decimal import Decimal

from sqlalchemy import func, select

from app.campaign import daily
from app.campaign.progress import BOSS_XP, LEVEL_XP, PREVIEW_XP, boss_key, boss_row, load_progress, progress_row
from app.db import XPLedger
from app.economy_models import EconomyEvent
from app.game.models import GameEvent, GameOrder, GameParticipant
from app.game.scenario import load_scenarios
from app.multiplayer import elo
from app.player import badges, ledger

PRACTICE_XP = 10
PRACTICE_DAILY_CAP = 3
RANKED_XP = {'win': 20, 'loss': 10}
RANKED_GEMS = {'win': 15, 'loss': 5, 'first_win': 10}
RANKED_DAILY_CAP = 5


class Tally:
    def __init__(self):
        self.xp = self.stocks = self.gems = 0
        self.items = []

    def item(self, reward):
        if reward:
            self.items.append(reward)

    def rewards(self, badge_list):
        return {'xp': self.xp, 'stocks': self.stocks, 'gems': self.gems, 'items': self.items, 'badges': badge_list}


def missions_done(result, tier):
    missions = [mission for mission in result['missions'] if mission['tier'] == tier]
    return bool(missions) and all(mission['done'] for mission in missions)


def _profit(result):
    return Decimal(str(result['profit']))


def _record(row, result, played_field):
    profit = _profit(result)
    row.best_profit = profit if row.best_profit is None else max(row.best_profit, profit)
    setattr(row, played_field, getattr(row, played_field) + 1)


async def _stars(db, tally, user_id, key, normal, special, instant, xp_keys):
    """Raise stars, never lower them; award first-time XP for each newly earned star."""
    row = await progress_row(db, user_id, key)
    row.normal_star = row.normal_star or normal
    row.special_star = row.special_star or special
    if row.normal_star and xp_keys.get('normal'):
        tally.xp += await ledger.award_xp(db, user_id, xp_keys['normal'][0], xp_keys['normal'][1], 'Normal star', instant)
    if row.special_star and xp_keys.get('special'):
        tally.xp += await ledger.award_xp(db, user_id, xp_keys['special'][0], xp_keys['special'][1], 'Special star', instant)
    return row


async def _level(db, content, tally, user_id, game, result, instant):
    campaign = content.campaign
    level = campaign.level(game.level_id)
    row = await progress_row(db, user_id, game.level_id)
    _record(row, result, 'plays')
    row = await _stars(db, tally, user_id, game.level_id, row.check_done and missions_done(result, 'basic'), missions_done(result, 'bonus'),
                       instant, {'normal': (f'level-normal:{game.level_id}', LEVEL_XP['normal']),
                                 'special': (f'level-special:{game.level_id}', LEVEL_XP['special'])})
    if row.normal_star and 'reward' in level:
        tally.item(await ledger.grant(db, user_id, level['reward']['id'], content.cosmetics, [{'level_id': game.level_id}], instant))
    await db.flush()
    return {'normal': row.normal_star, 'special': row.special_star}, None


async def _boss(db, content, tally, user_id, game, result, instant):
    campaign = content.campaign
    chapter = campaign.chapter(game.chapter_id)
    before = await load_progress(db, campaign, user_id)
    was_unlocked = {item['id']: before.unlocked(item) for item in campaign.chapters}
    kind = {'preview': 'preview', 'final': 'boss', 'gate': 'gate'}[game.boss]
    row = await boss_row(db, user_id, chapter['id'], kind)
    _record(row, result, 'attempts')
    if kind == 'preview':
        # The Preview cannot be failed: `won` records that it was played to the last day, which opens Level 1.
        if not result['forfeited']:
            if not row.won:
                row.won, row.first_won_at = True, instant
            tally.xp += await ledger.award_xp(db, user_id, f'preview:{chapter["id"]}', PREVIEW_XP, 'Preview Battle played', instant)
        await db.flush()
        return None, None
    won = result['won']
    if won and not row.won:
        row.won, row.first_won_at = True, instant
    await db.flush()
    if won:
        tally.xp += await ledger.award_xp(db, user_id, f'{kind}-win:{chapter["id"]}', BOSS_XP, f'{kind.capitalize()} won', instant)
    if kind == 'gate':
        return None, {'chapter_id': chapter['id']} if won and not was_unlocked[chapter['id']] else None
    stars = await _stars(db, tally, user_id, boss_key(chapter), won, won and missions_done(result, 'bonus'), instant, {})
    _record(stars, result, 'plays')
    if won:
        tally.item(await ledger.grant(db, user_id, chapter['boss_reward']['id'], content.cosmetics, [{'boss': chapter['id']}], instant))
    title = content.cosmetics.boss_title(chapter['number'])
    if stars.special_star and title:
        tally.item(await ledger.grant(db, user_id, title['id'], content.cosmetics, [{'boss_special': chapter['id']}], instant))
    following = campaign.chapters[chapter['number']] if chapter['number'] < len(campaign.chapters) else None
    await db.flush()
    unlocked = {'chapter_id': following['id']} if won and following and not was_unlocked[following['id']] else None
    return {'normal': stars.normal_star, 'special': stars.special_star}, unlocked


async def _practice(db, tally, user_id, game, result, instant):
    if result['forfeited']:
        return
    start = ledger.day_start(ledger.day(instant))
    today = await db.scalar(select(func.count()).select_from(XPLedger).where(
        XPLedger.user_id == user_id, XPLedger.event_key.like('practice:%'), XPLedger.created_at >= start))
    if today < PRACTICE_DAILY_CAP:
        tally.xp += await ledger.award_xp(db, user_id, f'practice:{game.id}', PRACTICE_XP, 'Practice match finished', instant)


async def contested(db, game, participant):
    """At least one human opponent placed an order and did not forfeit before the last third of the match."""
    scenario = load_scenarios().get(game.scenario_id)
    ticks = scenario['ticks'] if scenario else 0
    opponents = list(await db.scalars(select(GameParticipant).where(GameParticipant.game_id == game.id, GameParticipant.user_id.is_not(None),
                                                                    GameParticipant.id != participant.id)))
    for opponent in opponents:
        if await db.scalar(select(GameOrder.id).where(GameOrder.participant_id == opponent.id).limit(1)) is None:
            continue
        if opponent.forfeited:
            left = await db.scalar(select(func.min(GameEvent.tick)).where(GameEvent.participant_id == opponent.id, GameEvent.kind == 'finish'))
            if left is None or 3 * left < 2 * ticks:
                continue
        return True
    return False


async def _rewarded_today(db, model, user_id, instant):
    start = ledger.day_start(ledger.day(instant))
    return await db.scalar(select(func.count()).select_from(model).where(model.user_id == user_id, model.event_key.like('ranked:%'),
                                                                        model.created_at >= start))


async def _ranked(db, tally, user_id, game, participant, result, instant):
    """Win rewards need a contested win; XP and Gems each pay for at most RANKED_DAILY_CAP matches per UTC day."""
    if result['forfeited']:
        return
    outcome = 'win' if result['won'] and await contested(db, game, participant) else 'loss'
    if await _rewarded_today(db, XPLedger, user_id, instant) < RANKED_DAILY_CAP:
        tally.xp += await ledger.award_xp(db, user_id, f'ranked:{game.id}', RANKED_XP[outcome], f'Ranked {outcome}', instant)
    placed = await db.scalar(select(GameOrder.id).where(GameOrder.participant_id == participant.id).limit(1))
    gems = RANKED_GEMS[outcome] if outcome == 'win' or placed else 0
    if gems and await _rewarded_today(db, EconomyEvent, user_id, instant) < RANKED_DAILY_CAP:
        if await ledger.credit(db, user_id, f'ranked:{game.id}', instant, gems=gems, context={'outcome': outcome}):
            tally.gems += gems
            if outcome == 'win' and await ledger.credit(db, user_id, f'ranked-first-win:{ledger.day(instant)}', instant,
                                                        gems=RANKED_GEMS['first_win'], context={'game_id': game.id}):
                tally.gems += RANKED_GEMS['first_win']
    await elo.apply(db, game, result, instant)


async def settle_game(content, db, profile, game, participant, result):
    marker_key = f'game:{game.id}'
    marker = await db.get(EconomyEvent, (profile.id, marker_key))
    if marker is not None:
        return marker.response
    instant = ledger.current()
    tally = Tally()
    stars = unlocked = None
    badge_list = []
    if game.mode != 'private':
        if game.mode == 'level':
            stars, unlocked = await _level(db, content, tally, profile.id, game, result, instant)
        elif game.mode == 'boss':
            stars, unlocked = await _boss(db, content, tally, profile.id, game, result, instant)
        elif game.mode == 'daily':
            xp, stocks = await daily.settle(db, profile.id, game, result, instant)
            tally.xp += xp
            tally.stocks += stocks
        elif game.mode == 'practice':
            await _practice(db, tally, profile.id, game, result, instant)
        elif game.mode == 'ranked':
            await _ranked(db, tally, profile.id, game, participant, result, instant)
        await ledger.record_activity(db, profile.id, instant)
        orders = list(await db.scalars(select(GameOrder).where(GameOrder.participant_id == participant.id).order_by(GameOrder.seq)))
        scenario = load_scenarios().get(game.scenario_id)
        match = badges.match_badges(game, participant, result, orders, scenario['ticks'] if scenario else 0)
        badge_list = await badges.award(db, content, profile.id, instant, match, participant.id)
    response = {'rewards': tally.rewards(badge_list), 'stars': stars, 'unlocked': unlocked}
    db.add(EconomyEvent(user_id=profile.id, event_key=marker_key, policy_version=ledger.POLICY_VERSION, stocks_delta=0, premium_delta=0,
                        xp_delta=0, context={'mode': game.mode, 'xp': tally.xp, 'stocks': tally.stocks, 'gems': tally.gems},
                        response=response, created_at=instant))
    await db.flush()
    return response
