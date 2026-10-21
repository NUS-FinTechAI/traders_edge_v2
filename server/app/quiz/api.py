from typing import Annotated

from fastapi import APIRouter, Depends, Path, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api_schemas.quiz_schema import CreateQuizRoom, QuizAnswer, QuizAttempt, QuizList, QuizRoom, StartQuiz
from app.auth import current_profile
from app.db import Profile, get_db
from app.quiz import service

router = APIRouter(prefix='/api/quizzes', tags=['quizzes'])
DB = Annotated[AsyncSession, Depends(get_db, scope='function')]
User = Annotated[Profile, Depends(current_profile)]
Id = Annotated[str, Path(max_length=36)]


def content(request):
    return request.app.state.content


@router.get('', response_model=QuizList, operation_id='listQuizzes')
async def list_quizzes(request: Request, db: DB, user: User):
    return await service.topics(db, content(request), user)


@router.post('/attempts', response_model=QuizAttempt, status_code=201, operation_id='startQuizAttempt')
async def start_attempt(body: StartQuiz, request: Request, db: DB, user: User):
    attempt = await service.start(db, content(request), user, body.topic_id, body.room_code)
    return service.attempt_view(content(request), attempt)


@router.post('/attempts/{attempt_id}/answers', response_model=QuizAttempt, operation_id='answerQuiz')
async def answer(attempt_id: Id, body: QuizAnswer, request: Request, db: DB, user: User):
    attempt = await service.answer(db, content(request), user, attempt_id, body)
    return service.attempt_view(content(request), attempt)


@router.get('/attempts/{attempt_id}', response_model=QuizAttempt, operation_id='getQuizAttempt')
async def get_attempt(attempt_id: Id, request: Request, db: DB, user: User):
    return service.attempt_view(content(request), await service.owned_attempt(db, user, attempt_id))


@router.post('/rooms', response_model=QuizRoom, status_code=201, operation_id='createQuizRoom')
async def create_room(body: CreateQuizRoom, request: Request, db: DB, user: User):
    room = await service.create_room(db, content(request), user, body)
    return await service.room_view(db, content(request), user, room.id)


@router.get('/rooms/{room_id}', response_model=QuizRoom, operation_id='getQuizRoom')
async def get_room(room_id: Id, request: Request, db: DB, user: User):
    return await service.room_view(db, content(request), user, room_id)
