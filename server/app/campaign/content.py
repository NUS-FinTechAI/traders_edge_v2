"""Load and validate the per-chapter campaign files (`content/campaign/ch<N>.json`)."""

from dataclasses import dataclass
from pathlib import Path

from app.content.checks import fail, identifier, items, keys, question, read, text, unique, whole

DIRECTORY = Path(__file__).resolve().parents[1] / 'content' / 'campaign'
LEVELS_PER_CHAPTER = 5
CHAPTER_KEYS = {'id', 'number', 'title', 'region', 'tagline', 'icon', 'boss', 'gate', 'boss_reward', 'levels'}
LEVEL_KEYS = {'id', 'title', 'summary', 'objectives', 'terms', 'cards', 'check', 'practice'}
REWARD_KINDS = ('avatar', 'title')


@dataclass(frozen=True)
class Campaign:
    chapters: tuple
    levels: dict

    def chapter(self, chapter_id):
        return next((chapter for chapter in self.chapters if chapter['id'] == chapter_id), None)

    def chapter_of(self, level_id):
        return self.levels[level_id][0]

    def number_of(self, level_id):
        return self.levels[level_id][1]

    def level(self, level_id):
        chapter, number = self.levels[level_id]
        return chapter['levels'][number - 1]

    def previous(self, chapter):
        return self.chapters[chapter['number'] - 2] if chapter['number'] > 1 else None


def _reward(where, reward, cosmetics):
    keys(where, reward, {'kind', 'id'})
    if reward['kind'] not in REWARD_KINDS:
        fail(where + '.kind', 'must be avatar or title')
    item = cosmetics.items.get(reward['id'])
    if item is None:
        fail(where + '.id', f'{reward["id"]!r} is not in cosmetics.json')
    if item['kind'] != reward['kind']:
        fail(where + '.kind', f'{reward["id"]!r} is a {item["kind"]}, not a {reward["kind"]}')


def _scenario(where, scenario_id, scenarios):
    if scenario_id not in scenarios:
        fail(where, f'{scenario_id!r} is not a scenario')


def _level(where, level, scenarios, cosmetics):
    keys(where, level, LEVEL_KEYS, {'reward'})
    identifier(where + '.id', level['id'])
    text(where + '.title', level['title'], 80)
    text(where + '.summary', level['summary'], 300)
    for index, objective in enumerate(items(where + '.objectives', level['objectives'], 1, 6)):
        text(f'{where}.objectives[{index}]', objective, 200)
    for index, term in enumerate(items(where + '.terms', level['terms'], 0, 20)):
        keys(f'{where}.terms[{index}]', term, {'term', 'definition'})
        text(f'{where}.terms[{index}].term', term['term'], 60)
        text(f'{where}.terms[{index}].definition', term['definition'], 400)
    for index, card in enumerate(items(where + '.cards', level['cards'], 1, 8)):
        keys(f'{where}.cards[{index}]', card, {'title', 'body'}, {'visual'})
        text(f'{where}.cards[{index}].title', card['title'], 80)
        text(f'{where}.cards[{index}].body', card['body'], 1500)
        if card.get('visual') is not None:
            identifier(f'{where}.cards[{index}].visual', card['visual'])
    for index, item in enumerate(items(where + '.check', level['check'], 1, 8)):
        question(f'{where}.check[{index}]', item)
    unique(where + '.check ids', [item['id'] for item in level['check']])
    _scenario(where + '.practice', level['practice'], scenarios)
    if 'reward' in level:
        _reward(where + '.reward', level['reward'], cosmetics)


def validate_chapter(data, scenarios, cosmetics, where):
    keys(where, data, CHAPTER_KEYS)
    identifier(where + '.id', data['id'])
    whole(where + '.number', data['number'], 1, 50)
    for key, limit in (('title', 80), ('region', 80), ('tagline', 200), ('icon', 40)):
        text(f'{where}.{key}', data[key], limit)
    _scenario(where + '.boss', data['boss'], scenarios)
    if data['gate'] is not None:
        if data['number'] == 1:
            fail(where + '.gate', 'chapter 1 is always open, so it has no gate boss')
        _scenario(where + '.gate', data['gate'], scenarios)
    _reward(where + '.boss_reward', data['boss_reward'], cosmetics)
    levels = items(where + '.levels', data['levels'], LEVELS_PER_CHAPTER, LEVELS_PER_CHAPTER)
    for index, level in enumerate(levels):
        _level(f'{where}.levels[{index}]', level, scenarios, cosmetics)
    return data


def validate_campaign(chapters, where='campaign'):
    chapters = sorted(chapters, key=lambda chapter: chapter['number'])
    if not chapters:
        fail(where, 'needs at least one chapter')
    if [chapter['number'] for chapter in chapters] != list(range(1, len(chapters) + 1)):
        fail(where, 'chapter numbers must run 1, 2, 3, ... without gaps')
    node_ids = [chapter['id'] for chapter in chapters]
    for chapter in chapters:
        node_ids += [chapter['id'] + '-preview', chapter['id'] + '-boss']
        for level in chapter['levels']:
            node_ids += [level['id'], level['id'] + '-reward']
    unique(where + ' chapter, level and map node ids', node_ids)
    levels = {level['id']: (chapter, number) for chapter in chapters for number, level in enumerate(chapter['levels'], 1)}
    return Campaign(tuple(chapters), levels)


def load_campaign(scenarios, cosmetics, directory=DIRECTORY):
    """`scenarios` is the set of valid scenario ids; `cosmetics` the loaded catalog."""
    paths = sorted(Path(directory).glob('ch*.json'))
    return validate_campaign([validate_chapter(read(path), scenarios, cosmetics, path.name) for path in paths])
