from typing import Annotated, Literal

from pydantic import Field, JsonValue

from app.api_schemas.shared_schema import BaseCommand, Payload

from app.api_schemas.auth_schema import UserProfile
from app.api_schemas.simulation_schema import LessonSimulationPolicy, SimulationAuditObservation


class TaskEntry(Payload):
    id: str
    text: str


class TaskBase(Payload):
    id: str
    prompt: str


class InstructionTask(TaskBase):
    type: Literal['instruction']
    text: str


class ChoiceTask(TaskBase):
    type: Literal['choice']
    options: list[TaskEntry]


class ClassificationTask(TaskBase):
    type: Literal['classification']
    items: list[TaskEntry]
    categories: list[TaskEntry]


class SimulationTask(TaskBase):
    type: Literal['simulation']


LearningTask = Annotated[InstructionTask | ChoiceTask | ClassificationTask | SimulationTask, Field(discriminator='type')]


class SimulationAuditIssue(Payload):
    code: str
    message: str
    order_id: str | None = None
    expected: JsonValue = None
    observed: dict[str, JsonValue] | None = None


class LearningFeedback(Payload):
    step_id: str
    correct: bool
    explanation: str
    issues: list[SimulationAuditIssue] | None = None
    audited_observation: SimulationAuditObservation | None = None
    observation_phase: Literal['before_finish_cancellation'] | None = None


class LearningProgress(Payload):
    completed_steps: int
    total_steps: int


class LearningProfileSnapshot(UserProfile):
    # Receipts saved before game economy retain their original profile shape.
    learning_xp: int | None = None
    game_xp: int | None = None
    player_level: int | None = None
    player_level_policy: Literal['100-xp-per-level-1'] | None = None
    xp_basis: Literal['learning and game events'] | None = None


class LearningResult(Payload):
    attempt_id: str
    passed: bool | None
    score_percent: int
    critical_items_passed: bool
    standard_star: bool
    bonus_star: bool
    xp_awarded: int
    profile: LearningProfileSnapshot


class LearningSimulationLink(Payload):
    session_id: str | None
    url: str
    policy: LessonSimulationPolicy


class LearningRunResponse(Payload):
    id: str
    purpose: Literal['diagnostic', 'practice', 'bonus', 'assessment', 'review']
    module_id: str
    level_id: str | None
    content_version: str
    status: Literal['active', 'completed']
    current_step: LearningTask | None
    feedback: list[LearningFeedback]
    progress: LearningProgress
    result: LearningResult | None
    review_id: str | None = None
    simulation: LearningSimulationLink | None = None

class StartLevel(BaseCommand):
    purpose: Literal['practice', 'bonus'] = 'practice'


class StepAnswer(Payload):
    acknowledged: bool | None = Field(default=None, strict=True)
    option_id: str | None = Field(default=None, min_length=1, max_length=100)
    assignments: dict[str, str] | None = None
    confidence: int | None = Field(default=None, ge=0, le=100, strict=True)


class SubmitStep(BaseCommand):
    answer: StepAnswer


class StartDiagnosticRun(BaseCommand):
    pass


class StartAssessmentRun(BaseCommand):
    pass


class StartReviewRun(BaseCommand):
    pass
