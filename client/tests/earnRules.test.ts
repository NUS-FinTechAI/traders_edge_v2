import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EARN, streakRows } from '../features/profile/earnRules.ts'

test('the login cycle groups days that pay the same reward', () => {
  assert.deepEqual(
    streakRows().map((row) => [row.source, row.amount]),
    [
      ['Days 1\u2060–\u20603', '20 Doubloons · 10 XP'],
      ['Day 4', '30 Doubloons · 10 XP'],
      ['Days 5\u2060–\u20606', '30 Doubloons · 20 XP'],
      ['Day 7', '50 Doubloons · 20 XP'],
    ],
  )
})

test('a cycle with one reward for every day is a single row', () => {
  assert.deepEqual(
    streakRows([5, 5, 5], [1, 1, 1]).map((row) => row.source),
    ['Days 1\u2060–\u20603'],
  )
})

test('login amounts are shown as the range across the cycle', () => {
  const login = (topic: 'doubloons' | 'xp') =>
    EARN[topic].rows.find((row) => row.source === 'Daily login reward')?.amount
  assert.equal(login('doubloons'), '20–50 a day')
  assert.equal(login('xp'), '10–20')
})
