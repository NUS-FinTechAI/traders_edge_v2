from app.api_schemas.shared_schema import Payload
from pydantic import Field, field_validator
from datetime import datetime
from app.api_schemas.learning_run_schema import TaskEntry


class ReviewQuestion(Payload):
    id: str
    prompt: str
    options: list[TaskEntry]


class ReviewSummary(Payload):
    id: str
    lesson_id: str
    title: str
    due_at: str
    completed: bool
    due: bool
    questions: list[ReviewQuestion]
    interactive_required: bool
    reflection_required: bool
    run_id: str | None
    active_run_id: str | None

    @field_validator('due_at', mode='before')
    @classmethod
    def timestamp(cls, value):
        return value.isoformat() if isinstance(value, datetime) else value


class ReviewList(Payload):
    reviews: list[ReviewSummary]


class Answer(Payload):
    question_id: str = Field(min_length=1, max_length=120)
    option_id: str = Field(min_length=1, max_length=100)
    confidence: int | None = Field(default=None, ge=0, le=100, strict=True)


class Submission(Payload):
    idempotency_key: str = Field(min_length=8, max_length=100, pattern=r'^[a-zA-Z0-9_-]+$')
    answers: list[Answer] = Field(min_length=1, max_length=100)
    reflection: str = Field(min_length=10, max_length=2000)


class ProfileUpdate(Payload):
    display_name: str | None = Field(default=None, min_length=2, max_length=40)
    leaderboard_opt_in: bool | None = None
    analytics_opt_in: bool | None = None

    @field_validator('display_name')
    @classmethod
    def readable_name(cls, value):
        if value is not None and (not value.isprintable() or '<' in value or '>' in value):
            raise ValueError('Use a readable pseudonym without markup')
        return value


class JournalCreate(Payload):
    text: str = Field(min_length=10, max_length=2000)
    lesson_id: str | None = Field(default=None, max_length=120)
