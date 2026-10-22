"""The versioned prior-knowledge instrument (`content/research/prior_knowledge.json`): four self-report items and a
ten-item concept pre-quiz, plus the documented grouping rule. Not a validated measure."""

from dataclasses import dataclass
from pathlib import Path

from app.content.checks import fail, items, keys, question, read, text, unique, whole

PATH = Path(__file__).resolve().parents[1] / 'content' / 'research' / 'prior_knowledge.json'
SELF_REPORT = {
    'experience': ('none', 'some', 'regular'),
    'brokerage_account': ('yes', 'no'),
    'market_frequency': ('never', 'monthly', 'weekly', 'daily'),
    'confidence': ('1', '2', '3', '4', '5'),
}
ITEM_COUNT = 10
CHAPTERS = (1, 2, 3, 4)
GROUPS = ('novice', 'intermediate', 'experienced')
UNKNOWN = 'unknown'
# Pre-quiz score bands (correct answers out of ITEM_COUNT); "Not sure" counts as not correct.
NOVICE_MAX = 4
INTERMEDIATE_MAX = 7


@dataclass(frozen=True)
class Instrument:
    version: str
    self_report: tuple
    items: tuple

    def item(self, item_id):
        return next((item for item in self.items if item['id'] == item_id), None)


def validate_instrument(data, where='prior_knowledge.json'):
    keys(where, data, {'version', 'self_report', 'items'})
    text(where + '.version', data['version'], 40)
    reports = items(where + '.self_report', data['self_report'], len(SELF_REPORT), len(SELF_REPORT))
    for index, report in enumerate(reports):
        place = f'{where}.self_report[{index}]'
        keys(place, report, {'id', 'prompt', 'options'})
        if report['id'] not in SELF_REPORT:
            fail(place + '.id', f'must be one of {", ".join(SELF_REPORT)}')
        text(place + '.prompt', report['prompt'], 300)
        for number, option in enumerate(items(place + '.options', report['options'], 2, 6)):
            keys(f'{place}.options[{number}]', option, {'id', 'text'})
            text(f'{place}.options[{number}].text', option['text'], 120)
        if tuple(option['id'] for option in report['options']) != SELF_REPORT[report['id']]:
            fail(place + '.options', f'ids must be {", ".join(SELF_REPORT[report["id"]])} in that order')
    unique(where + '.self_report ids', [report['id'] for report in reports])
    entries = items(where + '.items', data['items'], ITEM_COUNT, ITEM_COUNT)
    for index, item in enumerate(entries):
        place = f'{where}.items[{index}]'
        question(place, item, {'chapter', 'concepts'})
        whole(place + '.chapter', item['chapter'], CHAPTERS[0], CHAPTERS[-1])
        for number, concept in enumerate(items(place + '.concepts', item['concepts'], 1, 10)):
            text(f'{place}.concepts[{number}]', concept, 60)
    unique(where + '.items ids', [item['id'] for item in entries])
    missing = sorted(set(CHAPTERS) - {item['chapter'] for item in entries})
    if missing:
        fail(where + '.items', f'needs at least one item for chapters {missing}')
    return Instrument(data['version'], tuple(reports), tuple(entries))


def load_instrument(path=PATH):
    return validate_instrument(read(Path(path)))


def check_distinct(instrument, campaign, quiz):
    """The pre-quiz must not repeat a lesson check or quiz bank question, so it cannot be practised in the game."""
    checks = {question['prompt'] for chapter in campaign.chapters for level in chapter['levels'] for question in level['check']}
    bank = {item['prompt'] for item in quiz.questions.values()}
    for item in instrument.items:
        if item['id'] in quiz.questions:
            fail('prior_knowledge.json', f'{item["id"]} reuses a quiz bank id')
        if item['prompt'] in checks or item['prompt'] in bank:
            fail('prior_knowledge.json', f'{item["id"]} repeats a lesson check or quiz bank question')
        if item['chapter'] > len(campaign.chapters):
            fail('prior_knowledge.json', f'{item["id"]} names chapter {item["chapter"]}, which does not exist')


def score(instrument, answers):
    """Correct answers; `answers` maps item id to the chosen option id or None ("Not sure")."""
    return sum(answers.get(item['id']) == item['answer'] for item in instrument.items)


def group_for(correct):
    """Novice 0–4, intermediate 5–7, experienced 8–10 correct; no score (skipped) is unknown. Unvalidated cut-offs."""
    if correct is None:
        return UNKNOWN
    if correct <= NOVICE_MAX:
        return 'novice'
    if correct <= INTERMEDIATE_MAX:
        return 'intermediate'
    return 'experienced'
