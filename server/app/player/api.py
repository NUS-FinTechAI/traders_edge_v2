from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api_schemas.player_schema import Activity, Collection, DailyLogin, Leaderboard, Player, PlayerUpdate, Purchase, PurchaseResult, SeenUnlocks, Shop
from app.auth import current_profile
from app.db import Profile, get_db
from app.player import ledger, notifications, service
from app.player.levels import level_for

router = APIRouter(prefix='/api', tags=['player'])
DB = Annotated[AsyncSession, Depends(get_db, scope='function')]
User = Annotated[Profile, Depends(current_profile)]


def content(request):
    return request.app.state.content


@router.get('/me', response_model=Player, operation_id='getMe')
async def get_me(request: Request, db: DB, user: User):
    return await service.player_data(db, content(request), user)


@router.post('/me/unlocks/seen', response_model=Player, operation_id='markUnlocksSeen')
async def mark_unlocks_seen(body: SeenUnlocks, request: Request, db: DB, user: User):
    level = level_for(await ledger.total_xp(db, user.id))[0]
    available = await service.available_unlocks(db, content(request), user, level)
    await notifications.acknowledge(db, user.id, available, body.unlocks)
    return await service.player_data(db, content(request), user)


@router.patch('/me', response_model=Player, operation_id='updateMe')
async def update_me(body: PlayerUpdate, request: Request, db: DB, user: User):
    await service.update(db, content(request), user, body.model_dump(exclude_unset=True))
    return await service.player_data(db, content(request), user)


@router.post('/me/daily-login', response_model=DailyLogin, operation_id='claimDailyLogin')
async def claim_daily_login(request: Request, db: DB, user: User):
    claim = await service.claim_login(db, content(request), user)
    return {**claim, 'player': await service.player_data(db, content(request), user)}


@router.get('/me/activity', response_model=Activity, operation_id='getActivity')
async def get_activity(db: DB, user: User):
    return await service.activity(db, user)


@router.get('/me/collection', response_model=Collection, operation_id='getCollection')
async def get_collection(request: Request, db: DB, user: User):
    return await service.collection(db, content(request), user)


@router.get('/shop', response_model=Shop, operation_id='getShop')
async def get_shop(request: Request, db: DB, user: User):
    return await service.shop(db, content(request), user)


@router.post('/shop/purchase', response_model=PurchaseResult, operation_id='purchaseShopItem')
async def purchase(body: Purchase, request: Request, db: DB, user: User):
    await service.purchase(db, content(request), user, body.item_id)
    return {'item_id': body.item_id, 'player': await service.player_data(db, content(request), user)}


@router.get('/leaderboards/xp', response_model=Leaderboard, operation_id='getXpLeaderboard')
async def xp_leaderboard(request: Request, db: DB, user: User):
    return await service.xp_leaderboard(db, content(request), user)


@router.get('/leaderboards/ranked', response_model=Leaderboard, operation_id='getRankedLeaderboard')
async def ranked_leaderboard(request: Request, db: DB, user: User):
    return await service.ranked_leaderboard(db, content(request), user)
