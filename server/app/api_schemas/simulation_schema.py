from app.api_schemas.order_schema import AuditOrder, OrderAudit, Order
from app.api_schemas.shared_schema import Payload, BaseCommand
from app.simulation import engine
from pydantic import Field, field_validator
from typing import Literal
from pydantic import BaseModel


class CreateSimulation(BaseCommand):
    mode: Literal['guided', 'endless'] = 'guided'


class AdvanceSimulation(BaseCommand):
    steps: int = Field(default=1, ge=1, le=5, strict=True)


class BindLearningSimulation(BaseCommand):
    pass


class DebriefSimulation(BaseCommand):
    reflection: str = Field(min_length=30, max_length=1500)


class SimulationAudit(Payload):
    tick: int = Field(ge=0, strict=True)
    engine_version: int = Field(ge=1, strict=True)
    observation_token: str | None = Field(default=None, min_length=64, max_length=64, strict=True, pattern=r'^[0-9a-f]{64}$', exclude_if=lambda value: value is None)
    orders: list[OrderAudit] = Field(max_length=2)
    session_fees: str = Field(min_length=1, max_length=30, strict=True, pattern=r'^\d+(?:\.\d+)?$')
    price_limit_guarantees_fill: bool = Field(strict=True)
    no_order_reason: Literal['no_thesis_supplied', 'current_ask_above_cap'] | None

    @field_validator('session_fees')
    @classmethod
    def fee_cents(cls, value):
        engine.cents(value)
        return value


class ReviewSimulation(BaseCommand):
    audit: SimulationAudit


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


class SimulationAuditObservation(BaseModel):
    tick: int
    engine_version: int
    # Historical committed audits predate observation tokens.
    observation_token: str | None = None
    orders: list[AuditOrder]
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
    orders: list[Order]
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
