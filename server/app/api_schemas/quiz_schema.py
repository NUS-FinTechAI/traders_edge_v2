from typing import Literal

from pydantic import BaseModel, Field

from app.api_schemas.shared_schema import Payload

TOPIC = r'^[a-z0-9]+(-[a-z0-9]+)*$'


class QuizTopic(BaseModel):
    id: str
    kind: Literal['chapter', 'review', 'mixed']
    title: str
    questions: int
    best: int | None = Field(description='Best score as a percentage')
    passed: bool
    locked: bool


class QuizRoomSummary(BaseModel):
    id: str
    title: str
    code: str
    is_host: bool
    members: int


class QuizList(BaseModel):
    topics: list[QuizTopic]
    rooms: list[QuizRoomSummary]


class StartQuiz(Payload):
    topic_id: str | None = Field(default=None, min_length=1, max_length=40, pattern=TOPIC)
    room_code: str | None = Field(default=None, min_length=6, max_length=6)


class QuizOption(BaseModel):
    id: str
    text: str


class QuizFeedback(BaseModel):
    option_id: str
    correct: bool
    correct_option_id: str
    explanation: str


class QuizQuestion(BaseModel):
    id: str
    prompt: str
    options: list[QuizOption]
    answered: QuizFeedback | None


class QuizAttempt(BaseModel):
    id: str
    title: str
    room_id: str | None
    status: Literal['active', 'complete']
    questions: list[QuizQuestion]
    score: int
    total: int
    passed: bool | None
    xp: int


class QuizAnswer(Payload):
    question_id: str = Field(min_length=1, max_length=120)
    option_id: str = Field(min_length=1, max_length=100)
    confidence: Literal['sure', 'think', 'guess'] | None = None


class CreateQuizRoom(Payload):
    topic_id: str = Field(min_length=1, max_length=40, pattern=TOPIC)
    title: str = Field(min_length=1, max_length=80)


class QuizRoomResult(BaseModel):
    name: str
    score: int | None
    total: int
    finished: bool


class QuizRoom(QuizRoomSummary):
    topic_title: str
    results: list[QuizRoomResult]
    my_attempt_id: str | None
