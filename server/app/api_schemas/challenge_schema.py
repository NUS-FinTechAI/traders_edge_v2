from pydantic import Field
from typing import Literal
from app.api_schemas.shared_schema import BaseCommand

class CreateChallenge(BaseCommand):
    mode: Literal['practice', 'daily', 'chapter_entry', 'chapter_exit'] = 'practice'
    module_id: str | None = Field(default=None, min_length=1, max_length=120)
    opponent_count: int = Field(default=1, ge=1, le=3, strict=True)


class AbandonChallenge(BaseCommand):
    pass
