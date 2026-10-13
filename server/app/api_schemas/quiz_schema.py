
from app.api_schemas.shared_schema import BaseCommand
from pydantic import Field
from app.api_schemas.learning_schema import Answer


class StartQuizAttempt(BaseCommand):
    module_id: str | None = Field(default=None, min_length=1, max_length=120)
    room_id: str | None = Field(default=None, min_length=1, max_length=36)


class StartQuizRoom(BaseCommand):
    pass


class CloseQuizRoom(BaseCommand):
    pass


class QuizResponse(BaseCommand):
    answer: Answer


class CreateQuiz(BaseCommand):
    title: str = Field(min_length=2, max_length=80)
    question_ids: list[str] = Field(min_length=1, max_length=20)
    attempt_limit: int = Field(default=1, ge=1, le=3, strict=True)


class JoinQuiz(BaseCommand):
    join_code: str = Field(pattern=r'^[A-Z2-9]{8}$')
