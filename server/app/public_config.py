from typing import Annotated, Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field


router = APIRouter(prefix='/api/config', tags=['config'])


class GuestAuthConfig(BaseModel):
    mode: Literal['guest']
    firebase_project_id: None


class FirebaseAuthConfig(BaseModel):
    mode: Literal['firebase']
    firebase_project_id: str = Field(min_length=1)


class PublicConfig(BaseModel):
    auth: Annotated[GuestAuthConfig | FirebaseAuthConfig, Field(discriminator='mode')]


@router.get('', response_model=PublicConfig, operation_id='getConfig', openapi_extra={'x-client-auth': 'none'})
def get_config(request: Request) -> PublicConfig:
    settings = request.app.state.settings
    if settings.auth_mode == 'firebase':
        return PublicConfig(auth=FirebaseAuthConfig(mode='firebase', firebase_project_id=settings.firebase_project_id))
    return PublicConfig(auth=GuestAuthConfig(mode='guest', firebase_project_id=None))
