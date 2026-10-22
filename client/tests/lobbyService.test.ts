import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as lobby from '../services/lobbyService.ts'
import { stubHttp } from './helpers/serviceHttp.ts'

for (const [name, load, path, response] of [
  [
    'lobby scenarios',
    lobby.getLobbyScenarios,
    '/api/lobbies/scenarios',
    { scenarios: [] },
  ],
  [
    'lobby',
    (signal?: AbortSignal) => lobby.getLobby('lobby/a ?#', signal),
    '/api/lobbies/lobby%2Fa%20%3F%23',
    { id: 'lobby/a ?#' },
  ],
  [
    'matchmaking',
    lobby.getMatchmaking,
    '/api/matchmaking',
    { status: 'waiting' },
  ],
] as const) {
  test(`loading ${name} uses its endpoint and forwards cancellation`, async (t) => {
    const requests = stubHttp(t, response)
    const controller = new AbortController()

    const result = await load(controller.signal)

    assert.deepEqual(result, response)
    assert.equal(requests[0].url.pathname, path)
    assert.equal(requests[0].method, 'GET')
    assert.equal(requests[0].signal, controller.signal)
  })
}

test('creating a lobby sends the selected scenario and bot count', async (t) => {
  const requests = stubHttp(t, { id: 'lobby' })
  const body = { scenario_id: 'market', bots: 0 }

  const result = await lobby.createLobby(body)

  assert.deepEqual(result, { id: 'lobby' })
  assert.equal(requests[0].url.pathname, '/api/lobbies')
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].body, body)
})

test('joining a lobby sends the supplied code', async (t) => {
  const requests = stubHttp(t, { id: 'lobby' })

  const result = await lobby.joinLobby('AB12CD')

  assert.deepEqual(result, { id: 'lobby' })
  assert.equal(requests[0].url.pathname, '/api/lobbies/join')
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].body, { code: 'AB12CD' })
})

test('starting a lobby posts to the encoded lobby start endpoint', async (t) => {
  const requests = stubHttp(t, { id: 'lobby', game_id: 'game' })

  const result = await lobby.startLobby('lobby/a')

  assert.deepEqual(result, { id: 'lobby', game_id: 'game' })
  assert.equal(requests[0].url.pathname, '/api/lobbies/lobby%2Fa/start')
  assert.equal(requests[0].method, 'POST')
})

test('leaving a lobby accepts an empty response', async (t) => {
  const requests = stubHttp(t, new Response(null, { status: 204 }))

  const result = await lobby.leaveLobby('lobby/a')

  assert.equal(result, undefined)
  assert.equal(requests[0].url.pathname, '/api/lobbies/lobby%2Fa/leave')
  assert.equal(requests[0].method, 'POST')
})

test('joining matchmaking posts once and returns the queue state', async (t) => {
  const requests = stubHttp(t, { status: 'waiting' })

  const result = await lobby.joinMatchmaking()

  assert.deepEqual(result, { status: 'waiting' })
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url.pathname, '/api/matchmaking')
  assert.equal(requests[0].method, 'POST')
})

test('leaving matchmaking sends DELETE and accepts an empty response', async (t) => {
  const requests = stubHttp(t, new Response(null, { status: 204 }))

  const result = await lobby.leaveMatchmaking()

  assert.equal(result, undefined)
  assert.equal(requests[0].url.pathname, '/api/matchmaking')
  assert.equal(requests[0].method, 'DELETE')
})

test('an invalid lobby code propagates the rejection without retrying', async (t) => {
  const requests = stubHttp(t, { detail: 'Lobby not found' }, 404)

  await assert.rejects(lobby.joinLobby('MISSING'), {
    status: 404,
    message: 'Lobby not found',
  })

  assert.equal(requests.length, 1)
})

test('an aborted queue poll does not reach the network', async (t) => {
  const requests = stubHttp(t)
  const controller = new AbortController()
  controller.abort()

  await assert.rejects(lobby.getMatchmaking(controller.signal), {
    kind: 'aborted',
  })

  assert.equal(requests.length, 0)
})

for (const [input, expected] of [
  [' ab-12 cD! ', 'AB12CD'],
  ['abcdefghi', 'ABCDEF'],
  ['', ''],
  ['!@ #', ''],
] as const) {
  test(`normalizing ${JSON.stringify(input)} produces ${JSON.stringify(expected)}`, () => {
    const result = lobby.normalizeCode(input)

    assert.equal(result, expected)
  })
}
