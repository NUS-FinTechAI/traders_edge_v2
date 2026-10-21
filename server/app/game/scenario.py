"""Load and strictly validate authored scenarios and the bot catalog."""

from functools import cache
import json
from pathlib import Path
import re

CONTENT = Path(__file__).resolve().parents[1] / 'content'
SCENARIO_DIR = CONTENT / 'scenarios'
BOTS_PATH = CONTENT / 'bots.json'

ID = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
TICKER = re.compile(r'^[A-Z]{3,5}$')
AVATARS = ('bull', 'bear', 'owl', 'fox', 'eagle', 'whale', 'tortoise', 'hare', 'shark', 'parrot', 'octopus', 'lion')
TOOLS = ('candles', 'line', 'volume', 'sma', 'ema', 'rsi', 'macd', 'bollinger')
TONES = ('positive', 'negative', 'neutral')
NEWS_KINDS = ('earnings', 'macro', 'rumor', 'company', 'hype')
TIERS = ('rookie', 'pro', 'elite')
BALANCE = ('boss', 'daily', 'lesson')
ORDER_TYPES = ('market', 'limit', 'stop')
DIP_ENTRIES = ('red_candles', 'rsi')

SCENARIO_KEYS = {'id', 'version', 'title', 'briefing', 'objective', 'debrief', 'difficulty', 'ticks', 'history', 'tick_label',
                 'starting_cash', 'fee', 'spread', 'allow', 'max_position_pct', 'tools', 'market', 'regimes', 'assets', 'news',
                 'bots', 'missions'}
OPTIONAL_SCENARIO_KEYS = {'balance'}
ASSET_KEYS = {'symbol', 'name', 'sector', 'blurb', 'price', 'drift', 'beta', 'vol', 'base_volume'}
NEWS_KEYS = {'id', 'tick', 'headline', 'body', 'tone', 'symbols', 'effects'}
EFFECT_KEYS = {'symbol', 'move', 'ticks', 'gap'}
REGIME_KEYS = {'from', 'to', 'market_drift', 'vol_mult'}
MISSION_KEYS = {'id', 'type', 'params', 'text'}
BOT_KEYS = {'id', 'name', 'avatar', 'style', 'strategy', 'params'}

# Each parameter: (kind, required). Mission kinds are checked by `_param`, bot kinds by `_bot_param`.
MISSIONS = {
    'trades_min': {'n': ('count', True)},
    'trades_max': {'n': ('count0', True)},
    'use_order': {'type': ('order_type', True), 'n': ('count', True)},
    'hold_at_end': {'symbol': ('symbol', False)},
    'end_in_cash': {},
    'profit_min': {'amount': ('number', True)},
    'profit_pct_min': {'pct': ('number', True)},
    'rank_max': {'rank': ('count', True)},
    'beat_bot': {'bot_id': ('bot', True)},
    'max_drawdown': {'pct': ('pct', True)},
    'max_position': {'pct': ('pct', True)},
    'min_holdings': {'n': ('count', True)},
    'sold_after_news': {'news_id': ('news', True), 'within': ('count0', True)},
    'bought_after_news': {'news_id': ('news', True), 'within': ('count0', True)},
    'no_buy_between': {'from': ('tick', True), 'to': ('tick', True)},
    'beat_buy_hold': {'symbol': ('symbol', True)},
    'stop_loss_set': {},
    'kept_plan': {},
    'max_position_before': {'tick': ('tick', True), 'pct': ('pct', True), 'symbol': ('symbol', False)},
    'held_between': {'symbol': ('symbol', True), 'from': ('tick', True), 'to': ('tick', True)},
    'exited_by': {'symbol': ('symbol', True), 'tick': ('tick', True)},
}

