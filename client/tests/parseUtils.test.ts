import assert from 'node:assert/strict'
import { test } from 'node:test'
import { amount, list, text } from '../utilities/typeUtils.ts'

test('list parses decimal strings without requiring object entries', () => {
  const prices = list(['40.00', '40.12'], amount)

  assert.deepEqual(prices, ['40.00', '40.12'])
})

test('list rejects malformed prices with the API error classification', () => {
  assert.throws(() => list(['40.00', 'not-a-price'], amount), {
    kind: 'invalid-response',
  })
})

test('nonempty text rejects an empty identifier', () => {
  assert.throws(() => text(''), { kind: 'invalid-response' })
})
