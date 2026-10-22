import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EARN } from '../features/profile/earnRules.ts'

test('login amounts are shown as the range across the cycle', () => {
  const login = (topic: 'doubloons' | 'xp') =>
    EARN[topic].rows.find((row) => row.source === 'Daily login reward')?.amount
  assert.equal(login('doubloons'), '20–50 a day')
  assert.equal(login('xp'), '10–20')
})
