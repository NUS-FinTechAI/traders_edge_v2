from typing import Annotated, Literal
from app.api_schemas.shared_schema import Payload
from pydantic import Field

class GuestAuthConfig(Payload):
    mode: Literal['guest']
    firebase_project_id: None


class FirebaseAuthConfig(Payload):
    mode: Literal['firebase']
    firebase_project_id: str = Field(min_length=1)


class PublicConfig(Payload):
    auth: Annotated[GuestAuthConfig | FirebaseAuthConfig, Field(discriminator='mode')]
