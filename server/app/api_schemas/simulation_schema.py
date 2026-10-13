from app.api_schemas.shared_schema import Payload, BaseCommand
from app.simulation import engine
from pydantic import Field, field_validator
from typing import Literal
from pydantic import BaseModel


class CreateSimulation(BaseCommand):
    mode: Literal['guided', 'endless'] = 'guided'


class PlanSimulation(BaseCommand):
    reason: str = Field(min_length=12, max_length=1500)
    risk: str = Field(min_length=12, max_length=1500)
    exit: str = Field(min_length=12, max_length=1500)
    size_reason: str = Field(min_length=12, max_length=1500)
    max_loss: str = Field(min_length=1, max_length=20)


class OrderSimulation(BaseCommand):
    symbol: Literal['NORTH', 'HARBOR', 'PLAIN', 'COVE']
    side: Literal['buy', 'sell']
    type: Literal['market', 'limit', 'stop']
    quantity: int = Field(ge=1, le=1000, strict=True)
    price: str | None = Field(default=None, max_length=20)
    plan: PlanSimulation


class AdvanceSimulation(BaseCommand):
    steps: int = Field(default=1, ge=1, le=5, strict=True)


class CancelSimulation(BaseCommand):
    pass


class BindLearningSimulation(BaseCommand):
    pass


class DebriefSimulation(BaseCommand):
    reflection: str = Field(min_length=30, max_length=1500)


class AuditSimulationOrder(Payload):
    order_id: str = Field(min_length=1, max_length=100, strict=True)
    status: Literal['open', 'partial', 'filled', 'cancelled', 'expired', 'rejected']
    filled_quantity: int = Field(ge=0, le=5, strict=True)
    limit_price: str = Field(min_length=1, max_length=30, strict=True, pattern=r'^\d+(?:\.\d+)?$')

    @field_validator('limit_price')
    @classmethod
    def price_cents(cls, value):
        if engine.cents(value) <= 0:
            raise ValueError('A positive unit price is required')
        return value


class AuditSimulation(Payload):
    tick: int = Field(ge=0, strict=True)
    engine_version: int = Field(ge=1, strict=True)
    observation_token: str | None = Field(default=None, min_length=64, max_length=64, strict=True, pattern=r'^[0-9a-f]{64}$', exclude_if=lambda value: value is None)
    orders: list[AuditSimulationOrder] = Field(max_length=2)
    session_fees: str = Field(min_length=1, max_length=30, strict=True, pattern=r'^\d+(?:\.\d+)?$')
    price_limit_guarantees_fill: bool = Field(strict=True)
    no_order_reason: Literal['no_thesis_supplied', 'current_ask_above_cap'] | None

    @field_validator('session_fees')
    @classmethod
    def fee_cents(cls, value):
        engine.cents(value)
        return value


class ReviewSimulation(BaseCommand):
    audit: AuditSimulation


class SimulationQuote(BaseModel):
    symbol: str
    mid: str
    bid: str
    ask: str
    available_units: int


class SimulationPosition(BaseModel):
    symbol: str
    quantity: int
    cost: str
    realized: str
    value: str
    weight_percent: str


class SimulationPlan(BaseModel):
    reason: str
    risk: str
    exit: str
    size_reason: str
    max_loss: str


OrderStatus = Literal['open', 'partial', 'filled', 'cancelled', 'expired', 'rejected']


class SimulationOrder(BaseModel):
    id: str
    symbol: str
    side: Literal['buy', 'sell']
    type: Literal['market', 'limit', 'stop']
    quantity: int
    remaining: int
    price: str | None
    plan: SimulationPlan
    status: OrderStatus
    submitted_tick: int
    triggered: bool
    filled: int


class SimulationFill(BaseModel):
    order_id: str
    tick: int
    symbol: str
    side: Literal['buy', 'sell']
    quantity: int
    price: str
    fee: str


class SimulationRules(BaseModel):
    max_asset_weight_percent: int
    shorting: bool
    leverage: int
    fee_rate: str
    first_fill_fee: str
    spread_percent: str
    settlement: str
    benchmark: str


class LessonSimulationPolicy(BaseModel):
    id: str
    engine_version: int
    provenance: str
    symbol: str
    side: Literal['buy']
    order_type: Literal['limit']
    max_orders: int
    max_quantity: int
    max_advance: int
    min_observe: int
    max_tick: int
    unit_price_cap_basis: Literal['opening_ask']
    unit_price_cap_excludes_fees: bool
    investment_thesis_supplied: bool


class BoundSimulationPolicy(LessonSimulationPolicy):
    run_id: str
    session_id: str
    content_version: str
    rubric_version: str
    unit_price_cap: str


class SimulationAuditOrder(BaseModel):
    order_id: str
    status: OrderStatus
    filled_quantity: int
    limit_price: str


class SimulationAuditObservation(BaseModel):
    tick: int
    engine_version: int
    # Historical committed audits predate observation tokens.
    observation_token: str | None = None
    orders: list[SimulationAuditOrder]
    session_fees: str
    price_limit_guarantees_fill: bool
    no_order_reason: Literal['no_thesis_supplied', 'current_ask_above_cap'] | None


class SimulationResponse(BaseModel):
    id: str
    mode: Literal['guided', 'endless']
    updated_at: str | None
    version: int
    tick: int
    total_ticks: int
    scenario: str
    finished: bool
    cash: str
    available_cash: str
    equity: str
    fees: str
    positions: list[SimulationPosition]
    orders: list[SimulationOrder]
    quotes: list[SimulationQuote]
    fills: list[SimulationFill]
    history: dict[str, list[str]]
    benchmark_value: str
    max_drawdown_percent: str
    reflection: str | None
    rules: SimulationRules


class BoundSimulationResponse(SimulationResponse):
    bound_policy: BoundSimulationPolicy
    audited_observation: SimulationAuditObservation | None
    observation_token: str | None = None
