import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MissionNotifications } from '../features/arena/missionNotifications.ts'
import type { Mission } from '../services/gameService.ts'

function mission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: 'mission',
    tier: 'basic',
    text: 'Hold two different companies',
    done: false,
    state: 'pending',
    progress: '0/2',
    ...overrides,
  }
}

test('a normal milestone produces one completion notice across repeated polls', () => {
  const notices = new MissionNotifications()
  notices.update([mission()], true)

  const completed = mission({ done: true, state: 'done', progress: '2/2' })

  assert.equal(
    notices.update([completed], true),
    'Mission complete: Hold two different companies',
  )
  assert.equal(notices.update([completed], true), null)
})

test('a bonus milestone is identified in its completion notice', () => {
  const notices = new MissionNotifications()
  notices.update([mission({ tier: 'bonus' })], true)

  assert.equal(
    notices.update(
      [mission({ tier: 'bonus', done: true, state: 'done' })],
      true,
    ),
    'Bonus mission complete: Hold two different companies',
  )
})

test('opening an existing match does not replay completed missions', () => {
  const notices = new MissionNotifications()
  const missions = [mission({ done: true, state: 'done' })]

  assert.equal(notices.update(missions, true), null)
  assert.equal(notices.update(missions, true), null)
})

test('provisional criteria do not announce completion when they toggle', () => {
  const notices = new MissionNotifications()
  notices.update([mission()], true)

  for (const state of ['on_track', 'behind', 'on_track', 'failed'] as const) {
    assert.equal(notices.update([mission({ state })], true), null)
  }
})

test('simultaneous normal and bonus completions use a single notice', () => {
  const notices = new MissionNotifications()
  notices.update([mission(), mission({ id: 'bonus', tier: 'bonus' })], true)

  assert.equal(
    notices.update(
      [
        mission({ done: true, state: 'done' }),
        mission({ id: 'bonus', tier: 'bonus', done: true, state: 'done' }),
      ],
      true,
    ),
    '2 missions complete: 1 normal, 1 bonus.',
  )
})

test('completion at settlement is left to the results screen', () => {
  const notices = new MissionNotifications()
  notices.update([mission()], true)
  const completed = [mission({ done: true, state: 'done' })]

  assert.equal(notices.update(completed, false), null)
  assert.equal(notices.update(completed, true), null)
})
