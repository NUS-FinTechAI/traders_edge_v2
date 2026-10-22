from typing import Literal
from app.api_schemas.player_schema import RatingTier

from pydantic import BaseModel, Field

from app.api_schemas.shared_schema import Payload
from app.api_schemas.player_schema import EquippedBadge


class CreateLobby(Payload):
    scenario_id: str | None = Field(default=None, max_length=120, pattern=r'^[a-z0-9]+(-[a-z0-9]+)*$')
    bots: int = Field(default=0, ge=0, le=3)


class JoinLobby(Payload):
    code: str = Field(min_length=6, max_length=6)


class LobbyScenario(BaseModel):
    id: str
    title: str
    ticks: int


class LobbyMember(BaseModel):
    user_id: str
    name: str
    badge: EquippedBadge | None
    avatar_id: str
    is_host: bool


class Lobby(BaseModel):
    id: str
    code: str
    host_id: str
    is_host: bool
    status: Literal['open', 'started', 'closed']
    scenario: LobbyScenario
    members: list[LobbyMember]
    bots: int
    game_id: str | None
    max_members: int


class LobbyScenarioDetail(LobbyScenario):
    briefing: str


class LobbyScenarios(BaseModel):
    scenarios: list[LobbyScenarioDetail]


class Match(BaseModel):
    status: Literal['idle', 'searching', 'matched']
    game_id: str | None
    rating: int
    tier: RatingTier
    waiting_since: str | None
    locked_reason: str | None
