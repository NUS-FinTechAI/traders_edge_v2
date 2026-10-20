"""Server-owned match time. Every change re-anchors so the current tick never jumps backwards."""

import time

SOLO_TICK_MS = 2000
MULTIPLAYER_TICK_MS = 3000
SPEEDS = (1, 2, 4)


def now_ms():
    return int(time.time() * 1000)


def briefing(at):
    return {'anchor_tick': 0, 'anchor_at': at, 'tick_ms': SOLO_TICK_MS, 'paused': True, 'speed': 1}


def start(at, tick_ms=SOLO_TICK_MS):
    return {'anchor_tick': 0, 'anchor_at': at, 'tick_ms': tick_ms, 'paused': False, 'speed': 1}


def current_tick(clock, ticks, at):
    if clock['paused']:
        return min(ticks, clock['anchor_tick'])
    return min(ticks, clock['anchor_tick'] + max(0, at - clock['anchor_at']) // clock['tick_ms'])


def next_tick_at(clock, ticks, at):
    tick = current_tick(clock, ticks, at)
    if clock['paused'] or tick >= ticks:
        return None
    return clock['anchor_at'] + (tick + 1 - clock['anchor_tick']) * clock['tick_ms']


def _anchor(clock, tick, at, **changes):
    return {**clock, 'anchor_tick': tick, 'anchor_at': at, **changes}


def pause(clock, ticks, at):
    return _anchor(clock, current_tick(clock, ticks, at), at, paused=True)


def resume(clock, ticks, at):
    return _anchor(clock, current_tick(clock, ticks, at), at, paused=False)


def step(clock, ticks, at):
    """Advance exactly one tick; the clock stays paused."""
    if not clock['paused']:
        raise ValueError('Pause the match before moving to the next day')
    return _anchor(clock, min(ticks, clock['anchor_tick'] + 1), at)


def set_speed(clock, ticks, speed, at):
    if speed not in SPEEDS:
        raise ValueError('Speed must be 1, 2 or 4')
    return _anchor(clock, current_tick(clock, ticks, at), at, speed=speed, tick_ms=SOLO_TICK_MS // speed)
