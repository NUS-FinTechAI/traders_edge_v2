
from app.api_schemas.shared_schema import BaseCommand
from app.api_schemas.simulation_schema import Order
from pydantic import Field


class TickCommand(BaseCommand):
    expected_tick: int = Field(ge=0, le=29, strict=True)


class TickOrder(Order):
    expected_tick: int = Field(ge=0, le=29, strict=True)


class JoinMultiplayerLobby(BaseCommand):
    code: str = Field(min_length=16, max_length=16, pattern=r'^[A-F0-9]{16}$')


class AbandonMultiplayerMatch(BaseCommand):
    pass


class JoinMultiplayerMatchmaking(BaseCommand):
    pass


class CreateMultiplayerLobby(BaseCommand):
    pass

class StartMultiplayerMatch(BaseCommand):
    pass
