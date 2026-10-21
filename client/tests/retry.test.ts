import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isRetryable, retryDelay } from '../features/arena/retry.ts'
import { HttpError } from '../services/httpService.ts'

test('network failures and server faults are retried', () => {
  assert.equal(isRetryable(new HttpError('Offline', 'network')), true)
  assert.equal(isRetryable(new HttpError('Down', 'http', 503)), true)
  assert.equal(isRetryable(new HttpError('Slow down', 'http', 429)), true)
})

test('refusals and cancellations are not retried', () => {
  for (const status of [401, 403, 404, 409, 422])
    assert.equal(isRetryable(new HttpError('No', 'http', status)), false)
  assert.equal(isRetryable(new HttpError('Cancelled', 'aborted')), false)
})

test('retry delays double up to fifteen seconds', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6].map(retryDelay),
    [1500, 3000, 6000, 12000, 15000, 15000],
  )
})
