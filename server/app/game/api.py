from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api_schemas.game_schema import (ClockCommand, CreateGame, FinishGame, GameList, GameResult, GameState, OrderRejection, PlaceOrder,
                                        PlacedOrder, StartGame)
from app.auth import current_profile
from app.db import Profile, get_db
from app.game import service

router = APIRouter(prefix='/api/games', tags=['games'])
DB = Annotated[AsyncSession, Depends(get_db, scope='function')]
User = Annotated[Profile, Depends(current_profile)]
GameId = Annotated[str, Path(max_length=36)]


@router.post('', status_code=201, response_model=GameState, operation_id='createGame',
             responses={409: {'model': OrderRejection, 'description': 'This match cannot be created now; `detail` says why'}})
async def create_game(body: CreateGame, request: Request, db: DB, user: User):
    try:
        spec = await request.app.state.resolve_game(db, user, body)
    except service.Refused as refusal:
        return JSONResponse(status_code=refusal.status, content={'detail': refusal.detail})
    game = await service.create_game(db, user, spec)
    return await service.state(db, user, game.id)


@router.get('', response_model=GameList, operation_id='listGames')
async def list_games(db: DB, user: User, status: Literal['active'] = 'active'):
    return await service.active_games(db, user)


@router.get('/{game_id}', response_model=GameState, operation_id='getGame')
async def get_game(game_id: GameId, db: DB, user: User, since: Annotated[int | None, Query(ge=-200, le=1000)] = None):
    return await service.state(db, user, game_id, since)


@router.post('/{game_id}/start', response_model=GameState, operation_id='startGame')
async def start_game(game_id: GameId, body: StartGame, request: Request, db: DB, user: User):
    return await service.start(db, user, game_id, body.plan.model_dump(), getattr(request.app.state, 'before_start', service.before_start))


@router.post('/{game_id}/clock', response_model=GameState, operation_id='controlGameClock')
async def control_clock(game_id: GameId, body: ClockCommand, db: DB, user: User):
    return await service.control_clock(db, user, game_id, body.action, body.speed)


@router.post('/{game_id}/orders', response_model=PlacedOrder, operation_id='placeGameOrder',
             responses={422: {'model': OrderRejection, 'description': 'The order breaks a rule; `detail` says why in plain language'}})
async def place_order(game_id: GameId, body: PlaceOrder, db: DB, user: User):
    try:
        order, state = await service.place_order(db, user, game_id, body)
    except service.Rejected as rejection:
        return JSONResponse(status_code=422, content={'detail': rejection.reason})
    return {'order': order, 'state': state}


@router.delete('/{game_id}/orders/{order_id}', response_model=GameState, operation_id='cancelGameOrder')
async def cancel_order(game_id: GameId, order_id: Annotated[str, Path(max_length=36)], db: DB, user: User):
    return await service.cancel_order(db, user, game_id, order_id)


@router.post('/{game_id}/finish', response_model=GameResult, operation_id='finishGame')
async def finish_game(game_id: GameId, body: FinishGame, request: Request, db: DB, user: User):
    return await service.finish(db, user, game_id, body.forfeit, body.reflection, request.app.state.settle_game)


@router.get('/{game_id}/result', response_model=GameResult, operation_id='getGameResult')
async def get_result(game_id: GameId, db: DB, user: User):
    return await service.stored_result(db, user, game_id)
