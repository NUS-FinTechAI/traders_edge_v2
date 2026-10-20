import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiClient } from '../api/apiClient.ts'
import { HttpService } from '../services/httpService.ts'
import type { UserProfile } from '../services/authService.ts'
import {
  MultiplayerService,
  parseMultiplayer,
  multiplayerTimestamp,
  loadMultiplayerHub,
} from '../services/multiplayerService.ts'
import { multiplayer, plannedOrder } from './fixtures/multiplayerFixtures.ts'

function setup() {
  return new MultiplayerService(
    new ApiClient(new HttpService({ baseUrl: 'http://localhost:8000' })),
  )
}

const profile: UserProfile = {
  id: 'owner',
  display_name: 'Player',
  leaderboard_opt_in: false,
  analytics_opt_in: false,
  xp: 0,
  completed_lesson_ids: [],
  mastered_module_ids: [],
  activity_days: [],
  activity_timezone: 'UTC',
  due_review_count: 0,
  learning_only: true,
  learning_xp: 0,
  game_xp: 0,
  player_level: 1,
  player_level_policy: '100-xp-per-level-1',
  xp_basis: 'learning and game events',
}

test('saved UTC match timestamps retain their instant with or without an explicit offset', () => {
  assert.equal(
    multiplayerTimestamp('2026-10-19T10:50:23').toISOString(),
    '2026-10-19T10:50:23.000Z',
  )
  assert.equal(
    multiplayerTimestamp('2026-10-19T18:50:23+08:00').toISOString(),
    '2026-10-19T10:50:23.000Z',
  )
})

test('a failed public-rating read does not hide successful mode access or saved matches', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url: unknown) => {
    if (String(url).endsWith('/leaderboard'))
      return Response.json(
        { detail: 'Temporarily unavailable' },
        { status: 503 },
      )
    if (String(url).endsWith('/matches')) return Response.json({ matches: [] })
    if (String(url).endsWith('/profile')) return Response.json(profile)
    return Response.json({ chapters: [] })
  })
  const result = await loadMultiplayerHub(
    'owner',
    undefined,
    new ApiClient(new HttpService({ baseUrl: 'http://localhost:8000' })),
  )
  assert.deepEqual(result.catalog.chapters, [])
  assert.deepEqual(result.matches, [])
  assert.equal(result.ranks, null)
})

test('refreshing multiplayer access reads newly mastered chapters from the current profile', async (t) => {
  let mastered: string[] = []
  t.mock.method(globalThis, 'fetch', async (url: unknown) => {
    if (String(url).endsWith('/profile'))
      return Response.json({ ...profile, mastered_module_ids: mastered })
    if (String(url).endsWith('/matches')) return Response.json({ matches: [] })
    if (String(url).endsWith('/leaderboard'))
      return Response.json({ players: [], your_rating: 1000, your_matches: 0 })
    return Response.json({ chapters: [] })
  })
  const client = new ApiClient(
    new HttpService({ baseUrl: 'http://localhost:8000' }),
  )
  const before = await loadMultiplayerHub('owner', undefined, client)
  mastered = ['m01', 'm02', 'm03', 'm04']

  const after = await loadMultiplayerHub('owner', undefined, client)

  assert.deepEqual(before.profile.mastered_module_ids, [])
  assert.deepEqual(after.profile.mastered_module_ids, mastered)
})

test('a multiplayer access refresh rejects a different signed-in profile', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url: unknown) => {
    if (String(url).endsWith('/profile'))
      return Response.json({ ...profile, id: 'another-owner' })
    if (String(url).endsWith('/matches')) return Response.json({ matches: [] })
    if (String(url).endsWith('/leaderboard'))
      return Response.json({ players: [], your_rating: 1000, your_matches: 0 })
    return Response.json({ chapters: [] })
  })

  await assert.rejects(
    loadMultiplayerHub(
      'owner',
      undefined,
      new ApiClient(new HttpService({ baseUrl: 'http://localhost:8000' })),
    ),
    { kind: 'invalid-response' },
  )
})

test('private creation and joining use their dedicated typed endpoints and preserve the host code', async (t) => {
  const calls: { url: string; body: unknown }[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) })
      return Response.json({
        ...multiplayer(null),
        join_code: 'AABBCCDDEEFF0011',
      })
    },
  )
  const service = setup()
  const created = await service.execute(
    { kind: 'create', key: 'create-match-key' },
    'owner',
  )
  await service.execute(
    { kind: 'join', key: 'join-match-key', code: 'AABBCCDDEEFF0011' },
    'owner',
  )
  assert.equal(created.join_code, 'AABBCCDDEEFF0011')
  assert.match(calls[0].url, /\/multiplayer\/lobbies$/)
  assert.deepEqual(calls[1].body, {
    idempotency_key: 'join-match-key',
    code: 'AABBCCDDEEFF0011',
  })
})

test('planned orders and readiness send the exact last observed tick', async (t) => {
  const calls: { url: string; body: unknown }[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) })
      return Response.json(multiplayer(4))
    },
  )
  const service = setup()
  await service.execute(
    {
      kind: 'order',
      lobbyId: 'match-one',
      expectedTick: 4,
      order: plannedOrder,
      key: 'planned-order-key',
    },
    'owner',
  )
  await service.execute(
    {
      kind: 'ready',
      lobbyId: 'match-one',
      expectedTick: 4,
      key: 'ready-match-key',
    },
    'owner',
  )
  assert.deepEqual(calls[0].body, {
    idempotency_key: 'planned-order-key',
    expected_tick: 4,
    order: plannedOrder,
  })
  assert.deepEqual(calls[1].body, {
    idempotency_key: 'ready-match-key',
    expected_tick: 4,
  })
})

test('a mutation response for another match is rejected', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ ...multiplayer(), id: 'other-match' }),
  )
  await assert.rejects(
    setup().execute(
      {
        kind: 'ready',
        lobbyId: 'match-one',
        expectedTick: 0,
        key: 'wrong-match-key',
      },
      'owner',
    ),
    { kind: 'invalid-response' },
  )
})

test('a match without the authenticated participant is rejected', () => {
  assert.throws(() => parseMultiplayer(multiplayer(), 'stranger'), {
    kind: 'invalid-response',
  })
})

test('future observations in an otherwise valid match are rejected', () => {
  const match = multiplayer(2)
  match.player!.history.NORTH.push('40.50')
  assert.throws(() => parseMultiplayer(match, 'owner'), {
    kind: 'invalid-response',
  })
})

test('public matchmaking rejects a private lobby response', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json(multiplayer(null)),
  )
  await assert.rejects(
    setup().execute({ kind: 'queue', key: 'public-queue-key' }, 'owner'),
    { kind: 'invalid-response' },
  )
})

test('final results cannot introduce an unknown participant', () => {
  const match = multiplayer(29)
  match.status = 'finished'
  match.result = {
    final_tick: 29,
    policy_version: match.version,
    leaderboard: [
      {
        user_id: 'unknown',
        display_name: 'Unknown player',
        profit: '0.00',
        final_value: '10000.00',
        fees: '0.00',
        rank: 1,
        forfeit: false,
        win: true,
      },
    ],
  }
  assert.throws(() => parseMultiplayer(match, 'owner'), {
    kind: 'invalid-response',
  })
})
