import asyncio
from contextlib import asynccontextmanager
import hashlib
from weakref import WeakValueDictionary

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
import uvicorn

from app.config import Settings
from app.db import Database
from app.auth import router as auth_router
from app.public_config import router as public_config_router
from app.campaign.api import router as campaign_router
from app.campaign.games import before_start, resolve_game
from app.campaign.settlement import settle_game
from app.content.bundle import Content, load_content, require_approved_content
from app.game.api import router as games_router
from app.multiplayer.api import router as multiplayer_router
from app.player.api import router as player_router
from app.quiz.api import router as quiz_router
from app.research import router as research_router


def firebase_credential(settings):
    """A service-account key from FIREBASE_SERVICE_ACCOUNT, else Application Default Credentials."""
    if not settings.firebase_credentials:
        return None
    import json
    from firebase_admin import credentials
    return credentials.Certificate(json.loads(settings.firebase_credentials))


def create_app(settings: Settings | None = None, content: Content | None = None) -> FastAPI:
    """`content` replaces the authored content loaded from disk (tests pass fixtures)."""
    settings = settings or Settings.from_env()
    settings.validate()

    @asynccontextmanager
    async def lifespan(application):
        database = Database(settings)
        application.state.db = database
        if settings.auto_migrate:
            await database.migrate()
        else:
            await database.check_schema()
        application.state.content = content or load_content()
        firebase_app = None
        if settings.auth_mode == 'firebase':
            import firebase_admin
            from app.db import uid
            firebase_app = firebase_admin.initialize_app(firebase_credential(settings), options={'projectId': settings.firebase_project_id},
                                                         name='learning-' + uid())
            application.state.firebase_app = firebase_app
        try:
            yield
        finally:
            if firebase_app:
                import firebase_admin
                firebase_admin.delete_app(firebase_app)
            await database.engine.dispose()

    application = FastAPI(title="Trader's Edge API", lifespan=lifespan)
    application.state.settings = settings

    async def resolve(db, profile, body):
        return await resolve_game(application.state.content, db, profile, body)

    async def settle(db, profile, game, participant, result):
        return await settle_game(application.state.content, db, profile, game, participant, result)

    async def check_start(db, profile, game):
        await before_start(application.state.content, db, profile, game)

    application.state.resolve_game = resolve
    application.state.settle_game = settle
    application.state.before_start = check_start
    locks = WeakValueDictionary()
    application.add_middleware(CORSMiddleware, allow_origins=list(settings.allowed_origins), allow_credentials=True, allow_methods=['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allow_headers=['Content-Type', 'Authorization'])

    @application.middleware('http')
    async def request_boundary(request: Request, call_next):
        if request.url.path.startswith('/api/') and request.method not in {'GET', 'HEAD', 'OPTIONS'}:
            origin = request.headers.get('origin')
            bearer = settings.auth_mode == 'firebase' and request.headers.get('authorization', '').startswith('Bearer ')
            if origin not in settings.allowed_origins and (origin is not None or not bearer):
                return JSONResponse(status_code=403, content={'detail': 'A permitted request origin is required'})
            if len(await request.body()) > 65536:
                return JSONResponse(status_code=413, content={'detail': 'Request body is too large'})
            identity = request.cookies.get(settings.cookie_name) or request.headers.get('authorization')
            key = hashlib.sha256(identity.encode()).hexdigest() if identity else None
            lock = locks.setdefault(key, asyncio.Lock()) if key else asyncio.Lock()
            try:
                async with lock:
                    return await call_next(request)
            except IntegrityError:
                return JSONResponse(status_code=409, content={'detail': 'A concurrent update completed first; retry with the same idempotency key'})
        return await call_next(request)

    @application.middleware('http')
    async def private_responses(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store'
            response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    @application.get('/', operation_id='getRoot', openapi_extra={'x-client-auth': 'none'})
    def read_root():
        return {'message': "Trader's Edge API is running"}

    @application.get('/health', operation_id='getHealth', openapi_extra={'x-client-auth': 'none'})
    def health_check():
        return {'status': 'ok'}

    application.include_router(auth_router)
    application.include_router(public_config_router)
    approved = [Depends(require_approved_content)]
    application.include_router(games_router, dependencies=approved)
    application.include_router(campaign_router)
    application.include_router(player_router)
    application.include_router(quiz_router, dependencies=approved)
    application.include_router(multiplayer_router, dependencies=approved)
    application.include_router(research_router)
    return application


app = create_app()


def main():
    uvicorn.run('app.main:app', host='127.0.0.1', port=8000, reload=True)


if __name__ == '__main__':
    main()
