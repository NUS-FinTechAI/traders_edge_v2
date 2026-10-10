from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_serializer


class GuestSession(BaseModel):
    profile_id: str
    auth_mode: Literal['guest']
    expires_at: datetime

    @field_serializer('expires_at')
    def serialize_expiry(self, value: datetime) -> str:
        return value.isoformat()


class UserProfile(BaseModel):
    id: str
    display_name: str
    leaderboard_opt_in: bool
    analytics_opt_in: bool
    xp: int
    completed_lesson_ids: list[str]
    mastered_module_ids: list[str]
    activity_days: list[str]
    activity_timezone: Literal['UTC']
    due_review_count: int
    learning_only: bool
    learning_xp: int
    game_xp: int
    player_level: int
    player_level_policy: Literal['100-xp-per-level-1']
    xp_basis: Literal['learning and game events']
