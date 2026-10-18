import assert from 'node:assert/strict'
import { test } from 'node:test'
import { text, isEnumValue } from '../utilities/typeUtils.ts'
import { apiEnums } from '../api/api-enums.ts'

test('nonempty text rejects an empty identifier', () => {
  assert.throws(() => text(''), { kind: 'invalid-response' })
})

test('generated enum membership accepts only exact schema values', () => {
  assert.equal(isEnumValue(apiEnums.ChallengeType, 'daily'), true)
  for (const value of ['DAILY', 'unknown', null, 1, {}, ['daily']])
    assert.equal(isEnumValue(apiEnums.ChallengeType, value), false)
})

test('numeric enum membership does not coerce strings or booleans', () => {
  const values = { easy: 1, hard: 2 } as const
  assert.equal(isEnumValue(values, 1), true)
  assert.equal(isEnumValue(values, '1'), false)
  assert.equal(isEnumValue(values, true), false)
})
