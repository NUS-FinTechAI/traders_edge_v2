from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Literal
from app.api_schemas.shared_schema import BaseCommand
from app.api_schemas.simulation_schema import SimulationObservation

type ChallengeType = Literal['practice', 'daily', 'chapter_entry', 'chapter_exit']

class CreateChallenge(BaseCommand):
    mode: ChallengeType = 'practice'
    module_id: str | None = Field(default=None, min_length=1, max_length=120)
    opponent_count: int = Field(default=1, ge=1, le=3, strict=True)


class AbandonChallenge(BaseCommand):
    pass


class ChallengePayload(BaseModel):
    model_config = ConfigDict(extra='forbid')


type ChallengeStatus = Literal['active', 'completed', 'abandoned']


class ChallengePolicy(ChallengePayload):
    version: str
    ticks: int
    starting_value: str
    profit: str
    ties: str
    liquidity: str
    early_exit: str
    resume: str
    objective: str
    provenance: str
    difficulty: str


class ChallengeOpponent(ChallengePayload):
    id: str
    display_name: str
    tick: int


class ChallengeLeaderboardEntry(ChallengePayload):
    participant_id: str
    display_name: str
    profit: str
    final_value: str
    fees: str
    rank: int


class ChallengeWallet(ChallengePayload):
    policy_version: str
    timezone: str
    stocks_week: str
    stocks_expires_at: str
    stocks_balance: int
    premium_balance: int
    login_last_day: str | None
    login_streak_days: int
    daily_cooldown_until: str | None
    simulated_trading_funds: str


class ChallengeAwardAmounts(ChallengePayload):
    stocks: int
    premium: int
    xp: int


class ChallengeAwards(BaseModel):
    # Server-installed completion handlers may extend the standard economy receipt.
    model_config = ConfigDict(extra='allow')

    wallet: ChallengeWallet | None = None
    awarded: ChallengeAwardAmounts | None = None
    chapter_entry_unlocked: bool | None = None
    chapter_exit_completed: bool | None = None


class ChallengeResult(ChallengePayload):
    win: bool
    profit: str
    leaderboard: list[ChallengeLeaderboardEntry]
    final_tick: int
    policy_version: str
    attempt_id: str
    user_id: str
    mode: ChallengeType
    module_id: str | None
    challenge_id: str
    attempt_number: int
    awards: ChallengeAwards | None = None


class ChallengeResponse(ChallengePayload):
    id: str
    challenge_id: str
    mode: ChallengeType
    attempt_number: int
    module_id: str | None
    version: str
    status: ChallengeStatus
    policy: ChallengePolicy
    player: SimulationObservation
    opponents: list[ChallengeOpponent]
    result: ChallengeResult | None


class ChallengeSummary(ChallengePayload):
    id: str
    challenge_id: str
    mode: ChallengeType
    module_id: str | None
    status: ChallengeStatus
    created_at: str
    updated_at: str

    @field_validator('created_at', 'updated_at', mode='before')
    @classmethod
    def timestamp(cls, value):
        return value.isoformat() if isinstance(value, datetime) else value


class ChallengeListResponse(ChallengePayload):
    attempts: list[ChallengeSummary]
