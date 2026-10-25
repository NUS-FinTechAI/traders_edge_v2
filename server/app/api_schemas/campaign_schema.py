from typing import Literal

from pydantic import BaseModel, Field

from app.api_schemas.shared_schema import Payload

NodeState = Literal['locked', 'open', 'done']


class Reward(BaseModel):
    kind: Literal['avatar', 'title', 'badge']
    id: str
    name: str
    image: str | None = Field(default=None, description='Art key for avatars (e.g. "parrot"); null when the item has no art')


class Gate(BaseModel):
    scenario_id: str
    won: bool
    attempts: int


class ChapterCard(BaseModel):
    id: str
    number: int
    title: str
    region: str
    tagline: str
    icon: str
    state: Literal['locked', 'open', 'complete']
    unlocked_by: Literal['start', 'boss', 'gate'] | None
    stars: int
    stars_total: int
    levels_done: int
    levels_total: int
    gate: Gate | None


class ContinueTarget(BaseModel):
    chapter_id: str
    node_id: str
    label: str


class Campaign(BaseModel):
    chapters: list[ChapterCard]
    next: ContinueTarget | None


class Stars(BaseModel):
    normal: bool
    special: bool


class MapNode(BaseModel):
    id: str
    kind: Literal['preview', 'level', 'reward', 'boss']
    title: str
    summary: str
    state: NodeState
    stars: Stars | None
    objectives: list[str]
    xp: int
    reward: Reward | None
    scenario_id: str | None
    best_profit: float | None
    attempts: int
    locked_reason: str | None


class ChapterMap(BaseModel):
    chapter: ChapterCard
    nodes: list[MapNode]


class Term(BaseModel):
    term: str
    definition: str


class Card(BaseModel):
    title: str
    body: str
    visual: str | None


class Option(BaseModel):
    id: str
    text: str


class CheckQuestion(BaseModel):
    id: str
    kind: Literal['mc', 'true_false']
    prompt: str
    options: list[Option]


class MissionSummary(BaseModel):
    tier: Literal['basic', 'bonus']
    text: str


class PracticeSummary(BaseModel):
    scenario_id: str
    title: str
    briefing: str
    missions: list[MissionSummary]


class LevelProgress(BaseModel):
    check_done: bool
    check_best: int | None
    normal_star: bool
    special_star: bool
    plays: int


class Level(BaseModel):
    id: str
    chapter_id: str
    number: int
    title: str
    summary: str
    objectives: list[str]
    terms: list[Term]
    cards: list[Card]
    check: list[CheckQuestion]
    practice: PracticeSummary
    progress: LevelProgress


class CheckAnswerBody(Payload):
    question_id: str = Field(min_length=1, max_length=120)
    option_id: str = Field(min_length=1, max_length=100)


class CheckAnswer(BaseModel):
    correct: bool
    correct_option_id: str
    explanation: str
    first_try: bool = Field(description='The first answer to this question in the current run of the check')


class CheckComplete(BaseModel):
    first_try_correct: int = Field(description='Questions answered right on the first try in this run')
    first_ever_correct: int = Field(description="Questions answered right on the player's first-ever try (kept for research)")
    total: int
    xp: int
    practice_unlocked: bool


class ArchiveTerm(BaseModel):
    id: str
    term: str
    definition: str
    chapter_id: str
    level_id: str


class Archive(BaseModel):
    terms: list[ArchiveTerm]


class BossEntry(BaseModel):
    chapter_id: str
    kind: Literal['boss', 'gate']
    scenario_id: str
    title: str
    state: NodeState
    won: bool


class Bosses(BaseModel):
    bosses: list[BossEntry]


class BotSummary(BaseModel):
    bot_id: str
    name: str
    avatar: str
    tier: str


class PracticeScenario(BaseModel):
    id: str
    title: str
    briefing: str
    difficulty: int
    bots: list[BotSummary]


class PracticeScenarios(BaseModel):
    scenarios: list[PracticeScenario]


class DailyScenario(BaseModel):
    id: str
    title: str
    briefing: str
    ticks: int


class Opponent(BotSummary):
    style: str


class DailyWeek(BaseModel):
    doubloons: int
    target: int
    resets_at: str
    wins_this_week: int


class Daily(BaseModel):
    date: str
    unlocked: bool
    locked_reason: str | None
    scenario: DailyScenario
    opponent: Opponent
    won_today: bool
    attempts_today: int
    cooldown_until: str | None
    refresh_cost_gems: int
    active_game_id: str | None = Field(description="Today's unfinished daily match to resume; a new daily is refused while it is open")
    week: DailyWeek