COMMON_BOT_PARAMS = {'delay': ('delay', False), 'symbols': ('symbols', False)}
STRATEGIES = {
    'buy_hold': {'weight': ('weight', True), 'at': ('count0', True)},
    'momentum': {'sma': ('window', True), 'exit_sma': ('window', True), 'rising': ('bool', True),
                 'high_window': ('count0', True), 'weight': ('weight', True)},
    'mean_reversion': {'entry': ('dip_entry', True), 'red_candles': ('count', False), 'rsi_window': ('window', False),
                       'rsi_below': ('level', False), 'exit_sma': ('window', True), 'take_profit': ('fraction', True),
                       'trend_sma': ('count0', True), 'trail': ('fraction0', True), 'weight': ('weight', True)},
    'emotional': {'streak': ('count', True), 'drop': ('fraction', True), 'weight': ('weight', True)},
    'scalper': {'min_move': ('fraction0', True), 'weight': ('weight', True)},
    'breakout': {'window': ('window', True), 'volume_mult': ('number0', True), 'volume_window': ('window', True),
                 'buffer': ('fraction0', True), 'weight': ('weight', True)},
    'news_reactor': {'weight': ('weight', True), 'ignore': ('kinds', True), 'fade_gap': ('fraction0', True)},
    'risk_manager': {'trend_sma': ('window', True), 'risk': ('fraction', True), 'stop_window': ('window', True),
                     'take_half_r': ('positive', True), 'max_exposure': ('weight', True), 'momentum_filter': ('bool', True),
                     'avoid_hype': ('bool', True), 'climax_volume': ('number0', True)},
}


class ScenarioError(ValueError):
    pass


def _fail(where, message):
    raise ScenarioError(f'{where}: {message}')


def _number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _int(value):
    return isinstance(value, int) and not isinstance(value, bool)


def _text(where, value, limit):
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        _fail(where, f'must be non-empty text of at most {limit} characters')


def _range(where, value, low, high, integer=False):
    if not (_int(value) if integer else _number(value)) or not low <= value <= high:
        _fail(where, f'must be {"a whole number" if integer else "a number"} from {low} to {high}')


def _id(where, value):
    if not isinstance(value, str) or not ID.match(value) or len(value) > 120:
        _fail(where, 'must be lowercase words joined by hyphens')


def _keys(where, value, required, optional=frozenset()):
    if not isinstance(value, dict):
        _fail(where, 'must be an object')
    missing = sorted(required - value.keys())
    unknown = sorted(value.keys() - required - optional)
    if missing:
        _fail(where, f'is missing {", ".join(missing)}')
    if unknown:
        _fail(where, f'has unknown field {", ".join(unknown)}')


def _spec_keys(where, params, spec):
    _keys(where, params, {key for key, (_, required) in spec.items() if required}, set(spec))


def _list(where, value, low, high):
    if not isinstance(value, list) or not low <= len(value) <= high:
        _fail(where, f'must be a list of {low} to {high} items')


def _unique(where, values):
    seen = set()
    for value in values:
        if value in seen:
            _fail(where, f'repeats {value!r}')
        seen.add(value)


def validate_bots(data):
    _list('bots.json', data, 1, 100)
    for index, bot in enumerate(data):
        where = f'bots.json[{index}]'
        _keys(where, bot, BOT_KEYS, {'tier'})
        _id(where + '.id', bot['id'])
        _text(where + '.name', bot['name'], 40)
        _text(where + '.style', bot['style'], 80)
        if bot['avatar'] not in AVATARS:
            _fail(where + '.avatar', f'must be one of {", ".join(AVATARS)}')
        if 'tier' in bot and bot['tier'] not in TIERS:
            _fail(where + '.tier', f'must be one of {", ".join(TIERS)}')
        if bot['strategy'] not in STRATEGIES:
            _fail(where + '.strategy', f'must be one of {", ".join(STRATEGIES)}')
        spec = {**STRATEGIES[bot['strategy']], **COMMON_BOT_PARAMS}
        params = bot['params']
        _spec_keys(where + '.params', params, spec)
        for name, value in params.items():
            _bot_param(f'{where}.params.{name}', spec[name][0], value)
        if bot['strategy'] == 'mean_reversion':
            needed = {'red_candles'} if params['entry'] == 'red_candles' else {'rsi_window', 'rsi_below'}
            if not needed <= params.keys():
                _fail(where + '.params', f'{params["entry"]} entry needs {", ".join(sorted(needed))}')
    _unique('bots.json ids', [bot['id'] for bot in data])
    return {bot['id']: bot for bot in data}


