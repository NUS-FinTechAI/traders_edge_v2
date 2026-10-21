"""Player level curve and rank names (docs/reference/progression.md, XP and levels)."""

MAX_LEVEL = 50
RANKS = ((1, 'Deckhand'), (5, 'Able Seaman'), (10, 'Navigator'), (15, 'Quartermaster'), (20, 'First Mate'), (30, 'Captain'),
         (40, 'Commodore'), (50, 'Admiral'))


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
