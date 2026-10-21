"""All authored content the progression backend serves, loaded and validated together."""

from dataclasses import dataclass

from app.campaign.content import DIRECTORY, Campaign, load_campaign
from app.game.scenario import load_scenarios
from app.player.cosmetics import Cosmetics, load_cosmetics
from app.quiz.bank import QuizBank, load_bank


@dataclass(frozen=True)
class Content:
    campaign: Campaign
    quiz: QuizBank
    cosmetics: Cosmetics


def load_content(campaign_dir=DIRECTORY):
    cosmetics = load_cosmetics()
    return Content(load_campaign(set(load_scenarios()), cosmetics, campaign_dir), load_bank(), cosmetics)
