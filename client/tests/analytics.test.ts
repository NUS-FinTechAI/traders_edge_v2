import assert from 'node:assert/strict'
import { test } from 'node:test'
import { scrubEvent, stripUrl } from '../services/analytics.ts'

test('stripUrl removes the query string and fragment', () => {
  assert.equal(
    stripUrl('https://x.app/multiplayer?code=ABC123#top'),
    'https://x.app/multiplayer',
  )
  assert.equal(stripUrl('https://x.app/a#frag?x=1'), 'https://x.app/a')
})

test('stripUrl leaves a clean URL alone', () => {
  assert.equal(stripUrl('https://x.app/adventure'), 'https://x.app/adventure')
})

test('scrubEvent keeps other event fields', () => {
  assert.deepEqual(
    scrubEvent({ type: 'pageview', url: 'https://x.app/login?token=s' }),
    { type: 'pageview', url: 'https://x.app/login' },
  )
})