def _bot_param(where, kind, value):
    if kind == 'bool':
        if not isinstance(value, bool):
            _fail(where, 'must be true or false')
    elif kind in ('count', 'count0', 'window', 'delay'):
        low, high = {'count': (1, 1000), 'count0': (0, 1000), 'window': (2, 100), 'delay': (0, 5)}[kind]
        _range(where, value, low, high, integer=True)
    elif kind == 'level':
        _range(where, value, 1, 99)
    elif kind == 'number0':
        _range(where, value, 0, 100)
    elif kind == 'weight':
        if not _number(value) or not 0 < value <= 1:
            _fail(where, 'must be a number above 0 and at most 1')
    elif kind == 'fraction':
        if not _number(value) or not 0 < value < 1:
            _fail(where, 'must be a number between 0 and 1')
    elif kind == 'fraction0':
        if not _number(value) or not 0 <= value < 1:
            _fail(where, 'must be a number from 0 up to 1')
    elif kind == 'positive':
        if not _number(value) or value <= 0:
            _fail(where, 'must be a positive number')
    elif kind == 'dip_entry':
        if value not in DIP_ENTRIES:
            _fail(where, f'must be one of {", ".join(DIP_ENTRIES)}')
    elif kind == 'kinds':
        if not isinstance(value, list) or any(item not in NEWS_KINDS for item in value):
            _fail(where, f'must be a list of news kinds from {", ".join(NEWS_KINDS)}')
    elif kind == 'symbols':
        _list(where, value, 1, 5)
        if any(not isinstance(symbol, str) or not TICKER.match(symbol) for symbol in value):
            _fail(where, 'must contain tickers of 3-5 capital letters')


def validate_scenario(data, bots, where='scenario'):
    _keys(where, data, SCENARIO_KEYS, OPTIONAL_SCENARIO_KEYS)
    _id(where + '.id', data['id'])
    where = data['id']
    _range(where + '.version', data['version'], 1, 10**6, integer=True)
    _text(where + '.title', data['title'], 80)
    _text(where + '.briefing', data['briefing'], 600)
    _text(where + '.objective', data['objective'], 300)
    _text(where + '.debrief', data['debrief'], 1500)
    _text(where + '.tick_label', data['tick_label'], 12)
    _range(where + '.difficulty', data['difficulty'], 1, 5, integer=True)
    _range(where + '.ticks', data['ticks'], 15, 150, integer=True)
    _range(where + '.history', data['history'], 5, 120, integer=True)
    _range(where + '.starting_cash', data['starting_cash'], 100, 10**7)
    _range(where + '.spread', data['spread'], 0, 0.05)
    _keys(where + '.fee', data['fee'], {'rate', 'min'})
    _range(where + '.fee.rate', data['fee']['rate'], 0, 0.05)
    _range(where + '.fee.min', data['fee']['min'], 0, 100)
    _keys(where + '.allow', data['allow'], {'limit', 'stop'})
    if not all(isinstance(data['allow'][key], bool) for key in ('limit', 'stop')):
        _fail(where + '.allow', 'limit and stop must be true or false')
    if data['max_position_pct'] is not None:
        _range(where + '.max_position_pct', data['max_position_pct'], 1, 100)
    if data.get('balance') is not None and data['balance'] not in BALANCE:
        _fail(where + '.balance', 'must be "boss", "lesson" or null')
    _list(where + '.tools', data['tools'], 1, len(TOOLS))
    for tool in data['tools']:
        if tool not in TOOLS:
            _fail(where + '.tools', f'{tool!r} is not one of {", ".join(TOOLS)}')
    _unique(where + '.tools', data['tools'])
    _keys(where + '.market', data['market'], {'vol'})
    _range(where + '.market.vol', data['market']['vol'], 0, 0.1)
    _regimes(where, data)
    symbols = _assets(where, data)
    news = _news(where, data, symbols)
    _list(where + '.bots', data['bots'], 0, 7)
    for bot_id in data['bots']:
        if bot_id not in bots:
            _fail(where + '.bots', f'{bot_id!r} is not in bots.json')
        for symbol in bots[bot_id]['params'].get('symbols', ()):
            if symbol not in symbols:
                _fail(where + '.bots', f'{bot_id!r} trades {symbol}, which is not in this scenario')
    _unique(where + '.bots', data['bots'])
    if data.get('balance') == 'boss' and not data['bots']:
        _fail(where + '.bots', 'a boss scenario needs at least one bot')
    _missions(where, data, symbols, news)
    return data


