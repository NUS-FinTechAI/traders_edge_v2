from pydantic import Field
from app.api_schemas.shared_schema import Command

class Purchase(Command):
    item_id: str = Field(min_length=1, max_length=120)
