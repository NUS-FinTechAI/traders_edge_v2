"""Six-character join codes for quiz rooms and lobbies, without the look-alike characters 0, O, 1 and I."""

import secrets

from fastapi import HTTPException
from sqlalchemy import select

ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
LENGTH = 6


def normalise(code):
    return code.strip().upper()


async def new_code(db, model):
    for _ in range(20):
        code = ''.join(secrets.choice(ALPHABET) for _ in range(LENGTH))
        if await db.scalar(select(model.id).where(model.code == code)) is None:
            return code
    raise HTTPException(503, 'Could not create a join code; try again')
