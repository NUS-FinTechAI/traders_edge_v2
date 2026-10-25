import assert from 'node:assert/strict'
import { test } from 'node:test'
import { observeLevel, type LevelUpState } from '../app/levelUp.ts'

const empty: LevelUpState = { id: null, level: 0, celebration: null }
const baseline = observeLevel(empty, { id: 'player', level: 3 })

test('signing in establishes the level without a celebration', () => {
  assert.deepEqual(baseline, { id: 'player', level: 3, celebration: null })
})

test('a server-confirmed increase opens the new level', () => {
  assert.deepEqual(observeLevel(baseline, { id: 'player', level: 4 }), {
    id: 'player',
    level: 4,
    celebration: 4,
  })
})

test('a reward crossing several levels shows the latest level', () => {
  assert.equal(
    observeLevel(baseline, { id: 'player', level: 6 }).celebration,
    6,
  )
})

test('refreshing a dismissed level does not reopen it', () => {
  const dismissed = { id: 'player', level: 4, celebration: null }
  assert.equal(observeLevel(dismissed, { id: 'player', level: 4 }), dismissed)
})

test('a later level increase opens another celebration', () => {
  const dismissed = { id: 'player', level: 4, celebration: null }
  assert.equal(
    observeLevel(dismissed, { id: 'player', level: 5 }).celebration,
    5,
  )
})

test('switching accounts clears any pending celebration', () => {
  const pending = { id: 'player', level: 4, celebration: 4 }
  assert.deepEqual(observeLevel(pending, { id: 'other', level: 9 }), {
    id: 'other',
    level: 9,
    celebration: null,
  })
})

test('signing out clears the level and pending celebration', () => {
  assert.deepEqual(
    observeLevel({ id: 'player', level: 4, celebration: 4 }, null),
    empty,
  )
})

test('an older response cannot lower the observed level', () => {
  const dismissed = { id: 'player', level: 4, celebration: null }
  assert.equal(observeLevel(dismissed, { id: 'player', level: 3 }), dismissed)
})
