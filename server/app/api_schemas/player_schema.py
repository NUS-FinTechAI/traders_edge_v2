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


class EquippedBadge(BaseModel):
    id: str
    name: str


class UnlockKey(Payload):
    category: str = Field(min_length=1, max_length=40)
    item_id: str = Field(min_length=1, max_length=120)


class UnlockNotice(UnlockKey):
    group: str = Field(min_length=1, max_length=40)


class SeenUnlocks(Payload):
    unlocks: list[UnlockKey] = Field(min_length=1)


class Player(BaseModel):
    id: str
    display_name: str
    avatar_id: str
    avatar_image: str | None = Field(description='Art key of the equipped avatar')
    title_id: str | None
    title: str
    badge: EquippedBadge | None
    level: int
    rank_name: str
    xp: int
    xp_into_level: int
    xp_for_next_level: int
    wallet: Wallet
    streak: Streak
    unlocks: Unlocks
    leaderboard_opt_in: bool
    unread_unlocks: list[UnlockNotice] = Field(default_factory=list)


class PlayerUpdate(Payload):
    display_name: str | None = Field(default=None, min_length=1, max_length=40)
    avatar_id: str | None = Field(default=None, min_length=1, max_length=120)
    title_id: str | None = Field(default=None, max_length=120, description='An owned title id, or null to show your rank')
    badge_id: str | None = Field(default=None, min_length=1, max_length=120, description='An earned badge id, or null to remove your badge')
    leaderboard_opt_in: bool | None = None


class DailyLogin(BaseModel):
    day: int
    doubloons: int
    xp: int
    already_claimed: bool
    player: Player


class LevelReward(BaseModel):
    level: int
    amount: int
    status: Literal['locked', 'claimable', 'claimed']


class ClaimLevelRewards(Payload):
    level: int | None = Field(default=None, ge=2, le=50)


class LevelRewardClaim(BaseModel):
    gems: int
    rewards: list[LevelReward]
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
    equipped: bool
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


type RatingTier = Literal['bronze', 'silver', 'gold', 'platinum', 'diamond']


class RankingEntry(BaseModel):
    rank: int
    name: str
    badge: EquippedBadge | None
    avatar_id: str
    level: int
    value: int
    tier: RatingTier | None = None
    is_me: bool


class LeaderboardMe(BaseModel):
    rank: int | None
    value: int
    tier: RatingTier | None = Field(default=None, description='Personal ranked tier, independent of public leaderboard visibility; null for XP')


class Leaderboard(BaseModel):
    entries: list[RankingEntry]
    me: LeaderboardMe
