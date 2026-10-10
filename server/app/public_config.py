from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel


router = APIRouter(prefix='/api/config', tags=['config'])


class PublicAuthConfig(BaseModel):
    mode: Literal['guest', 'firebase']
    firebase_project_id: str | None


class PublicConfig(BaseModel):
    auth: PublicAuthConfig


@router.get('', response_model=PublicConfig)
def get_config(request: Request) -> PublicConfig:
    settings = request.app.state.settings
    return PublicConfig(auth=PublicAuthConfig(
        mode=settings.auth_mode,
        firebase_project_id=settings.firebase_project_id if settings.auth_mode == 'firebase' else None,
    ))
