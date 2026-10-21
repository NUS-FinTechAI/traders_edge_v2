import assert from 'node:assert/strict'
import { test } from 'node:test'
import { safeReturnTo } from '../features/auth/returnTo.ts'

test('a same-site path with a query is kept as the return target', () => {
  assert.equal(safeReturnTo('/level/ch1-l2?x=1'), '/level/ch1-l2?x=1')
})

test('missing, external and protocol-relative targets fall back to home', () => {
  assert.equal(safeReturnTo(null), '/')
  assert.equal(safeReturnTo('https://evil.test/'), '/')
  assert.equal(safeReturnTo('//evil.test/path'), '/')
  assert.equal(safeReturnTo('/\\evil.test'), '/')
})

test('returning to the login page itself falls back to home', () => {
  assert.equal(safeReturnTo('/login?returnTo=/play'), '/')
})
