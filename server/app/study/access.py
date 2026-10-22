"""Researcher authorisation and pseudonymous identifiers."""

import hashlib
import hmac
from typing import Annotated

from fastapi import Depends, HTTPException, Request

from app.auth import current_profile
from app.db import Profile
from app.research import study_policy

PSEUDONYM_LENGTH = 20
NOT_RESEARCHER = 'Researcher access is limited to the configured researcher accounts'
STUDY_DISABLED = 'Study enrollment is disabled or its policy is not configured'


def is_researcher(settings, profile):
    """Firebase uids on RESEARCHER_FIREBASE_UIDS; outside production also profile ids on RESEARCHER_PROFILE_IDS."""
    if profile.firebase_uid and profile.firebase_uid in settings.researcher_firebase_uids:
        return True
    return settings.environment != 'production' and profile.id in settings.researcher_profile_ids


def study_open(settings):
    secret = settings.research_pseudonym_secret
    return study_policy(settings)['available'] and isinstance(secret, str) and bool(secret.strip())


def pseudonym(secret, kind, value):
    """A keyed HMAC-SHA-256 of the identifier: stable for one secret, not reversible or linkable without it."""
    digest = hmac.new(secret.encode('utf-8'), f'{kind}:{value}'.encode('utf-8'), hashlib.sha256).hexdigest()
    return f'{kind[0]}_{digest[:PSEUDONYM_LENGTH]}'


class Pseudonyms:
    def __init__(self, secret):
        self.secret = secret

    def participant(self, profile_id):
        return pseudonym(self.secret, 'participant', profile_id)

    def match(self, game_id):
        return pseudonym(self.secret, 'match', game_id)

    def quiz(self, attempt_id):
        return pseudonym(self.secret, 'quiz', attempt_id)


async def researcher(request: Request, profile: Annotated[Profile, Depends(current_profile)]) -> Profile:
    settings = request.app.state.settings
    if not is_researcher(settings, profile):
        raise HTTPException(403, NOT_RESEARCHER)
    if not study_open(settings):
        raise HTTPException(409, STUDY_DISABLED)
    return profile
