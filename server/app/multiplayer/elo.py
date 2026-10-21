"""Pairwise Elo for ranked matches (game-architecture.md, Decisions)."""

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.economy_models import EconomyEvent
from app.game.models import GameParticipant
from app.multiplayer.models import Rating
from app.player import ledger

START = 1000
K = 32
TIERS = ((1100, 'Bronze'), (1300, 'Silver'), (1500, 'Gold'), (1700, 'Platinum'))


def tier(rating):
    return next((name for limit, name in TIERS if rating < limit), 'Diamond')


def expected(rating, other):
    return 1 / (1 + 10 ** ((other - rating) / 400))


def deltas(ratings, ranks):
    """`ratings` and `ranks` map player -> value; a lower rank is better and an equal rank is a draw."""
    changes = {}
    for player, rating in ratings.items():
        total = 0.0
        for other, other_rating in ratings.items():
            if other != player:
                score = 1.0 if ranks[player] < ranks[other] else 0.5 if ranks[player] == ranks[other] else 0.0
                total += K * (score - expected(rating, other_rating))
        changes[player] = round(total)
    return changes


async def rating_row(db, user_id, lock=False):
    insert = {'sqlite': sqlite_insert, 'postgresql': postgresql_insert}[db.get_bind().dialect.name]
    await db.execute(insert(Rating).values(user_id=user_id, rating=START, matches=0, wins=0, updated_at=ledger.current())
                     .on_conflict_do_nothing(index_elements=[Rating.user_id]))
    query = select(Rating).where(Rating.user_id == user_id)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    return await db.scalar(query)


async def apply(db, game, result, instant):
    """Rate every human in a finished ranked match once; the per-player `elo:<game>` event is the idempotency key."""
    people = {p.id: p.user_id for p in await db.scalars(select(GameParticipant).where(GameParticipant.game_id == game.id,
                                                                                      GameParticipant.user_id.is_not(None)))}
    ranks = {people[entry['participant_id']]: entry['rank'] for entry in result['leaderboard'] if entry['participant_id'] in people}
    if len(ranks) < 2 or any([await db.get(EconomyEvent, (user_id, f'elo:{game.id}')) for user_id in ranks]):
        return
    rows = {user_id: await rating_row(db, user_id, lock=True) for user_id in sorted(ranks)}
    changes = deltas({user_id: row.rating for user_id, row in rows.items()}, ranks)
    best = min(ranks.values())
    unique_best = sum(rank == best for rank in ranks.values()) == 1
    for user_id, row in rows.items():
        before = row.rating
        row.rating += changes[user_id]
        row.matches += 1
        row.wins += int(unique_best and ranks[user_id] == best)
        db.add(EconomyEvent(user_id=user_id, event_key=f'elo:{game.id}', policy_version=ledger.POLICY_VERSION, stocks_delta=0,
                            premium_delta=0, xp_delta=0, context={'before': before, 'after': row.rating, 'rank': ranks[user_id]},
                            response={}, created_at=instant))
    await db.flush()
