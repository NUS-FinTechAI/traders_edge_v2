import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getDaily,
  getPractice,
  getBosses,
  refreshDaily,
  onCooldown,
  type Daily,
} from '../services/dailyService.ts'
import { stubHttp } from './helpers/serviceHttp.ts'

const daily: Daily = {
  active_game_id: null,
  attempts_today: 0,
  cooldown_until: null,
  date: '2026-10-22',
  locked_reason: null,
  unlocked: true,
  won_today: false,
  refresh_cost_gems: 20,
  opponent: {
    bot_id: 'rookie',
    name: 'Rookie',
    tier: 'rookie',
    avatar: 'rookie',
    style: 'cautious',
  },
  scenario: { id: 'daily-1', title: 'Daily', briefing: 'Practice', ticks: 30 },
  week: {
    doubloons: 0,
    target: 1000,
    wins_this_week: 0,
    resets_at: '2026-10-26T00:00:00Z',
  },
}

for (const [name, load, path, response] of [
  ['daily challenge', getDaily, '/api/daily', daily],
  ['practice scenarios', getPractice, '/api/practice', { scenarios: [] }],
  ['bosses', getBosses, '/api/bosses', { bosses: [] }],
] as const) {
  test(`loading ${name} returns the server data and forwards cancellation`, async (t) => {
    const requests = stubHttp(t, response)
    const controller = new AbortController()

    const result = await load(controller.signal)

    assert.deepEqual(result, response)
    assert.equal(requests[0].url.pathname, path)
    assert.equal(requests[0].method, 'GET')
    assert.equal(requests[0].signal, controller.signal)
  })
}

test('refreshing the daily posts once and returns the updated challenge', async (t) => {
  const requests = stubHttp(t, daily)

  const result = await refreshDaily()

  assert.deepEqual(result, daily)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url.pathname, '/api/daily/refresh')
  assert.equal(requests[0].method, 'POST')
})

test('an unaffordable refresh propagates the rejection without retrying', async (t) => {
  const requests = stubHttp(t, { detail: 'Not enough Gems' }, 409)

  await assert.rejects(refreshDaily(), {
    status: 409,
    message: 'Not enough Gems',
  })

  assert.equal(requests.length, 1)
})

for (const [label, until, expected] of [
  ['missing', null, false],
  ['future', '2026-10-22T12:00:01Z', true],
  ['at the current instant', '2026-10-22T12:00:00Z', false],
  ['past', '2026-10-22T11:59:59Z', false],
] as const) {
  test(`a cooldown ${label} is ${expected ? 'active' : 'inactive'}`, () => {
    const state = { ...daily, cooldown_until: until }

    const result = onCooldown(state, Date.parse('2026-10-22T12:00:00Z'))

    assert.equal(result, expected)
  })
}

test('an aborted daily read never reaches the network', async (t) => {
  const requests = stubHttp(t)
  const controller = new AbortController()
  controller.abort()

  await assert.rejects(getDaily(controller.signal), { kind: 'aborted' })

  assert.equal(requests.length, 0)
})
