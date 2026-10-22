import assert from 'node:assert/strict'
import { test } from 'node:test'
import { scrubEvent, withoutQuery } from '../services/errorScrub.ts'

test('a URL loses its query string and fragment', () => {
  assert.equal(
    withoutQuery('https://app.example.test/login?returnTo=/play#top'),
    'https://app.example.test/login',
  )
})

test('an event keeps the page, method and browser but drops cookies, headers, body and query', () => {
  const event = scrubEvent({
    request: {
      url: 'https://app.example.test/quiz?attempt=7',
      method: 'GET',
      query_string: 'attempt=7',
      cookies: { traders_edge_session: 'secret' },
      data: { answer: 'b' },
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://app.example.test/login?returnTo=/quiz',
        Authorization: 'Bearer token',
      },
    },
  })

  assert.deepEqual(event.request, {
    url: 'https://app.example.test/quiz',
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
})

test('breadcrumb fetch and navigation URLs lose their query strings', () => {
  const event = scrubEvent({
    breadcrumbs: [
      { category: 'fetch', data: { url: '/api/me?cursor=abc', method: 'GET' } },
      {
        category: 'navigation',
        data: { from: '/login?returnTo=/play', to: '/play?tab=1' },
      },
    ],
  })

  assert.deepEqual(
    event.breadcrumbs?.map((crumb) => crumb.data),
    [
      { url: '/api/me', method: 'GET' },
      { from: '/login', to: '/play' },
    ],
  )
})

test('an event without request data or breadcrumbs is unchanged', () => {
  assert.deepEqual(scrubEvent({ message: 'boom' }), { message: 'boom' })
})
