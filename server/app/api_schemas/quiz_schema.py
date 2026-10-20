
from app.api_schemas.shared_schema import BaseCommand
from pydantic import Field
from app.api_schemas.learning_schema import Answer
from app.api_schemas.shared_schema import Payload
from datetime import datetime
from typing import Literal
from pydantic import field_validator


class StartQuizAttempt(BaseCommand):
    module_id: str | None = Field(default=None, min_length=1, max_length=120)
    room_id: str | None = Field(default=None, min_length=1, max_length=36)


class StartQuizRoom(BaseCommand):
    pass


class CloseQuizRoom(BaseCommand):
    pass


class QuizResponse(BaseCommand):
    answer: Answer


class CreateQuizRoom(BaseCommand):
    title: str = Field(min_length=2, max_length=80)
    question_ids: list[str] = Field(min_length=1, max_length=20)
    attempt_limit: int = Field(default=1, ge=1, le=3, strict=True)


class JoinQuizRoom(BaseCommand):
    join_code: str = Field(pattern=r'^[A-Z2-9]{8}$')


class QuizOption(Payload):
    id: str
    text: str


class QuizQuestion(Payload):
    id: str
    prompt: str
    options: list[QuizOption]


class QuizForm(Payload):
    module_id: str
    title: str
    question_count: int
    attempt_limit: int
    pass_rule: str
    passing_xp: int
    source_basis: list[str]


class QuizFormsResponse(Payload):
    content_version: str
    policy_version: str
    instructor_authorized: bool
    forms: list[QuizForm]


class QuizBankQuestion(QuizQuestion):
    module_id: str


class QuizBankResponse(Payload):
    content_version: str
    questions: list[QuizBankQuestion]


class QuizFeedback(Payload):
    question_id: str
    correct: bool
    selected_option_id: str
    correct_option_id: str
    explanation: str
    confidence: int | None


class QuizFirstAnswer(Answer):
    recorded_at: str


class QuizResult(Payload):
    score: int
    passed: bool
    critical_passed: bool
    feedback: list[QuizFeedback]
    first_answers: list[QuizFirstAnswer]
    xp_earned: int


class QuizProgress(Payload):
    answered: int
    total: int


class QuizAttemptResponse(Payload):
    id: str
    quiz_id: str
    room_id: str | None
    content_version: str
    policy_version: str
    attempt_number: int
    status: Literal['active', 'completed']
    current_question: QuizQuestion | None
    progress: QuizProgress
    result: QuizResult | None
    title: str | None = None
    completed_questions: list[QuizQuestion] | None = None


class QuizAttemptSummary(Payload):
    id: str
    room_id: str | None
    quiz_id: str
    content_version: str
    attempt_number: int
    status: Literal['active', 'completed']
    created_at: str
    title: str | None = None

    @field_validator('created_at', mode='before')
    @classmethod
    def timestamp(cls, value):
        return value.isoformat() if isinstance(value, datetime) else value


class QuizAttemptList(Payload):
    attempts: list[QuizAttemptSummary]


class QuizRoomResponse(Payload):
    id: str
    host_id: str
    title: str
    join_code: str
    status: Literal['waiting', 'started', 'closed']
    content_version: str
    policy_version: str
    attempt_limit: int
    question_count: int
    member_count: int
    capacity: int
    private: Literal[True]
    xp_rewards: Literal[False]
    can_manage: bool | None = None


class QuizRoomList(Payload):
    rooms: list[QuizRoomResponse]


class QuizReportedAttempt(Payload):
    id: str
    attempt_number: int
    status: Literal['active', 'completed']
    result: QuizResult | None


class QuizReportedStudent(Payload):
    user_id: str
    display_name: str
    attempts: list[QuizReportedAttempt]


class QuizRoomReport(Payload):
    room: QuizRoomResponse
    questions: list[QuizQuestion]
    students: list[QuizReportedStudent]
