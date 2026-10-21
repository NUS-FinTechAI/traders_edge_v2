from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.api_schemas.shared_schema import BaseCommand

type PriorKnowledge = Literal['unknown', 'none', 'some', 'experienced']
type ExportKind = Literal['game-events', 'campaign-progress', 'quiz-attempts']

class ResearchMetadata(BaseCommand):
    prior_knowledge: PriorKnowledge


class ConsentResearch(BaseCommand):
    accepted: bool = Field(strict=True)
    policy_version: str = Field(min_length=1, max_length=80)
    policy_digest: str = Field(strict=True, min_length=64, max_length=64, pattern=r'^[0-9a-f]{64}$')

    @field_validator('accepted')
    @classmethod
    def explicit_acceptance(cls, value):
        if value is not True:
            raise ValueError('Explicit acceptance is required; use withdrawals to withdraw')
        return value

class WithdrawResearchConsent(BaseCommand):
    pass


class StudyPolicy(BaseModel):
    available: bool
    version: str | None
    text: str | None
    policy_digest: str | None


class ResearchMetadataView(BaseModel):
    prior_knowledge: PriorKnowledge
    first_prior_knowledge: PriorKnowledge | None
    prior_knowledge_basis: Literal['self_reported_unvalidated']
    consented: bool
    participation_active: bool
    consent_version: str | None
    consent_text: str | None
    consented_at: str | None
    withdrawn_at: str | None
    study_policy: StudyPolicy
    analytics_consent_is_separate: bool
    withdrawal_effect: str


class ResearchExport(BaseModel):
    format_version: int
    scope: Literal['your_operational_records']
    kind: ExportKind
    records: list[dict[str, Any]] = Field(description='game-events: one command with its observed context; campaign-progress: level, boss '
                                                      'and first check answers; quiz-attempts: items, option order and answers')
    next_cursor: str | None
    assessment_limit: str
