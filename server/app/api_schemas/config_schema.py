from typing import Annotated, Literal
from pydantic import BaseModel, Field

class GuestAuthConfig(BaseModel):
    mode: Literal['guest']
    firebase_project_id: None


class FirebaseAuthConfig(BaseModel):
    mode: Literal['firebase']
    firebase_project_id: str = Field(min_length=1)


class PublicConfig(BaseModel):
    auth: Annotated[GuestAuthConfig | FirebaseAuthConfig, Field(discriminator='mode')]
