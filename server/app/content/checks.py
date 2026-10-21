"""Small strict validators shared by the campaign, quiz bank and cosmetics loaders."""

import json
import re

ID = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')


class ContentError(ValueError):
    pass


def fail(where, message):
    raise ContentError(f'{where}: {message}')


def read(path):
    try:
        with path.open(encoding='utf-8') as handle:
            return json.load(handle)
    except json.JSONDecodeError as error:
        raise ContentError(f'{path.name}: invalid JSON ({error})') from None


def keys(where, value, required, optional=frozenset()):
    if not isinstance(value, dict):
        fail(where, 'must be an object')
    missing = sorted(required - value.keys())
    unknown = sorted(value.keys() - required - optional)
    if missing:
        fail(where, f'is missing {", ".join(missing)}')
    if unknown:
        fail(where, f'has unknown field {", ".join(unknown)}')


def text(where, value, limit):
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        fail(where, f'must be non-empty text of at most {limit} characters')


def identifier(where, value):
    if not isinstance(value, str) or not ID.match(value) or len(value) > 120:
        fail(where, 'must be lowercase words joined by hyphens')


def items(where, value, low, high):
    if not isinstance(value, list) or not low <= len(value) <= high:
        fail(where, f'must be a list of {low} to {high} items')
    return value


def whole(where, value, low, high):
    if not isinstance(value, int) or isinstance(value, bool) or not low <= value <= high:
        fail(where, f'must be a whole number from {low} to {high}')


def unique(where, values):
    seen = set()
    for value in values:
        if value in seen:
            fail(where, f'repeats {value!r}')
        seen.add(value)


def question(where, value, extra=frozenset()):
    """A multiple-choice or true/false item whose answer is one of its options."""
    keys(where, value, {'id', 'kind', 'prompt', 'options', 'answer', 'explanation'} | extra)
    identifier(where + '.id', value['id'])
    if value['kind'] not in ('mc', 'true_false'):
        fail(where + '.kind', 'must be mc or true_false')
    text(where + '.prompt', value['prompt'], 600)
    text(where + '.explanation', value['explanation'], 600)
    options = items(where + '.options', value['options'], 2, 2 if value['kind'] == 'true_false' else 6)
    for index, option in enumerate(options):
        keys(f'{where}.options[{index}]', option, {'id', 'text'})
        text(f'{where}.options[{index}].id', option['id'], 100)
        text(f'{where}.options[{index}].text', option['text'], 300)
    unique(where + '.options ids', [option['id'] for option in options])
    if value['answer'] not in {option['id'] for option in options}:
        fail(where + '.answer', 'must be one of the option ids')
