from typing import Literal
from pydantic import Field, field_validator
from app.api_schemas.shared_schema import BaseCommand, Payload
from app.simulation import engine


OrderStatus = Literal['open', 'partial', 'filled', 'cancelled', 'expired', 'rejected']


class OrderPlan(Payload):
    reason: str = Field(min_length=12, max_length=1500)
    risk: str = Field(min_length=12, max_length=1500)
    exit: str = Field(min_length=12, max_length=1500)
    size_reason: str = Field(min_length=12, max_length=1500)
    max_loss: str = Field(min_length=1, max_length=20)


class Order(Payload):
    id: str
    symbol: str
    side: Literal['buy', 'sell']
    type: Literal['market', 'limit', 'stop']
    quantity: int
    remaining: int
    price: str | None
    plan: OrderPlan
    status: OrderStatus
    submitted_tick: int
    triggered: bool
    filled: int


class AuditOrder(Payload):
    order_id: str
    status: OrderStatus
    filled_quantity: int
    limit_price: str

  
class OrderAudit(Payload):
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


class SubmitOrder(BaseCommand):
    symbol: Literal['NORTH', 'HARBOR', 'PLAIN', 'COVE']
    side: Literal['buy', 'sell']
    type: Literal['market', 'limit', 'stop']
    quantity: int = Field(ge=1, le=1000, strict=True)
    price: str | None = Field(default=None, max_length=20)
    plan: OrderPlan


class CancelOrder(BaseCommand):
    pass
