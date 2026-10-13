from fastapi import APIRouter, Request
from app.api_schemas.config_schema import PublicConfig, GuestAuthConfig, FirebaseAuthConfig

router = APIRouter(prefix='/api/config', tags=['config'])


@router.get('', response_model=PublicConfig, operation_id='getConfig', openapi_extra={'x-client-auth': 'none'})
def get_config(request: Request) -> PublicConfig:
    settings = request.app.state.settings
    if settings.auth_mode == 'firebase':
        return PublicConfig(auth=FirebaseAuthConfig(mode='firebase', firebase_project_id=settings.firebase_project_id))
    return PublicConfig(auth=GuestAuthConfig(mode='guest', firebase_project_id=None))
