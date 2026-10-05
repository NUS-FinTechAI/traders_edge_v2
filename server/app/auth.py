import asyncio
from datetime import timedelta
import hashlib
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import Profile, SessionToken, aware, get_db, now

router = APIRouter(prefix='/api')


def token_hash(value):
    return hashlib.sha256(value.encode()).hexdigest()


async def current_profile(request: Request, db: AsyncSession = Depends(get_db, scope='function')) -> Profile:
    settings = request.app.state.settings
    if settings.auth_mode == 'firebase':
        header = request.headers.get('authorization', '')
        if not header.startswith('Bearer '):
            raise HTTPException(401, 'A verified sign-in token is required')
        try:
            from firebase_admin import auth
            claims = await asyncio.to_thread(auth.verify_id_token, header[7:], app=request.app.state.firebase_app, check_revoked=True)
            firebase_uid = claims['uid']
        except Exception:
            raise HTTPException(401, 'Sign-in could not be verified') from None
        profile = await db.scalar(select(Profile).where(Profile.firebase_uid == firebase_uid))
        if not profile:
            try:
                async with db.begin_nested():
                    profile = Profile(firebase_uid=firebase_uid)
                    db.add(profile)
                    await db.flush()
            except IntegrityError:
                profile = await db.scalar(select(Profile).where(Profile.firebase_uid == firebase_uid))
                if not profile:
                    raise HTTPException(409, 'Sign-in profile creation is in progress; retry') from None
    else:
        token = request.cookies.get(settings.cookie_name)
        session = await db.get(SessionToken, token_hash(token)) if token else None
        if not session or aware(session.expires_at) <= now():
            raise HTTPException(401, 'Start a guest session or sign in')
        profile = await db.get(Profile, session.user_id)
    if not profile:
        raise HTTPException(401, 'Session is unavailable')
    if request.method not in {'GET', 'HEAD', 'OPTIONS'}:
        profile = await db.scalar(select(Profile).where(Profile.id == profile.id).with_for_update())
    return profile


@router.post('/session')
async def guest_session(request: Request, response: Response, db: AsyncSession = Depends(get_db, scope='function')):
    settings = request.app.state.settings
    if settings.auth_mode != 'guest':
        raise HTTPException(403, 'Guest sessions are disabled; use verified sign-in')
    previous = request.cookies.get(settings.cookie_name)
    existing = await db.get(SessionToken, token_hash(previous)) if previous else None
    if existing and aware(existing.expires_at) > now():
        return {'profile_id': existing.user_id, 'auth_mode': 'guest', 'expires_at': existing.expires_at}
    token = secrets.token_urlsafe(32)
    profile = Profile()
    db.add(profile)
    await db.flush()
    expires_at = now() + timedelta(days=settings.session_days)
    db.add(SessionToken(token_hash=token_hash(token), user_id=profile.id, expires_at=expires_at))
    response.set_cookie(settings.cookie_name, token, max_age=settings.session_days * 86400, httponly=True, samesite='strict', secure=settings.environment == 'production', path='/')
    return {'profile_id': profile.id, 'auth_mode': 'guest', 'expires_at': expires_at}


@router.delete('/session', status_code=204)
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db, scope='function'), profile: Profile = Depends(current_profile)):
    settings = request.app.state.settings
    token = request.cookies.get(settings.cookie_name)
    existing = await db.get(SessionToken, token_hash(token)) if token else None
    if existing:
        await db.delete(existing)
    response.delete_cookie(settings.cookie_name, path='/', httponly=True, samesite='strict')
