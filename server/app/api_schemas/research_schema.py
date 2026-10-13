from typing import Literal

from app.api_schemas.shared_schema import Command
from pydantic import Field, field_validator

PriorKnowledge = Literal['unknown', 'none', 'some', 'experienced']
ExportKind = Literal['learning-runs', 'learning-attempts', 'ai-challenges']

class Metadata(Command):
    prior_knowledge: PriorKnowledge


class Consent(Command):
    accepted: bool = Field(strict=True)
    policy_version: str = Field(min_length=1, max_length=80)
    policy_digest: str = Field(strict=True, min_length=64, max_length=64, pattern=r'^[0-9a-f]{64}$')

    @field_validator('accepted')
    @classmethod
    def explicit_acceptance(cls, value):
        if value is not True:
            raise ValueError('Explicit acceptance is required; use withdrawals to withdraw')
        return value
