"""Private lobbies and the ranked queue. Matches run on app.game; lobbies only gather players."""

from datetime import timedelta
import secrets

from fastapi import HTTPException
from sqlalchemy import delete, func, select, text

from app.campaign.progress import load_progress
from app.codes import new_code, normalise
from app.db import Profile
from app.game.models import GameParticipant
from app.game.scenario import load_bots, load_scenarios
from app.game.service import create_multiplayer_game
from app.multiplayer import elo
from app.multiplayer.models import Lobby, LobbyMember, QueueEntry, Rating
from app.player import ledger
from app.player.service import DEFAULT_AVATAR

MIN_PLAYERS = 2
MAX_MEMBERS = 30
MAX_LOBBY_BOTS = 3
LOBBY_ROSTER = ('momentum-max-pro', 'value-vera-pro', 'hodl-hannah')
RANKED_LOCKED = 'Win the Chapter 3 boss to unlock ranked matches'
SEARCH_EXPIRES = timedelta(minutes=2)
PAIRING_LOCK = 724_190_331


def lobby_bots(scenario_id, count):
    """The scenario's own bots first, then the default lobby roster, up to `count` distinct opponents."""
    known = load_bots()
    chosen = []
    for bot_id in (*load_scenarios()[scenario_id]['bots'], *LOBBY_ROSTER):
        if bot_id in known and bot_id not in chosen and len(chosen) < count:
            chosen.append(bot_id)
    return chosen


def ranked_pool():
    return sorted(key for key in load_scenarios() if key.startswith('mp-'))


def lobby_pool():
    return sorted(key for key in load_scenarios() if key.startswith(('mp-', 'practice-')))


def scenario_list():
    scenarios = load_scenarios()
    return {'scenarios': [{key: scenarios[item][key] for key in ('id', 'title', 'briefing', 'ticks')} for item in lobby_pool()]}


async def _lobby_view(db, lobby, profile):
    scenario = load_scenarios()[lobby.scenario_id]
    rows = (await db.execute(select(Profile).join(LobbyMember, LobbyMember.user_id == Profile.id).where(LobbyMember.lobby_id == lobby.id)
                             .order_by(LobbyMember.user_id != lobby.host_user_id, LobbyMember.joined_at, Profile.id))).scalars()
    return {'id': lobby.id, 'code': lobby.code, 'host_id': lobby.host_user_id, 'is_host': lobby.host_user_id == profile.id,
            'status': lobby.status, 'scenario': {key: scenario[key] for key in ('id', 'title', 'ticks')},
            'members': [{'user_id': person.id, 'name': person.display_name, 'avatar_id': person.equipped_avatar_id or DEFAULT_AVATAR,
                         'is_host': person.id == lobby.host_user_id} for person in rows],
            'bots': lobby.bots, 'game_id': lobby.game_id, 'max_members': MAX_MEMBERS}


async def create_lobby(db, profile, body):
    pool = lobby_pool()
    if not pool:
        raise HTTPException(503, 'No multiplayer markets are available yet')
    scenario_id = body.scenario_id or secrets.choice(ranked_pool() or pool)
    if scenario_id not in pool:
        raise HTTPException(404, 'That market is not available for lobbies')
    bots = len(lobby_bots(scenario_id, min(body.bots, MAX_LOBBY_BOTS)))
    lobby = Lobby(code=await new_code(db, Lobby), host_user_id=profile.id, scenario_id=scenario_id, bots=bots, status='open',
                  created_at=ledger.current())
    db.add(lobby)
    await db.flush()
    db.add(LobbyMember(lobby_id=lobby.id, user_id=profile.id, joined_at=ledger.current()))
    await db.flush()
    return await _lobby_view(db, lobby, profile)


async def _members(db, lobby_id):
    return await db.scalar(select(func.count()).select_from(LobbyMember).where(LobbyMember.lobby_id == lobby_id))


async def join_lobby(db, profile, code):
    lobby = await db.scalar(select(Lobby).where(Lobby.code == normalise(code)).with_for_update())
    if lobby is None:
        raise HTTPException(404, 'No lobby has that code')
    if await db.get(LobbyMember, (lobby.id, profile.id)) is None:
        if lobby.status != 'open':
            raise HTTPException(409, 'This lobby is no longer accepting players')
        if await _members(db, lobby.id) >= MAX_MEMBERS:
            raise HTTPException(409, f'This lobby is full ({MAX_MEMBERS} players)')
        db.add(LobbyMember(lobby_id=lobby.id, user_id=profile.id, joined_at=ledger.current()))
        await db.flush()
    return await _lobby_view(db, lobby, profile)


async def member_lobby(db, profile, lobby_id, lock=False):
    query = select(Lobby).where(Lobby.id == lobby_id)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    lobby = await db.scalar(query)
    if lobby is None or await db.get(LobbyMember, (lobby.id, profile.id)) is None:
        raise HTTPException(404, 'Lobby not found')
    return lobby


async def get_lobby(db, profile, lobby_id):
    return await _lobby_view(db, await member_lobby(db, profile, lobby_id), profile)


