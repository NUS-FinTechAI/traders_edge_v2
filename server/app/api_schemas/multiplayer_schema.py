
from app.api_schemas.shared_schema import BaseCommand
from app.api_schemas.order_schema import SubmitOrder
from datetime import datetime
from typing import Literal
from pydantic import Field, field_validator
from app.api_schemas.challenge_schema import ChallengeAwards
from app.api_schemas.simulation_schema import SimulationObservation
from app.api_schemas.shared_schema import Payload


class TickCommand(BaseCommand):
    expected_tick: int = Field(ge=0, le=29, strict=True)


class TickOrder(SubmitOrder):
    expected_tick: int = Field(ge=0, le=29, strict=True)


class JoinMultiplayerLobby(BaseCommand):
    code: str = Field(min_length=16, max_length=16, pattern=r'^[A-F0-9]{16}$')


class AbandonMultiplayerMatch(BaseCommand):
    pass


class JoinMultiplayerMatchmaking(BaseCommand):
    pass


class CreateMultiplayerLobby(BaseCommand):
    pass

class StartMultiplayerMatch(BaseCommand):
    pass


type MultiplayerMode = Literal['private', 'public_ranked']
type MultiplayerStatus = Literal['waiting', 'active', 'finished', 'cancelled']


class MultiplayerPolicy(Payload):
    version: str
    ticks: int
    starting_value: str
    profit: str
    ties: str
    liquidity: str
    advance: str
    disconnect: str
    forfeit: str
    rating: str
    provenance: str


class MultiplayerParticipant(Payload):
    user_id: str
    display_name: str
    ready: bool
    forfeit: bool
    departed: bool
    completed: bool


class MultiplayerResultEntry(Payload):
    user_id: str
    display_name: str
    forfeit: bool
    profit: str
    final_value: str
    fees: str
    rank: int
    win: bool
    rating_before: int | None = None
    rating_delta: int | None = None
    rating_after: int | None = None


class MultiplayerResult(Payload):
    leaderboard: list[MultiplayerResultEntry]
    final_tick: int
    policy_version: str


class MultiplayerResponse(Payload):
    id: str
    host_id: str
    mode: MultiplayerMode
    status: MultiplayerStatus
    policy: MultiplayerPolicy
    version: str
    attempt_number: int
    player: SimulationObservation | None
    participants: list[MultiplayerParticipant]
    result: MultiplayerResult | None
    awards: ChallengeAwards | None
    join_code: str | None = None


class MultiplayerSummary(Payload):
    id: str
    mode: MultiplayerMode
    status: MultiplayerStatus
    created_at: str
    updated_at: str

    @field_validator('created_at', 'updated_at', mode='before')
    @classmethod
    def timestamp(cls, value):
        return value.isoformat() if isinstance(value, datetime) else value


class MultiplayerListResponse(Payload):
    matches: list[MultiplayerSummary]


class MultiplayerRatingEntry(Payload):
    user_id: str
    display_name: str
    rating: int
    matches: int


class MultiplayerLeaderboardResponse(Payload):
    policy_version: str
    players: list[MultiplayerRatingEntry]
    your_rating: int
    your_matches: int
