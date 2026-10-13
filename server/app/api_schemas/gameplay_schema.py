from app.api_schemas.shared_schema import Payload
from typing import Literal

class PublicAdventureLevel(Payload):
    id: str
    title: str
    objective: str
    required_steps: int
    bonus_steps: int


class PublicAdventureChapter(Payload):
    module_id: str
    title: str
    order: int
    description: str
    introductory_assessment: bool
    levels: list[PublicAdventureLevel]


class PublicAdventureResponse(Payload):
    chapters: list[PublicAdventureChapter]


class LevelProgress(Payload):
    id: str
    title: str
    objective: str
    unlocked: bool
    status: Literal['completed', 'active', 'available', 'locked']
    standard_star: bool
    bonus_star: bool
    completion_source: Literal['interactive', 'legacy'] | None
    bonus_available: bool
    active_run_id: str | None


class DiagnosticProgress(Payload):
    required: bool
    completed: bool
    run_id: str | None


class ModuleMap(Payload):
    module_id: str
    title: str
    content_version: str | None
    interactive_available: bool
    unlocked: bool
    prerequisite_module_ids: list[str]
    mastered: bool
    diagnostic: DiagnosticProgress
    levels: list[LevelProgress]
    assessment_available: bool


class LevelBriefing(LevelProgress):
    source_basis: list[str]
    required_steps: int
    bonus_steps: int
    completion_rule: str
    bonus_rule: str
    review_after_days: int


class LevelResponse(Payload):
    module_id: str
    content_version: str | None
    interactive_available: bool
    level: LevelBriefing


class StarProgress(Payload):
    earned: int
    total: int


class BossAvailability(Payload):
    available: bool
    reason: Literal['introductory_diagnostic', 'chapter_locked', 'required_levels_incomplete',
                    'diagnostic_incomplete', 'active_challenge_limit'] | None
    active_attempt_ids: list[str]


class ActiveChapterRun(Payload):
    run_id: str
    purpose: Literal['diagnostic', 'practice', 'bonus', 'assessment']
    level_id: str | None


class AdventureChapter(Payload):
    module_id: str
    title: str
    order: int
    unlocked: bool
    early_entry_available: bool
    entry_boss_passed: bool
    exit_boss_passed: bool
    completed_required_levels: int
    total_required_levels: int
    beginner_recommendation: str
    assessment_basis: str
    normal_stars: StarProgress
    special_stars: StarProgress
    entry_boss: BossAvailability
    exit_boss: BossAvailability
    active_learning_runs: list[ActiveChapterRun]


class AdventureResponse(Payload):
    policy_version: str
    chapters: list[AdventureChapter]
