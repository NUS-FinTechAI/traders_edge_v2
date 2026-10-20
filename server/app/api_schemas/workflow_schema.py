from typing import Annotated, Literal

from pydantic import Field

from app.api_schemas.auth_schema import UserProfile
from app.api_schemas.gameplay_schema import ModuleMap
from app.api_schemas.learning_run_schema import LearningRunResponse
from app.api_schemas.shared_schema import Payload


class PracticeEligibility(Payload):
    simulation: bool
    multiplayer: bool
    endless: bool
    prerequisite_module_ids: list[str]
    private_multiplayer: bool
    public_ranked: bool
    private_multiplayer_prerequisite_module_ids: list[str]
    public_ranked_prerequisite_module_ids: list[str]
    private_multiplayer_missing_module_ids: list[str]
    public_ranked_missing_module_ids: list[str]


class LearningNextAction(Payload):
    kind: Literal['resume', 'diagnostic', 'level', 'legacy_lesson', 'assessment', 'legacy_assessment']
    module_id: str
    run_id: str | None = None
    level_id: str | None = None


class GameLearningAction(Payload):
    kind: Literal['diagnostic', 'level', 'legacy_lesson', 'assessment', 'legacy_assessment']
    module_id: str
    level_id: str | None = None


class GameResumeAction(Payload):
    kind: Literal['resume_learning']
    module_id: str
    level_id: str | None
    run_id: str
    purpose: Literal['diagnostic', 'practice', 'assessment']


class GameBossAction(Payload):
    kind: Literal['chapter_exit_boss']
    module_id: str
    action: Literal['start', 'resume', 'retry']
    available: bool
    reason: Literal['active_challenge_limit'] | None
    attempt_id: str | None
    previous_attempt_id: str | None
    blocking_attempt_ids: list[str]


type GameNextAction = Annotated[GameLearningAction | GameResumeAction | GameBossAction, Field(discriminator='kind')]


class LearningWorkflowResponse(Payload):
    profile: UserProfile
    resume: LearningRunResponse | None
    next_action: LearningNextAction | None
    modules: list[ModuleMap]
    practice_eligibility: PracticeEligibility
    game_next_action: GameNextAction | None
