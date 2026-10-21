"""Player level curve and rank names (game-architecture.md, Progression)."""

MAX_LEVEL = 50
RANKS = ((1, 'Rookie Trader'), (5, 'Market Explorer'), (10, 'Chart Reader'), (15, 'Risk Manager'), (20, 'Strategist'),
         (30, 'Seasoned Trader'), (40, 'Market Veteran'), (50, 'Captain of the Ledger'))


def xp_to_next(level):
    return 100 + 25 * (level - 1)


def level_for(xp):
    """Return (level, xp into the level, xp needed for the next level); the last value is 0 at the cap."""
    level, floor = 1, 0
    while level < MAX_LEVEL and xp >= floor + xp_to_next(level):
        floor += xp_to_next(level)
        level += 1
    return level, xp - floor, 0 if level == MAX_LEVEL else xp_to_next(level)


def rank_name(level):
    return next(name for start, name in reversed(RANKS) if level >= start)
