from pydantic import BaseModel, ConfigDict, Field
from typing import Literal

class Payload(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

class Command(Payload):
    idempotency_key: str = Field(min_length=8, max_length=100, pattern=r'^[a-zA-Z0-9_-]+$')
    policy_version: Literal['1'] | None = '1'
