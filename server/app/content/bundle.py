"""All authored content the progression backend serves, loaded and validated together."""

from dataclasses import dataclass
from pathlib import Path

from fastapi import HTTPException, Request

from app.campaign.content import DIRECTORY, Campaign, load_campaign
from app.content.checks import fail, keys, read, text
from app.game.scenario import load_scenarios
from app.player.cosmetics import Cosmetics, load_cosmetics
from app.quiz.bank import QuizBank, load_bank
from app.study.instrument import Instrument, load_instrument

REVIEW_PATH = Path(__file__).resolve().parent / 'review.json'
REVIEW_STATUSES = ('authored_requires_independent_review', 'approved')
AWAITING_REVIEW = 'Game content is awaiting independent review'


@dataclass(frozen=True)
class Content:
    campaign: Campaign
    quiz: QuizBank
    cosmetics: Cosmetics
    review_status: str = REVIEW_STATUSES[0]
    instrument: Instrument | None = None


def load_review(path=REVIEW_PATH):
    """The independent content review state (`content/review.json`)."""
    if not Path(path).exists():
        fail('review.json', 'is missing; it records whether the content passed independent review')
    data = read(Path(path))
    keys('review.json', data, {'status', 'notes'})
    if data['status'] not in REVIEW_STATUSES:
        fail('review.json.status', f'must be one of {", ".join(REVIEW_STATUSES)}')
    text('review.json.notes', data['notes'], 2000)
    return data['status']


def load_content(campaign_dir=DIRECTORY, review_path=REVIEW_PATH):
    cosmetics = load_cosmetics()
    return Content(load_campaign(set(load_scenarios()), cosmetics, campaign_dir), load_bank(), cosmetics, load_review(review_path),
                   load_instrument())


def require_approved_content(request: Request):
    """Production serves gameplay only after independent content review; development is unaffected."""
    if request.app.state.settings.environment == 'production' and request.app.state.content.review_status != 'approved':
        raise HTTPException(503, AWAITING_REVIEW)
