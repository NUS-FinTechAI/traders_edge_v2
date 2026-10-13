from pydantic import Field
from app.api_schemas.shared_schema import BaseCommand
from typing import Literal


class EconomyCommand(BaseCommand):
    policy_version: Literal['1'] = '1'

class Purchase(EconomyCommand):
    item_id: str = Field(min_length=1, max_length=120)
