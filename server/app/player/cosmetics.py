"""Cosmetic catalog: avatars, titles, candle themes and badges. Nothing here changes a simulation."""

from dataclasses import dataclass
from pathlib import Path

from app.content.checks import fail, identifier, items, keys, read, text, unique, whole

PATH = Path(__file__).resolve().parents[1] / 'content' / 'cosmetics.json'
SECTIONS = {'avatars': 'avatar', 'titles': 'title', 'themes': 'theme', 'badges': 'badge'}
SOURCES = {'avatars': ('starter', 'boss', 'map', 'shop'), 'titles': ('rank', 'boss_special', 'map', 'weekly', 'shop'),
           'themes': ('shop', 'free')}
PRICED = ('shop', 'weekly')
CHAPTERED = ('boss', 'map', 'boss_special')


@dataclass(frozen=True)
class Cosmetics:
    items: dict

    def of(self, kind):
        return [item for item in self.items.values() if item['kind'] == kind]

    def shop(self):
        return [item for item in self.items.values() if 'price' in item]

    def starters(self):
        return [item['id'] for item in self.of('avatar') if item['source'] == 'starter']

    def rank_titles(self):
        return sorted((item for item in self.of('title') if item['source'] == 'rank'), key=lambda item: item['level'])

    def boss_title(self, chapter_number):
        return next((item for item in self.of('title') if item['source'] == 'boss_special' and item['chapter'] == chapter_number), None)

    def reward(self, item_id):
        item = self.items[item_id]
        return {'id': item_id, 'kind': item['kind'], 'name': item['name'], 'image': item.get('image')}

    def image(self, item_id):
        item = self.items.get(item_id)
        return item.get('image') if item else None


def _price(where, price, source):
    keys(where, price, {'currency', 'amount'})
    if price['currency'] not in ('stocks', 'gems'):
        fail(where + '.currency', 'must be stocks or gems')
    whole(where + '.amount', price['amount'], 1, 100000)
    if source == 'weekly' and price['currency'] != 'stocks':
        fail(where + '.currency', 'weekly items are bought with Doubloons (stocks)')


def _item(where, section, item):
    if section == 'badges':
        keys(where, item, {'id', 'name', 'description'})
    else:
        detail = 'description' if section == 'themes' else 'how'
        optional = {'price', 'chapter', 'level', 'weekly', 'image'}
        keys(where, item, {'id', 'name', 'source', detail}, optional)
        text(where + '.' + detail, item[detail], 300)
        if item['source'] not in SOURCES[section]:
            fail(where + '.source', f'must be one of {", ".join(SOURCES[section])}')
        if ('price' in item) != (item['source'] in PRICED):
            fail(where + '.price', 'is required for shop and weekly items and only for them')
        if 'price' in item:
            _price(where + '.price', item['price'], item['source'])
        if ('chapter' in item) != (item['source'] in CHAPTERED):
            fail(where + '.chapter', 'is required for boss, map and boss special-star items and only for them')
        if 'chapter' in item:
            whole(where + '.chapter', item['chapter'], 1, 50)
        if ('level' in item) != (item['source'] == 'rank'):
            fail(where + '.level', 'is required for rank titles and only for them')
        if 'level' in item:
            whole(where + '.level', item['level'], 1, 50)
        if item.get('weekly', item['source'] == 'weekly') != (item['source'] == 'weekly'):
            fail(where + '.weekly', 'must be true exactly for weekly items')
        if 'image' in item:
            text(where + '.image', item['image'], 40)
    identifier(where + '.id', item['id'])
    if not item['id'].startswith(SECTIONS[section] + '-'):
        fail(where + '.id', f'must start with "{SECTIONS[section]}-"')
    text(where + '.name', item['name'], 60)
    if 'description' in item:
        text(where + '.description', item['description'], 300)


def validate_cosmetics(data):
    keys('cosmetics.json', data, {'version', *SECTIONS})
    whole('cosmetics.json.version', data['version'], 1, 10**6)
    catalog = {}
    for section, kind in SECTIONS.items():
        for index, item in enumerate(items(f'cosmetics.json.{section}', data[section], 1, 200)):
            _item(f'cosmetics.json.{section}[{index}]', section, item)
            catalog[item['id']] = {**item, 'kind': kind}
    unique('cosmetics.json ids', [item['id'] for section in SECTIONS for item in data[section]])
    cosmetics = Cosmetics(catalog)
    if len(cosmetics.starters()) != 4:
        fail('cosmetics.json.avatars', 'must hold exactly 4 starter avatars')
    ranks = cosmetics.rank_titles()
    if not ranks or ranks[0]['level'] != 1:
        fail('cosmetics.json.titles', 'needs a rank title for level 1')
    unique('cosmetics.json rank levels', [item['level'] for item in ranks])
    return cosmetics


def load_cosmetics(path=PATH):
    return validate_cosmetics(read(path))
