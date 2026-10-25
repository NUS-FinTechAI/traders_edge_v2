import assert from 'node:assert/strict'
import { test } from 'node:test'
import { levelProgress } from '../app/levelProgress.ts'

test('maximum level shows a fixed label and completed ring with no surplus XP', () => {
  const progress = levelProgress({ xp_into_level: 0, xp_for_next_level: 0 })

  assert.equal(progress.atMaxLevel, true)
  assert.equal(progress.fraction, 1)
})

test('earning more XP at maximum level preserves the label and ring', () => {
  const capped = levelProgress({ xp_into_level: 0, xp_for_next_level: 0 })

  const afterReward = levelProgress({
    xp_into_level: 700,
    xp_for_next_level: 0,
  })

  assert.deepEqual(afterReward, capped)
})

test('players below the cap still see XP and a percentage towards the next level', () => {
  const progress = levelProgress({ xp_into_level: 25, xp_for_next_level: 250 })

  assert.equal(progress.atMaxLevel, false)
  assert.equal(progress.text, '25 / 250 XP · 10%')
  assert.equal(progress.fraction, 0.1)
})
