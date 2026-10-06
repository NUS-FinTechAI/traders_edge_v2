from fastapi import HTTPException

from app.db import now
from app.economy import ServerChallengeResult, settle_challenge
from app.simulation.api import require_access


async def access(request, db, user, mode):
    await require_access(request, db, user, 'endless' if mode == 'public_ranked' else 'guided')


async def complete(db, user, result):
    if result.get('mode') != 'public_ranked' or result.get('user_id') != user.id:
        raise HTTPException(409, 'Public match evidence is unavailable')
    return await settle_challenge(db, user, ServerChallengeResult(
        attempt_id=result['attempt_id'], mode='public_ranked', won=result['win'], completed_at=now()))
