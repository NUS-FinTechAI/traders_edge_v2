import json


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
