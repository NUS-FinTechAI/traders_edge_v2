import json
import random
import secrets


BINDING = {
    'id': 'm05-l01-limit-audit-v1',
    'engine_version': 1,
    'provenance': 'Controlled synthetic educational case; not historical market data or an investment recommendation.',
    'kind': 'sideways',
    'ticks': 30,
    'symbol': 'NORTH',
    'side': 'buy',
    'order_type': 'limit',
    'max_orders': 2,
    'max_quantity': 5,
    'max_advance': 2,
    'min_observe': 10,
    'max_tick': 29,
    'unit_price_cap_basis': 'opening_ask',
    'unit_price_cap_excludes_fees': True,
    'investment_thesis_supplied': False,
}


def valid_binding(value):
    return isinstance(value, dict) and json.dumps(value, sort_keys=True) == json.dumps(BINDING, sort_keys=True)


def public_binding(binding):
    return {key: value for key, value in binding.items() if key not in {'kind', 'ticks'}}


SCENARIO_SET_BINDING = {
    'id': 'm09-l03-four-path-review-v1',
    'engine_version': 1,
    'provenance': 'Four controlled synthetic generator profiles; not historical data or investment recommendations.',
    'ticks': 20,
    'max_advance': 5,
    'max_order_quantity': 5,
    'max_orders': 8,
    'max_asset_units': 10,
    'max_planned_loss': '100.00',
    'case_ids': ['path-1', 'path-2', 'path-3', 'path-4'],
    'investment_thesis_supplied': False,
}


def valid_scenario_set_binding(value):
    return isinstance(value, dict) and json.dumps(value, sort_keys=True) == json.dumps(SCENARIO_SET_BINDING, sort_keys=True)


def scenario_forms():
    rng = random.Random(secrets.randbits(63))
    kinds = rng.sample(['rising', 'falling', 'sideways', 'volatile'], 4)
    return [{'id': identifier, 'kind': kind, 'seed': rng.getrandbits(63)}
            for identifier, kind in zip(SCENARIO_SET_BINDING['case_ids'], kinds, strict=True)]


def valid_scenario_forms(forms):
    return (isinstance(forms, list) and len(forms) == 4
            and all(isinstance(form, dict) and set(form) == {'id', 'kind', 'seed'}
                    and form['id'] == identifier and isinstance(form['kind'], str)
                    and type(form['seed']) is int and 0 <= form['seed'] < 2 ** 63
                    for identifier, form in zip(SCENARIO_SET_BINDING['case_ids'], forms, strict=True))
            and {form['kind'] for form in forms} == {'rising', 'falling', 'sideways', 'volatile'})
