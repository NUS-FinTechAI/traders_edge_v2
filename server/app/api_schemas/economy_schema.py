from pydantic import Field
from app.api_schemas.shared_schema import Command as BaseCommand
from typing import Literal


class Command(BaseCommand):
    policy_version: Literal['1'] = '1'

class Purchase(Command):
    item_id: str = Field(min_length=1, max_length=120)
