"""Portfolio scoring and joint ranking shared by trading competitions."""

from decimal import Decimal

from app.simulation import engine


def portfolio_result(state):
    """Value holdings at the current mid; cash already includes paid fees."""
    value = engine.equity(state)
    return {'profit': engine.money(value - engine.amount(state['initial_cash'])),
            'final_value': engine.money(value), 'fees': state['fees']}


def rank_entries(entries, *, identifier_key, forfeit_key=None):
    """Return ranked copies, optionally placing all forfeits below finishers.

    Equal profits within a group share a rank; identifiers only order presentation.
    """
    def score(entry):
        return (entry[forfeit_key] if forfeit_key else False, -Decimal(entry['profit']))

    ordered = sorted(entries, key=lambda entry: (*score(entry), entry[identifier_key]))
    return [{**entry, 'rank': 1 + sum(score(other) < score(entry) for other in ordered)}
            for entry in ordered]
