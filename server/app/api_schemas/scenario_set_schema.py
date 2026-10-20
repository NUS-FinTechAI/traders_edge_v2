from typing import Literal

from pydantic import Field, field_validator

from app.api_schemas.learning_run_schema import LearningRunResponse, SimulationAuditIssue
from app.api_schemas.order_schema import OrderStatus
from app.api_schemas.shared_schema import BaseCommand, Payload
from app.api_schemas.simulation_schema import SimulationResponse
from app.simulation import engine


class ScenarioOrderAudit(Payload):
    order_id: str = Field(min_length=1, max_length=100)
    status: OrderStatus
    requested_quantity: int = Field(ge=1, strict=True)
    filled_quantity: int = Field(ge=0, strict=True)
    remaining_quantity: int = Field(ge=0, strict=True)


class ScenarioPositionAudit(Payload):
    symbol: str = Field(min_length=1, max_length=30)
    quantity: int = Field(ge=1, strict=True)


class ScenarioAudit(Payload):
    case_id: str = Field(min_length=1, max_length=30)
    tick: int = Field(ge=0, strict=True)
    engine_version: int = Field(ge=1, strict=True)
    observation_token: str = Field(min_length=64, max_length=64, pattern=r'^[0-9a-f]{64}$')
    orders: list[ScenarioOrderAudit] = Field(max_length=100)
    positions: list[ScenarioPositionAudit] = Field(max_length=4)
    cash: str = Field(min_length=1, max_length=30, pattern=r'^\d+(?:\.\d+)?$')
    session_fees: str = Field(min_length=1, max_length=30, pattern=r'^\d+(?:\.\d+)?$')
    benchmark_value: str = Field(min_length=1, max_length=30, pattern=r'^\d+(?:\.\d+)?$')
    benchmark_is_gross: bool = Field(strict=True)
    profit_proves_process: bool = Field(strict=True)
    planned_loss_is_guaranteed: bool = Field(strict=True)
    no_order_reason: Literal['no_thesis_supplied'] | None

    @field_validator('cash', 'session_fees', 'benchmark_value')
    @classmethod
    def money_cents(cls, value):
        engine.cents(value)
        return value


class ReviewScenarioCase(BaseCommand):
    audit: ScenarioAudit


class ScenarioSetPolicy(Payload):
    id: str
    engine_version: int
    provenance: str
    brief: str
    total_cases: int
    total_ticks: int
    max_advance: int
    max_order_quantity: int
    max_asset_units: int
    max_planned_loss: str
    investment_thesis_supplied: bool
    grade_basis: str


class ScenarioSessionPolicy(ScenarioSetPolicy):
    run_id: str
    case_id: str
    session_id: str
    content_version: str
    rubric_version: str


class ScenarioSessionResponse(SimulationResponse):
    scenario_set_policy: ScenarioSessionPolicy
    observation_token: str
    audited_observation: ScenarioAudit | None


class ScenarioCaseSummary(Payload):
    case_id: str
    session_id: str
    generator_profile: Literal['rising', 'falling', 'sideways', 'volatile']
    cash: str
    equity: str
    fees: str
    benchmark_value: str
    max_drawdown_percent: str
    audit: ScenarioAudit


class ScenarioSetResponse(Payload):
    run: LearningRunResponse
    policy: ScenarioSetPolicy
    current_case_id: str | None
    session: ScenarioSessionResponse | None
    completed_cases: list[ScenarioCaseSummary]
    issues: list[SimulationAuditIssue]
