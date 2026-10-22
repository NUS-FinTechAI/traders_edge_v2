from typing import Literal

from pydantic import BaseModel, Field

from app.api_schemas.shared_schema import BaseCommand, Payload

type Experience = Literal['none', 'some', 'regular']
type MarketFrequency = Literal['never', 'monthly', 'weekly', 'daily']
type OnboardingStatus = Literal['unavailable', 'pending', 'completed', 'skipped']
type PriorKnowledgeGroup = Literal['novice', 'intermediate', 'experienced', 'unknown']
type Cohort = Literal['all', 'novice', 'intermediate', 'experienced', 'unknown']
type MetricStatus = Literal['unvalidated']
type CsvKind = Literal['participants', 'matches', 'game-events', 'check-answers', 'quiz-answers', 'prior-knowledge']

UNVALIDATED = Field(default='unvalidated', description='No learning metric here is a validated measure')


class InstrumentOption(BaseModel):
    id: str
    text: str


class SelfReportQuestion(BaseModel):
    id: Literal['experience', 'brokerage_account', 'market_frequency', 'confidence']
    prompt: str
    options: list[InstrumentOption]


class ConceptQuestion(BaseModel):
    id: str
    kind: Literal['mc', 'true_false']
    prompt: str
    options: list[InstrumentOption]


class PriorKnowledgeInstrument(BaseModel):
    version: str
    self_report: list[SelfReportQuestion]
    items: list[ConceptQuestion] = Field(description='Answers and explanations are never sent to participants')


class OnboardingView(BaseModel):
    due: bool = Field(description='True only for a participant with active consent who has neither completed nor skipped it')
    status: OnboardingStatus
    instrument: PriorKnowledgeInstrument | None


class SelfReport(Payload):
    experience: Experience | None = None
    brokerage_account: bool | None = None
    market_frequency: MarketFrequency | None = None
    confidence: int | None = Field(default=None, ge=1, le=5)


class ConceptAnswer(Payload):
    item_id: str = Field(min_length=1, max_length=120)
    option_id: str | None = Field(default=None, max_length=100, description='null records "Not sure"')


class SubmitPriorKnowledge(BaseCommand):
    instrument_version: str = Field(min_length=1, max_length=40)
    self_report: SelfReport
    answers: list[ConceptAnswer] = Field(max_length=50)
    elapsed_seconds: int | None = Field(default=None, ge=0, le=86400, description='Client-measured time on the instrument')


class SkipPriorKnowledge(BaseCommand):
    instrument_version: str = Field(min_length=1, max_length=40)


class ResearchAccess(BaseModel):
    allowed: bool


class GroupCount(BaseModel):
    group: PriorKnowledgeGroup
    participants: int


class OnboardingCounts(BaseModel):
    completed: int
    skipped: int
    pending: int


class ModeCount(BaseModel):
    mode: str
    matches: int


class FunnelStep(BaseModel):
    step: str
    label: str
    participants: int


class ChapterFunnel(BaseModel):
    chapter_id: str
    number: int
    title: str
    steps: list[FunnelStep]


class ResearchSummary(BaseModel):
    generated_at: str
    policy_version: str
    instrument_version: str
    metric_status: MetricStatus = UNVALIDATED
    scope: str
    participants: int
    onboarding: OnboardingCounts
    groups: list[GroupCount]
    total_matches: int
    matches: list[ModeCount]
    funnel: list[ChapterFunnel]


class DecisionParts(BaseModel):
    missions: float | None
    plan: float | None
    risk: float | None
    overtrading: float | None


class MetricSummary(BaseModel):
    matches: int = Field(description='Finished matches, forfeits included')
    participants: int
    forfeited: int
    mean_profit: float | None = Field(description='Mean over matches that were not forfeited')
    mean_decision_score: float | None = Field(description='0–100, unvalidated heuristic')
    decision_parts: DecisionParts = Field(description='Mean share (0–1) of each component\'s points; null where never available')
    mission_completion: float | None = Field(description='Mean share of missions completed')
    win_rate: float | None


class PhaseComparison(BaseModel):
    first_attempts: MetricSummary
    all_attempts: MetricSummary


class PairedChange(BaseModel):
    participants: int = Field(description='Participants with a finished, unforfeited first Preview and first Chapter Boss')
    mean_profit_change: float | None
    mean_decision_score_change: float | None


class CohortPrePost(BaseModel):
    cohort: Cohort
    preview: PhaseComparison
    boss: PhaseComparison
    paired_first_attempts: PairedChange


class ChapterPrePost(BaseModel):
    chapter_id: str
    number: int
    title: str
    cohorts: list[CohortPrePost]


class PrePostReport(BaseModel):
    metric_status: MetricStatus = UNVALIDATED
    note: str
    chapters: list[ChapterPrePost]


class TrendPoint(BaseModel):
    attempt: int
    label: str
    matches: int
    mean_decision_score: float | None


class TrendSeries(BaseModel):
    kind: Literal['preview', 'level', 'boss', 'gate', 'daily', 'practice', 'private', 'ranked']
    points: list[TrendPoint]


class DecisionTrends(BaseModel):
    metric_status: MetricStatus = UNVALIDATED
    note: str
    series: list[TrendSeries]


class LevelAccuracy(BaseModel):
    chapter_id: str
    level_id: str
    level_number: int
    title: str
    participants: int
    answers: int
    first_try_correct: int
    accuracy: float | None


class CheckAccuracy(BaseModel):
    metric_status: MetricStatus = UNVALIDATED
    note: str
    levels: list[LevelAccuracy]


class QuizStats(BaseModel):
    attempts: int
    participants: int
    mean_score_pct: float | None
    pass_rate: float | None


class ChapterQuiz(BaseModel):
    chapter_id: str
    number: int
    title: str
    first_attempts: QuizStats
    all_attempts: QuizStats
    answers: int = Field(description='First answers to this chapter\'s bank questions in every quiz kind')
    answer_accuracy: float | None


class QuizPerformance(BaseModel):
    metric_status: MetricStatus = UNVALIDATED
    note: str
    chapters: list[ChapterQuiz]