def _regimes(where, data):
    regimes = data['regimes']
    _list(where + '.regimes', regimes, 1, 20)
    expected = 0
    for index, regime in enumerate(regimes):
        at = f'{where}.regimes[{index}]'
        _keys(at, regime, REGIME_KEYS)
        _range(at + '.market_drift', regime['market_drift'], -0.05, 0.05)
        _range(at + '.vol_mult', regime['vol_mult'], 0, 10)
        if not _int(regime['from']) or regime['from'] != expected or not _int(regime['to']) or regime['to'] <= regime['from']:
            _fail(at, f'must start at tick {expected} and end after it')
        expected = regime['to']
    if expected != data['ticks']:
        _fail(where + '.regimes', f'must cover ticks 0 to {data["ticks"]} without gaps')


def _assets(where, data):
    _list(where + '.assets', data['assets'], 1, 5)
    for index, asset in enumerate(data['assets']):
        at = f'{where}.assets[{index}]'
        _keys(at, asset, ASSET_KEYS)
        if not isinstance(asset['symbol'], str) or not TICKER.match(asset['symbol']):
            _fail(at + '.symbol', 'must be 3-5 capital letters')
        _text(at + '.name', asset['name'], 60)
        _text(at + '.sector', asset['sector'], 40)
        _text(at + '.blurb', asset['blurb'], 200)
        _range(at + '.price', asset['price'], 1, 10000)
        _range(at + '.drift', asset['drift'], -0.05, 0.05)
        _range(at + '.beta', asset['beta'], -3, 3)
        _range(at + '.vol', asset['vol'], 0.0001, 0.2)
        _range(at + '.base_volume', asset['base_volume'], 1, 10**9, integer=True)
    symbols = [asset['symbol'] for asset in data['assets']]
    _unique(where + '.assets symbols', symbols)
    return set(symbols)


def _news(where, data, symbols):
    _list(where + '.news', data['news'], 0, 60)
    for index, item in enumerate(data['news']):
        at = f'{where}.news[{index}]'
        _keys(at, item, NEWS_KEYS, {'kind'})
        _id(at + '.id', item['id'])
        _range(at + '.tick', item['tick'], 0, data['ticks'] - 1, integer=True)
        _text(at + '.headline', item['headline'], 140)
        _text(at + '.body', item['body'], 800)
        if item['tone'] not in TONES:
            _fail(at + '.tone', f'must be one of {", ".join(TONES)}')
        if item.get('kind', 'company') not in NEWS_KINDS:
            _fail(at + '.kind', f'must be one of {", ".join(NEWS_KINDS)}')
        _list(at + '.symbols', item['symbols'], 1, 5)
        for symbol in item['symbols']:
            if symbol not in symbols:
                _fail(at + '.symbols', f'{symbol!r} is not an asset in this scenario')
        _list(at + '.effects', item['effects'], 0, 5)
        for number, effect in enumerate(item['effects']):
            spot = f'{at}.effects[{number}]'
            _keys(spot, effect, EFFECT_KEYS)
            if effect['symbol'] not in symbols:
                _fail(spot + '.symbol', f'{effect["symbol"]!r} is not an asset in this scenario')
            _range(spot + '.move', effect['move'], -0.9, 2)
            _range(spot + '.ticks', effect['ticks'], 1, data['ticks'] - item['tick'], integer=True)
            if not isinstance(effect['gap'], bool):
                _fail(spot + '.gap', 'must be true or false')
    _unique(where + '.news ids', [item['id'] for item in data['news']])
    return {item['id']: item for item in data['news']}


