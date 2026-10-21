import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resourceSnapshot, type Settled } from '../ui/useResource.ts'

const xp: Settled<string> = {
  key: '["xp"]',
  request: '[0,"[\\"xp\\"]"]',
  data: 'xp rows',
}

test('a new key does not show the previous key’s data while loading', () => {
  const snapshot = resourceSnapshot(xp, '["ranked"]', '[0,"[\\"ranked\\"]"]')

  assert.equal(snapshot.status, 'loading')
  assert.equal(snapshot.data, undefined)
})

test('a reload of the same key keeps its data on screen', () => {
  const snapshot = resourceSnapshot(xp, '["xp"]', '[1,"[\\"xp\\"]"]')

  assert.equal(snapshot.status, 'loading')
  assert.equal(snapshot.data, 'xp rows')
})

test('a failed reload reports the error alongside the kept data', () => {
  const failed = { ...xp, request: '[1,"[\\"xp\\"]"]', error: 'Offline' }

  const snapshot = resourceSnapshot(failed, '["xp"]', '[1,"[\\"xp\\"]"]')

  assert.deepEqual(snapshot, {
    status: 'error',
    data: 'xp rows',
    error: 'Offline',
  })
})
