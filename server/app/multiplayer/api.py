from typing import Annotated

from fastapi import APIRouter, Depends, Path, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api_schemas.multiplayer_schema import CreateLobby, JoinLobby, Lobby, LobbyScenarios, Match
from app.auth import current_profile
from app.db import Profile, get_db
from app.multiplayer import service

router = APIRouter(prefix='/api', tags=['multiplayer'])
DB = Annotated[AsyncSession, Depends(get_db, scope='function')]
User = Annotated[Profile, Depends(current_profile)]
Id = Annotated[str, Path(max_length=36)]


@router.get('/lobbies/scenarios', response_model=LobbyScenarios, operation_id='getLobbyScenarios')
async def lobby_scenarios(user: User):
    return service.scenario_list()


@router.post('/lobbies', response_model=Lobby, status_code=201, operation_id='createLobby')
async def create_lobby(body: CreateLobby, request: Request, db: DB, user: User):
    return await service.create_lobby(db, user, body, request.app.state.content)


@router.post('/lobbies/join', response_model=Lobby, operation_id='joinLobby')
async def join_lobby(body: JoinLobby, request: Request, db: DB, user: User):
    return await service.join_lobby(db, user, body.code, request.app.state.content)


@router.get('/lobbies/{lobby_id}', response_model=Lobby, operation_id='getLobby')
async def get_lobby(lobby_id: Id, request: Request, db: DB, user: User):
    return await service.get_lobby(db, user, lobby_id, request.app.state.content)


@router.post('/lobbies/{lobby_id}/start', response_model=Lobby, operation_id='startLobby')
async def start_lobby(lobby_id: Id, request: Request, db: DB, user: User):
    return await service.start_lobby(db, user, lobby_id, request.app.state.content)


@router.post('/lobbies/{lobby_id}/leave', status_code=204, response_class=Response, operation_id='leaveLobby')
async def leave_lobby(lobby_id: Id, db: DB, user: User):
    await service.leave_lobby(db, user, lobby_id)


@router.post('/matchmaking', response_model=Match, operation_id='joinMatchmaking')
async def join_matchmaking(request: Request, db: DB, user: User):
    return await service.join_queue(db, request.app.state.content, user)


@router.get('/matchmaking', response_model=Match, operation_id='getMatchmaking')
async def get_matchmaking(request: Request, db: DB, user: User):
    return await service.get_match(db, request.app.state.content, user)


@router.delete('/matchmaking', status_code=204, response_class=Response, operation_id='leaveMatchmaking')
async def leave_matchmaking(db: DB, user: User):
    await service.leave_queue(db, user)