def _missions(where, data, symbols, news):
    missions = data['missions']
    _keys(where + '.missions', missions, {'basic', 'bonus'})
    _list(where + '.missions.basic', missions['basic'], 1, 5)
    _list(where + '.missions.bonus', missions['bonus'], 0, 5)
    for tier in ('basic', 'bonus'):
        for index, mission in enumerate(missions[tier]):
            at = f'{where}.missions.{tier}[{index}]'
            _keys(at, mission, MISSION_KEYS)
            _id(at + '.id', mission['id'])
            _text(at + '.text', mission['text'], 120)
            if mission['type'] not in MISSIONS:
                _fail(at + '.type', f'{mission["type"]!r} is not a known mission type')
            params = mission['params']
            _spec_keys(at + '.params', params, MISSIONS[mission['type']])
            for name, value in params.items():
                _param(f'{at}.params.{name}', MISSIONS[mission['type']][name][0], value, data, symbols, news)
            _mission_rules(at, mission['type'], params, data, symbols)
    _unique(where + '.missions ids', [m['id'] for tier in ('basic', 'bonus') for m in missions[tier]])


def _mission_rules(at, kind, params, data, symbols):
    if kind in ('no_buy_between', 'held_between') and params['from'] > params['to']:
        _fail(at + '.params', 'from must not be after to')
    if kind == 'use_order' and params['type'] != 'market' and not data['allow'][params['type']]:
        _fail(at + '.params.type', f'{params["type"]} orders are disabled in this scenario')
    if kind == 'stop_loss_set' and not data['allow']['stop']:
        _fail(at, 'stop orders are disabled in this scenario')
    if kind == 'min_holdings' and params['n'] > len(symbols):
        _fail(at + '.params.n', 'is more than the number of assets')
    if kind == 'rank_max' and params['rank'] > len(data['bots']) + 1:
        _fail(at + '.params.rank', 'is more than the number of participants')


def _param(where, kind, value, data, symbols, news):
    if kind == 'count':
        _range(where, value, 1, 1000, integer=True)
    elif kind == 'count0':
        _range(where, value, 0, 1000, integer=True)
    elif kind == 'number':
        _range(where, value, -10**7, 10**7)
    elif kind == 'pct':
        if not _number(value) or not 0 < value <= 100:
            _fail(where, 'must be a percentage above 0 and at most 100')
    elif kind == 'tick':
        _range(where, value, 0, data['ticks'] - 1, integer=True)
    elif kind == 'order_type':
        if value not in ORDER_TYPES:
            _fail(where, f'must be one of {", ".join(ORDER_TYPES)}')
    elif kind == 'symbol':
        if value not in symbols:
            _fail(where, f'{value!r} is not an asset in this scenario')
    elif kind == 'news':
        if value not in news:
            _fail(where, f'{value!r} is not a news id in this scenario')
    elif kind == 'bot':
        if value not in data['bots']:
            _fail(where, f'{value!r} is not one of this scenario\'s bots')


def _read(path):
    try:
        with path.open(encoding='utf-8') as handle:
            return json.load(handle)
    except json.JSONDecodeError as error:
        raise ScenarioError(f'{path.name}: invalid JSON ({error})') from None


@cache
def load_bots():
    return validate_bots(_read(BOTS_PATH))


@cache
def load_scenarios():
    bots = load_bots()
    scenarios = {}
    for path in sorted(SCENARIO_DIR.glob('*.json')):
        data = validate_scenario(_read(path), bots, path.name)
        if data['id'] != path.stem:
            _fail(path.name, f'id {data["id"]!r} must match the file name')
        scenarios[data['id']] = data
    return scenarios


def get_scenario(scenario_id):
    return load_scenarios()[scenario_id]
