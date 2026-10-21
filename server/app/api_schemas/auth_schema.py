from datetime import datetime
from typing import Literal

from pydantic import field_serializer
from app.api_schemas.shared_schema import Payload


class GuestSession(Payload):
    profile_id: str
    auth_mode: Literal['guest']
    expires_at: datetime

    @field_serializer('expires_at')
    def serialize_expiry(self, value: datetime) -> str:
        return value.isoformat()
