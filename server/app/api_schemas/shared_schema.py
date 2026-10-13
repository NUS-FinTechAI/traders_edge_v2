from pydantic import BaseModel, ConfigDict, Field

class Payload(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

class BaseCommand(Payload):
    idempotency_key: str = Field(min_length=8, max_length=100, pattern=r'^[a-zA-Z0-9_-]+$')
