from typing import Literal

from pydantic import BaseModel, Field

from app.api_schemas.shared_schema import Payload


class Wallet(BaseModel):
    doubloons: int
    doubloons_week_ends_at: str
    gems: int


class Streak(BaseModel):
    days: int
    claimed_today: bool
    cycle_day: int = Field(description='Position in the current 7-day reward cycle, 1-7')


class Unlocks(BaseModel):
    daily: bool
    ranked: bool


class Player(BaseModel):
    id: str
    display_name: str
    avatar_id: str
    avatar_image: str | None = Field(description='Art key of the equipped avatar')
    title_id: str | None
    title: str
    level: int
    rank_name: str
    xp: int
    xp_into_level: int
    xp_for_next_level: int
    wallet: Wallet
    streak: Streak
    unlocks: Unlocks
    leaderboard_opt_in: bool


class PlayerUpdate(Payload):
    display_name: str | None = Field(default=None, min_length=1, max_length=40)
    avatar_id: str | None = Field(default=None, min_length=1, max_length=120)
    title_id: str | None = Field(default=None, max_length=120, description='An owned title id, or null to show your rank')
    leaderboard_opt_in: bool | None = None


class DailyLogin(BaseModel):
    day: int
    doubloons: int
    xp: int
    already_claimed: bool
    player: Player


class ActivityDay(BaseModel):
    date: str
    count: int


class WeekDay(BaseModel):
    date: str
    claimed: bool
    xp: int
    doubloons: int


class Activity(BaseModel):
    days: list[ActivityDay]
    streak_days: int
    week: list[WeekDay]


class CollectionBadge(BaseModel):
    id: str
    name: str
    description: str
    earned: bool
    earned_at: str | None
    progress: str | None


class CollectionItem(BaseModel):
    id: str
    name: str
    image: str | None = Field(default=None, description='Art key for avatars; null for titles')
    owned: bool
    equipped: bool
    how: str


class CollectionStats(BaseModel):
    levels_done: int
    stars: int
    bosses_won: int
    quizzes_passed: int
    matches_played: int
    best_profit: float | None


class Collection(BaseModel):
    badges: list[CollectionBadge]
    avatars: list[CollectionItem]
    titles: list[CollectionItem]
    stats: CollectionStats


class ShopItem(BaseModel):
    id: str
    kind: Literal['avatar', 'title', 'theme']
    name: str
    description: str
    currency: Literal['stocks', 'gems']
    price: int
    owned: bool
    weekly: bool


class Shop(BaseModel):
    items: list[ShopItem]


class Purchase(Payload):
    item_id: str = Field(min_length=1, max_length=120)


class PurchaseResult(BaseModel):
    item_id: str
    player: Player


class RankingEntry(BaseModel):
    rank: int
    name: str
    avatar_id: str
    level: int
    value: int
    tier: str | None = None
    is_me: bool


class LeaderboardMe(BaseModel):
    rank: int | None
    value: int


class Leaderboard(BaseModel):
    entries: list[RankingEntry]
    me: LeaderboardMe
