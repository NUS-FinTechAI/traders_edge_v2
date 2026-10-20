from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.api_schemas.shared_schema import Payload

Strategy = Literal['trend', 'dip', 'breakout', 'news', 'hold', 'cautious']
Side = Literal['buy', 'sell']
OrderType = Literal['market', 'limit', 'stop']
Status = Literal['briefing', 'running', 'ended', 'settled']


class CreateGame(Payload):
    mode: Literal['level', 'boss', 'daily', 'practice']
    scenario_id: str | None = Field(default=None, max_length=120, pattern=r'^[a-z0-9]+(-[a-z0-9]+)*$')
    level_id: str | None = Field(default=None, max_length=120)
    chapter_id: str | None = Field(default=None, max_length=120)
    boss: Literal['gate', 'final'] | None = None
    bots: int | None = Field(default=None, ge=1, le=7)


class GamePlan(Payload):
    strategy: Strategy
    max_loss_pct: float = Field(ge=1, le=50)


class StartGame(Payload):
    plan: GamePlan


class ClockCommand(Payload):
    action: Literal['pause', 'resume', 'step', 'speed']
    speed: Literal[1, 2, 4] | None = None

    @model_validator(mode='after')
    def speed_matches_action(self):
        if (self.action == 'speed') != (self.speed is not None):
            raise ValueError('Send a speed only with the speed action')
        return self


class PlaceOrder(Payload):
    client_order_id: str = Field(min_length=8, max_length=64, pattern=r'^[a-zA-Z0-9_-]+$')
    symbol: str = Field(pattern=r'^[A-Z]{3,5}$')
    side: Side
    type: OrderType
    qty: int = Field(ge=1, le=1_000_000)
    limit_price: float | None = Field(default=None, gt=0, le=1_000_000)
    stop_price: float | None = Field(default=None, gt=0, le=1_000_000)

    @model_validator(mode='after')
    def prices_match_type(self):
        if (self.type == 'limit') != (self.limit_price is not None):
            raise ValueError('A limit price is required for limit orders and only for them')
        if (self.type == 'stop') != (self.stop_price is not None):
            raise ValueError('A stop price is required for stop-loss orders and only for them')
        if self.type == 'stop' and self.side != 'sell':
            raise ValueError('A stop-loss order must be a sell order')
        return self


class FinishGame(Payload):
    forfeit: bool = False
    reflection: str | None = Field(default=None, max_length=2000)


class Fee(BaseModel):
    rate: float
    min: float


class AllowedOrders(BaseModel):
    limit: bool
    stop: bool


class ScenarioInfo(BaseModel):
    id: str
    title: str
    briefing: str
    objective: str
    difficulty: int
    starting_cash: float
    tools: list[str]
    allow: AllowedOrders
    max_position_pct: float | None
    fee: Fee
    spread: float


class Asset(BaseModel):
    symbol: str
    name: str
    sector: str
    blurb: str
    price: float
    change_pct: float


class Bar(BaseModel):
    t: int
    o: float
    h: float
    l: float
    c: float
    v: int


class NewsItem(BaseModel):
    id: str
    t: int
    headline: str
    body: str
    symbols: list[str]
    tone: Literal['positive', 'negative', 'neutral']
    kind: Literal['earnings', 'macro', 'rumor', 'company', 'hype']


class Position(BaseModel):
    symbol: str
    qty: int
    avg_price: float
    value: float
    unrealized: float


class Order(BaseModel):
    id: str
    client_order_id: str
    symbol: str
    side: Side
    type: OrderType
    qty: int
    limit_price: float | None
    stop_price: float | None
    status: Literal['open', 'filled', 'cancelled']
    tick: int


class Fill(BaseModel):
    order_id: str
    t: int
    symbol: str
    side: Side
    qty: int
    price: float
    fee: float


class PlayerState(BaseModel):
    participant_id: str
    cash: float
    available_cash: float
    equity: float
    profit: float
    profit_pct: float
    positions: list[Position]
    orders: list[Order]
    fills: list[Fill]
    max_drawdown_pct: float
    plan: GamePlan | None


class LeaderboardEntry(BaseModel):
    participant_id: str
    name: str
    kind: Literal['bot', 'human']
    bot_id: str | None
    avatar: str | None
    style: str | None
    tier: Literal['rookie', 'pro', 'elite'] | None
    profit: float
    rank: int
    is_me: bool
    forfeited: bool


class Mission(BaseModel):
    id: str
    tier: Literal['basic', 'bonus']
    text: str
    done: bool
    progress: str


class Stars(BaseModel):
    normal: bool
    special: bool


class RewardItem(BaseModel):
    id: str
    kind: str
    name: str


class RewardBadge(BaseModel):
    id: str
    name: str


class GameRewards(BaseModel):
    xp: int
    stocks: int
    gems: int
    items: list[RewardItem]
    badges: list[RewardBadge]


class PlanReview(BaseModel):
    strategy: Strategy
    max_loss_pct: float
    worst_drawdown_pct: float
    kept_loss_limit: bool


class GameStats(BaseModel):
    trades: int
    fees: float
    biggest_position_pct: float
    max_drawdown_pct: float
    buy_hold_profit: float


class Unlocked(BaseModel):
    chapter_id: str | None = None


class GameResult(BaseModel):
    won: bool
    rank: int
    of: int
    forfeited: bool
    profit: float
    profit_pct: float
    leaderboard: list[LeaderboardEntry]
    missions: list[Mission]
    stars: Stars | None
    rewards: GameRewards
    plan_review: PlanReview | None
    decision_score: int = Field(ge=0, le=100, description='Unvalidated 0-100 process score; never decides a win')
    key_moments: list[str]
    stats: GameStats
    debrief: str
    unlocked: Unlocked | None


class GameState(BaseModel):
    id: str
    mode: str
    status: Status
    tick: int
    ticks: int
    tick_label: str
    tick_ms: int
    speed: int
    paused: bool
    server_time: int
    next_tick_at: int | None
    scenario: ScenarioInfo
    assets: list[Asset]
    bars: dict[str, list[Bar]]
    news: list[NewsItem]
    me: PlayerState
    leaderboard: list[LeaderboardEntry]
    missions: list[Mission]
    result: GameResult | None


class OrderRejection(BaseModel):
    detail: str


class PlacedOrder(BaseModel):
    order: Order
    state: GameState


class GameSummary(BaseModel):
    id: str
    mode: str
    status: Status
    scenario_id: str
    title: str
    tick: int
    ticks: int
    created_at: datetime


class GameList(BaseModel):
    games: list[GameSummary]
