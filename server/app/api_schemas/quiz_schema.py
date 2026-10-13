
from app.api_schemas.shared_schema import Command
from pydantic import Field
from app.api_schemas.learning_schema import Answer


class Start(Command):
    module_id: str | None = Field(default=None, min_length=1, max_length=120)
    room_id: str | None = Field(default=None, min_length=1, max_length=36)


class Response(Command):
    answer: Answer


class CreateRoom(Command):
    title: str = Field(min_length=2, max_length=80)
    question_ids: list[str] = Field(min_length=1, max_length=20)
    attempt_limit: int = Field(default=1, ge=1, le=3, strict=True)


class Join(Command):
    join_code: str = Field(pattern=r'^[A-Z2-9]{8}$')
