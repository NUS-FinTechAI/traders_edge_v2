import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import httpService, { HttpService } from '../services/httpService.ts'

const baseUrl = 'http://localhost:8000'

function stubFetch(t: TestContext, respond: typeof fetch) {
  return t.mock.method(globalThis, 'fetch', respond)
}

test('GET includes cookies, encodes query values and returns JSON', async (t) => {
  const fetchMock = stubFetch(t, async (input, init) => {
    const url = new URL(String(input))
    assert.equal(url.origin, baseUrl)
    assert.equal(url.pathname, '/api/journal')
    assert.equal(url.searchParams.get('limit'), '0')
    assert.equal(url.searchParams.get('enabled'), 'false')
    assert.deepEqual(url.searchParams.getAll('tag'), ['a & b', 'c'])
    assert.equal(url.searchParams.has('missing'), false)
    assert.equal(init?.credentials, 'include')
    assert.equal(init?.cache, 'no-store')
    assert.equal(init?.redirect, 'error')
    assert.equal(new Headers(init?.headers).get('Content-Type'), null)
    return Response.json({ entries: [] })
  })
  assert.deepEqual(
    await httpService.request('/api/journal?limit=10', {
      query: { limit: 0, enabled: false, tag: ['a & b', 'c'], missing: null },
    }),
    { entries: [] },
  )
  assert.equal(fetchMock.mock.callCount(), 1)
})

test('network failures are distinguishable and mutations are never retried', async (t) => {
  const fetchMock = stubFetch(t, async () => {
    throw new TypeError('Failed to fetch')
  })
  await assert.rejects(
    httpService.request('/api/session', { method: 'POST' }),
    {
      kind: 'network',
      status: null,
    },
  )
  assert.equal(fetchMock.mock.callCount(), 1)
})

test('aborted requests do not obtain tokens or call fetch', async (t) => {
  const getAccessToken = t.mock.fn(async () => 'token')
  const fetchMock = stubFetch(t, async () => Response.json({}))
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    new HttpService({ baseUrl, getAccessToken }).request('/api/me/profile', {
      signal: controller.signal,
    }),
    { kind: 'aborted', status: null },
  )
  assert.equal(getAccessToken.mock.callCount(), 0)
  assert.equal(fetchMock.mock.callCount(), 0)
})

test('cancellation during a request forwards the signal and remains distinguishable', async (t) => {
  const controller = new AbortController()
  stubFetch(t, async (_input, init) => {
    assert.equal(init?.signal, controller.signal)
    controller.abort()
    throw controller.signal.reason
  })
  await assert.rejects(
    new HttpService({ baseUrl }).request('/api/me/profile', {
      signal: controller.signal,
    }),
    { kind: 'aborted' },
  )
})

test('unsafe destinations fail before obtaining credentials or making requests', async (t) => {
  const getAccessToken = t.mock.fn(async () => 'private-token')
  const fetchMock = stubFetch(t, async () => Response.json({}))
  const http = new HttpService({ baseUrl, getAccessToken })
  for (const path of [
    'https://other.example/api',
    '//other.example/api',
    '/\\other.example/api',
    '/\n/other.example/api',
    'api/profile',
    '/api/profile#fragment',
  ]) {
    await assert.rejects(http.request(path), TypeError)
  }
  await assert.rejects(http.request('/api/me/profile', { body: {} }), TypeError)
  assert.equal(getAccessToken.mock.callCount(), 0)
  assert.equal(fetchMock.mock.callCount(), 0)
  for (const origin of [
    'ftp://localhost',
    'https://user:password@example.com',
    'https://example.com/api',
    'https://example.com?key=value',
  ]) {
    assert.throws(() => new HttpService({ baseUrl: origin }), TypeError)
  }
})