async def start_lobby(db, profile, lobby_id):
    lobby = await member_lobby(db, profile, lobby_id, lock=True)
    if lobby.host_user_id != profile.id:
        raise HTTPException(403, 'Only the host can start the match')
    if lobby.status != 'open':
        raise HTTPException(409, 'This lobby has already started or closed')
    players = list((await db.execute(select(Profile).join(LobbyMember, LobbyMember.user_id == Profile.id)
                                     .where(LobbyMember.lobby_id == lobby.id).order_by(LobbyMember.joined_at, Profile.id))).scalars())
    if len(players) < MIN_PLAYERS:
        raise HTTPException(409, f'At least {MIN_PLAYERS} players are needed to start')
    players.sort(key=lambda person: person.id != lobby.host_user_id)
    bots = lobby_bots(lobby.scenario_id, lobby.bots)
    game = await create_multiplayer_game(db, lobby.scenario_id, 'private', players, bots, lobby.id)
    lobby.status, lobby.game_id = 'started', game.id
    await db.flush()
    return await _lobby_view(db, lobby, profile)


async def leave_lobby(db, profile, lobby_id):
    lobby = await member_lobby(db, profile, lobby_id, lock=True)
    await db.execute(delete(LobbyMember).where(LobbyMember.lobby_id == lobby.id, LobbyMember.user_id == profile.id))
    if lobby.status == 'open' and lobby.host_user_id == profile.id:
        lobby.status = 'closed'
    await db.flush()


async def ranked_locked_reason(db, content, profile):
    progress = await load_progress(db, content.campaign, profile.id)
    chapters = content.campaign.chapters
    return None if len(chapters) >= 3 and progress.won(chapters[2]['id'], 'boss') else RANKED_LOCKED


async def _match_view(db, entry, profile, locked_reason):
    rating = await db.get(Rating, profile.id)
    value = rating.rating if rating else elo.START
    return {'status': entry.status if entry else 'idle', 'game_id': entry.game_id if entry else None, 'rating': value,
            'tier': elo.tier(value), 'waiting_since': ledger.utc(entry.created_at).isoformat() if entry and entry.status == 'searching' else None,
            'locked_reason': locked_reason}


def expired(entry, instant):
    """A search older than SEARCH_EXPIRES is abandoned: it is never paired and reads as idle."""
    return entry.status == 'searching' and ledger.utc(entry.created_at) <= instant - SEARCH_EXPIRES


async def _entry(db, user_id):
    return await db.scalar(select(QueueEntry).where(QueueEntry.user_id == user_id).execution_options(populate_existing=True))


async def _current_entry(db, profile, clear=False):
    """The player's live queue entry: a finished match or an expired search reads as none (and is removed when `clear`)."""
    entry = await _entry(db, profile.id)
    if entry is None:
        return None
    gone = expired(entry, ledger.current())
    if entry.status == 'matched':
        gone = await db.scalar(select(GameParticipant.result.is_not(None)).where(GameParticipant.game_id == entry.game_id,
                                                                                 GameParticipant.user_id == profile.id))
    if gone:
        if clear:
            await db.delete(entry)
            await db.flush()
        return None
    return entry


async def _pairing_lock(db):
    """One pairing at a time across workers. SQLite already serialises writers with BEGIN IMMEDIATE."""
    if db.get_bind().dialect.name == 'postgresql':
        await db.execute(text('SELECT pg_advisory_xact_lock(:key)'), {'key': PAIRING_LOCK})


async def _pair(db, profile):
    """Pair the player's search with the oldest live rival under the global lock. Returns the refreshed entry."""
    await _pairing_lock(db)
    entry = await _current_entry(db, profile)
    if entry is None or entry.status != 'searching':
        return entry
    instant = ledger.current()
    rivals = await db.scalars(select(QueueEntry).where(QueueEntry.status == 'searching', QueueEntry.user_id != profile.id)
                              .order_by(QueueEntry.created_at, QueueEntry.user_id).execution_options(populate_existing=True))
    rival = next((item for item in rivals if not expired(item, instant)), None)
    if rival is None:
        return entry
    pool = ranked_pool() or sorted(key for key in load_scenarios() if key.startswith('practice-'))
    if not pool:
        raise HTTPException(503, 'No ranked markets are available yet')
    players = [await db.get(Profile, rival.user_id), profile]
    game = await create_multiplayer_game(db, secrets.choice(pool), 'ranked', players, [], None)
    for item in (rival, entry):
        item.status, item.game_id = 'matched', game.id
    await db.flush()
    return entry


async def get_match(db, content, profile):
    """Poll the queue; a live search also tries to pair here."""
    entry = await _current_entry(db, profile)
    if entry is not None and entry.status == 'searching':
        entry = await _pair(db, profile)
    return await _match_view(db, entry, profile, await ranked_locked_reason(db, content, profile))


async def join_queue(db, content, profile):
    reason = await ranked_locked_reason(db, content, profile)
    if reason:
        raise HTTPException(403, reason)
    if await _current_entry(db, profile, clear=True) is None:
        db.add(QueueEntry(user_id=profile.id, status='searching', created_at=ledger.current()))
        await db.flush()
    return await _match_view(db, await _pair(db, profile), profile, None)


async def leave_queue(db, profile):
    """Stop searching. A match that has started cannot be left from the queue."""
    await _pairing_lock(db)
    entry = await _current_entry(db, profile, clear=True)
    if entry is not None and entry.status == 'matched':
        raise HTTPException(409, 'Your match has started')
    await db.execute(delete(QueueEntry).where(QueueEntry.user_id == profile.id))
