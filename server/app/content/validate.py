"""Validate every authored content file and the references between them: `python -m app.content.validate`."""

import sys

from app.campaign import daily
from app.content.bundle import load_content
from app.content.checks import ContentError, fail
from app.game.scenario import ScenarioError, load_bots, load_scenarios
from app.quiz.bank import check_chapters
from app.quiz.service import SIZES

CHAPTER_QUIZ_MINIMUM = SIZES['chapter']


def cross_references(content, scenarios):
    chapters = content.campaign.chapters
    check_chapters(content.quiz, len(chapters), CHAPTER_QUIZ_MINIMUM)
    for scenario_id in daily.ROTATION:
        if scenario_id not in scenarios:
            fail('daily rotation', f'{scenario_id!r} is not a scenario')
        if not scenarios[scenario_id]['bots']:
            fail(scenario_id, 'a daily scenario needs one opponent')
    if not any(key.startswith('practice-') for key in scenarios):
        fail('scenarios', 'the practice pool needs at least one practice-* scenario')
    for chapter in chapters:
        if content.cosmetics.boss_title(chapter['number']) is None:
            fail('cosmetics.json.titles', f'needs a boss special-star title for chapter {chapter["number"]}')
    prompts = {question['prompt'] for chapter in chapters for level in chapter['levels'] for question in level['check']}
    reused = sorted(item['id'] for item in content.quiz.questions.values() if item['prompt'] in prompts)
    if reused:
        fail('quiz_bank.json', f'reuses lesson check questions: {", ".join(reused)}')


def main():
    try:
        load_bots()
        scenarios = load_scenarios()
        content = load_content()
        cross_references(content, scenarios)
    except (ContentError, ScenarioError) as error:
        print(f'Content is invalid: {error}', file=sys.stderr)
        return 1
    print(f'Content is valid: {len(scenarios)} scenarios, {len(content.campaign.chapters)} chapters, '
          f'{len(content.quiz.questions)} quiz questions, {len(content.cosmetics.items)} cosmetics.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
