import asyncio
from contextlib import asynccontextmanager
import hashlib
from weakref import WeakValueDictionary

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
import uvicorn

from app.config import Settings
from app.db import Database
from app.auth import router as auth_router
from app.learning import router as learning_router
from app.learning_runs import router as learning_runs_router
from app.rewards import router as rewards_router
from app.challenges.api import router as challenges_router
from app.economy import router as economy_router
from app import gameplay
from app.quizzes.api import router as quizzes_router
from app.simulation.api import router as simulation_router
from app.simulation.lesson_api import router as lesson_simulation_router


def create_app(settings: Settings | None = None, content: dict | None = None) -> FastAPI:
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
        if content is None:
            from app.content.catalog import load_catalog
            from app.content.validate import validate_catalog
            application.state.catalog = load_catalog()
            validate_catalog(application.state.catalog)
        else:
            application.state.catalog = content
        firebase_app = None
        if settings.auth_mode == 'firebase':
            import firebase_admin
            from app.db import uid
            firebase_app = firebase_admin.initialize_app(options={'projectId': settings.firebase_project_id}, name='learning-' + uid())
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
    application.state.challenge_start_handler = gameplay.start_policy
    application.state.challenge_created_handler = gameplay.created
    application.state.challenge_result_handler = gameplay.complete_policy
    application.state.challenge_abandon_handler = gameplay.abandoned
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

    @application.get('/')
    def read_root():
        return {'message': "Trader's Edge API is running"}

    @application.get('/health')
    def health_check():
        return {'status': 'ok'}

    application.include_router(auth_router)
    application.include_router(learning_router)
    application.include_router(learning_runs_router)
    application.include_router(rewards_router)
    application.include_router(challenges_router)
    application.include_router(economy_router)
    application.include_router(gameplay.router)
    application.include_router(quizzes_router)
    application.include_router(simulation_router)
    application.include_router(lesson_simulation_router)
    return application


app = create_app()


def main():
    uvicorn.run('app.main:app', host='127.0.0.1', port=8000, reload=True)


if __name__ == '__main__':
    main()
