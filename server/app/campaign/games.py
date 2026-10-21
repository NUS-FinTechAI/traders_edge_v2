"""The resolve_game and before_start hooks: which scenario a POST /api/games request may play, and when a briefing may start."""

import secrets

from fastapi import HTTPException

from app.campaign import daily, settlement
from app.campaign.progress import load_progress
from app.campaign.views import practice_pool
from app.game.scenario import load_scenarios
from app.game.service import GameSpec
from app.player import ledger

MAX_PRACTICE_BOTS = 3


def _level(content, progress, body):
    campaign = content.campaign
    if body.level_id not in campaign.levels:
        raise HTTPException(404, 'Level not found')
    reason = progress.level_locked_reason(body.level_id)
    if reason:
        raise HTTPException(403, reason)
    row = progress.level(body.level_id)
    if not (row and row.check_done):
        raise HTTPException(403, 'Finish the level check before the practice mission')
    chapter = campaign.chapter_of(body.level_id)
    return GameSpec(campaign.level(body.level_id)['practice'], 'level', chapter_id=chapter['id'], level_id=body.level_id)


def _boss(content, progress, body):
    chapter = content.campaign.chapter(body.chapter_id)
    if chapter is None:
        raise HTTPException(404, 'Chapter not found')
    kind = body.boss or 'final'
    if kind == 'gate':
        if not chapter['gate']:
            raise HTTPException(403, 'This chapter has no gate boss')
        if progress.unlocked(chapter):
            raise HTTPException(409, 'This chapter is already open')
        scenario_id = chapter['gate']
    else:
        reason = progress.boss_locked_reason(chapter) if kind == 'final' or not progress.unlocked(chapter) else None
        if reason:
            raise HTTPException(403, reason)
        scenario_id = chapter['boss']
    return GameSpec(scenario_id, 'boss', chapter_id=chapter['id'], boss=kind, context={'boss': kind})


def _practice(body):
    pool = practice_pool()
    if not pool:
        raise HTTPException(503, 'No practice markets are available yet')
    scenario_id = body.scenario_id or secrets.choice(pool)
    if scenario_id not in pool:
        raise HTTPException(404, 'Practice scenario not found')
    bots = load_scenarios()[scenario_id]['bots']
    count = min(body.bots or MAX_PRACTICE_BOTS, MAX_PRACTICE_BOTS, len(bots))
    return GameSpec(scenario_id, 'practice', bot_ids=bots[:count])


async def resolve_game(content, db, profile, body):
    if body.mode == 'practice':
        return _practice(body)
    progress = await load_progress(db, content.campaign, profile.id)
    if body.mode == 'level':
        return _level(content, progress, body)
    if body.mode == 'boss':
        return _boss(content, progress, body)
    async def settle(db, profile, game, participant, result):
        return await settlement.settle_game(content, db, profile, game, participant, result)
    scenario_id, context = await daily.resolve(db, profile, progress, ledger.current(), settle)
    return GameSpec(scenario_id, 'daily', context=context)


async def before_start(content, db, profile, game):
    if game.mode == 'daily':
        await daily.check_start(db, profile.id, game, ledger.current())
