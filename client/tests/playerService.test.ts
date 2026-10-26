import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as player from '../services/playerService.ts'
import { stubHttp } from './helpers/serviceHttp.ts'

for (const [name, load, path, response] of [
  ['profile', player.getMe, '/api/me', { display_name: 'Player' }],
  ['level rewards', player.getLevelRewards, '/api/me/level-rewards', []],
  ['activity', player.getActivity, '/api/me/activity', { days: [] }],
  ['collection', player.getCollection, '/api/me/collection', { items: [] }],
  ['shop', player.getShop, '/api/shop', { items: [] }],
  [
    'XP leaderboard',
    (signal?: AbortSignal) => player.getLeaderboard('xp', signal),
    '/api/leaderboards/xp',
    { entries: [] },
  ],
  [
    'ranked leaderboard',
    (signal?: AbortSignal) => player.getLeaderboard('ranked', signal),
    '/api/leaderboards/ranked',
    { entries: [] },
  ],
] as const) {
  test(`loading ${name} returns server data and forwards cancellation`, async (t) => {
    const requests = stubHttp(t, response)
    const controller = new AbortController()

    const result = await load(controller.signal)

    assert.deepEqual(result, response)
    assert.equal(requests[0].url.pathname, path)
    assert.equal(requests[0].method, 'GET')
    assert.equal(requests[0].signal, controller.signal)
  })
}

for (const level of [undefined, 2]) {
  test(`claiming level rewards sends the selected level ${level ?? 'all'}`, async (t) => {
    const response = { gems: 5, rewards: [], player: { id: 'player' } }
    const requests = stubHttp(t, response)

    assert.deepEqual(await player.claimLevelRewards(level), response)
    assert.equal(requests[0].url.pathname, '/api/me/level-rewards/claim')
    assert.equal(requests[0].method, 'POST')
    assert.deepEqual(requests[0].body, level === undefined ? {} : { level })
  })
}

test('updating the profile preserves false values and sends only supplied fields', async (t) => {
  const changes = { display_name: 'Captain', leaderboard_opt_in: false }
  const requests = stubHttp(t, { ...changes, id: 'player' })

  const result = await player.updateMe(changes)

  assert.deepEqual(result, { ...changes, id: 'player' })
  assert.equal(requests[0].url.pathname, '/api/me')
  assert.equal(requests[0].method, 'PATCH')
  assert.deepEqual(requests[0].body, changes)
})

for (const alreadyClaimed of [false, true]) {
  test(`claiming a daily login returns already_claimed=${alreadyClaimed} without recalculating rewards`, async (t) => {
    const response = {
      day: 4,
      doubloons: alreadyClaimed ? 0 : 30,
      xp: alreadyClaimed ? 0 : 10,
      already_claimed: alreadyClaimed,
      player: { id: 'player' },
    }
    const requests = stubHttp(t, response)

    const result = await player.claimDailyLogin()

    assert.deepEqual(result, response)
    assert.equal(requests[0].url.pathname, '/api/me/daily-login')
    assert.equal(requests[0].method, 'POST')
  })
}

test('purchasing a cosmetic sends its item ID and returns the updated player', async (t) => {
  const response = { item_id: 'avatar-1', player: { id: 'player' } }
  const requests = stubHttp(t, response)

  const result = await player.purchase('avatar-1')

  assert.deepEqual(result, response)
  assert.equal(requests[0].url.pathname, '/api/shop/purchase')
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].body, { item_id: 'avatar-1' })
})

test('a refused purchase propagates the server reason without retrying', async (t) => {
  const requests = stubHttp(t, { detail: 'Not enough Gems' }, 409)

  await assert.rejects(player.purchase('avatar-1'), {
    status: 409,
    message: 'Not enough Gems',
  })

  assert.equal(requests.length, 1)
})

test('an aborted profile read does not reach the network', async (t) => {
  const requests = stubHttp(t)
  const controller = new AbortController()
  controller.abort()

  await assert.rejects(player.getMe(controller.signal), { kind: 'aborted' })

  assert.equal(requests.length, 0)
})
