import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import httpService, { HttpService, HttpError } from '../services/httpService.ts'

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
    await httpService.get('/api/journal?limit=10', {
      query: { limit: 0, enabled: false, tag: ['a & b', 'c'], missing: null },
    }),
    { entries: [] },
  )
  assert.equal(fetchMock.mock.callCount(), 1)
})

test('POST and PATCH serialize JSON and use the latest supplied token', async (t) => {
  let token = 'first'
  stubFetch(t, async (_input, init) => {
    assert.ok(['POST', 'PATCH'].includes(init?.method ?? ''))
    const headers = new Headers(init?.headers)
    assert.equal(headers.get('Authorization'), `Bearer ${token}`)
    assert.equal(headers.get('Content-Type'), 'application/json')
    assert.equal(headers.get('Accept'), 'application/json')
    assert.equal(init?.credentials, 'omit')
    assert.equal(init?.body, '{"display_name":"Learner"}')
    return Response.json({ id: 'profile' })
  })
  const http = new HttpService({
    baseUrl,
    credentials: 'omit',
    getAccessToken: async () => token,
  })
  await http.post('/api/example', { display_name: 'Learner' })
  token = 'second'
  await http.patch(
    '/api/me/profile',
    { display_name: 'Learner' },
    { headers: { Authorization: 'Bearer stale' } },
  )
})

test('DELETE handles 204 and public calls skip token lookup and 401 notification', async (t) => {
  const getAccessToken = t.mock.fn(async () => 'token')
  const onUnauthorized = t.mock.fn()
  stubFetch(t, async (_input, init) => {
    assert.equal(new Headers(init?.headers).has('Authorization'), false)
    if (init?.method === 'DELETE') return new Response(null, { status: 204 })
    return Response.json({ detail: 'Sign in' }, { status: 401 })
  })
  const http = new HttpService({ baseUrl, getAccessToken, onUnauthorized })
  assert.equal(await http.delete('/api/session', { auth: 'none' }), undefined)
  await assert.rejects(
    http.get('/health', {
      auth: 'none',
      headers: { Authorization: 'Bearer stale' },
    }),
    { status: 401 },
  )
  assert.equal(getAccessToken.mock.callCount(), 0)
  assert.equal(onUnauthorized.mock.callCount(), 0)
})

test('protected 401 notifies auth while 403 does not; requests are not retried', async (t) => {
  let status = 401
  const onUnauthorized = t.mock.fn(() => {
    throw new Error('subscriber failed')
  })
  const fetchMock = stubFetch(t, async () =>
    Response.json({ detail: 'Access denied' }, { status }),
  )
  const http = new HttpService({ baseUrl, onUnauthorized })
  await assert.rejects(http.get('/api/me/profile'), {
    name: 'HttpError',
    kind: 'http',
    status: 401,
    message: 'Access denied',
  })
  status = 403
  await assert.rejects(http.get('/api/curriculum'), { status: 403 })
  assert.equal(onUnauthorized.mock.callCount(), 1)
  assert.equal(fetchMock.mock.callCount(), 2)
})

test('validation errors preserve FastAPI field details', async (t) => {
  const detail = [
    {
      loc: ['body', 'display_name'],
      msg: 'String should have at least 2 characters',
      type: 'string_too_short',
    },
  ]
  stubFetch(t, async () => Response.json({ detail }, { status: 422 }))
  await assert.rejects(
    new HttpService({ baseUrl }).patch('/api/me/profile', {
      display_name: 'x',
    }),
    (error: unknown) => {
      assert.ok(error instanceof HttpError)
      assert.equal(error.status, 422)
      assert.equal(error.message, detail[0].msg)
      assert.deepEqual(error.details, detail)
      return true
    },
  )
})

test('non-JSON errors retain status; invalid successful JSON is a protocol error', async (t) => {
  let status = 502
  stubFetch(t, async () => new Response('<html>Proxy error</html>', { status }))
  const http = new HttpService({ baseUrl })
  await assert.rejects(http.get('/api/me/profile'), {
    kind: 'http',
    status: 502,
    message: 'Request failed (502)',
  })
  status = 200
  await assert.rejects(http.get('/api/me/profile'), {
    kind: 'invalid-response',
    status: 200,
  })
})

test('network failures are distinguishable and mutations are never retried', async (t) => {
  const fetchMock = stubFetch(t, async () => {
    throw new TypeError('Failed to fetch')
  })
  await assert.rejects(httpService.post('/api/session'), {
    kind: 'network',
    status: null,
  })
  assert.equal(fetchMock.mock.callCount(), 1)
})

test('409 retains the conflict and sends the original idempotency key once', async (t) => {
  const body = {
    idempotency_key: 'existing-key',
    reflection: 'Original reflection',
  }
  const fetchMock = stubFetch(t, async (_input, init) => {
    assert.deepEqual(JSON.parse(String(init?.body)), body)
    return Response.json(
      { detail: 'Retry with the same idempotency key' },
      { status: 409 },
    )
  })
  await assert.rejects(
    new HttpService({ baseUrl }).post('/api/lessons/lesson/complete', body),
    { status: 409 },
  )
  assert.equal(fetchMock.mock.callCount(), 1)
})

test('aborted requests do not obtain tokens or call fetch', async (t) => {
  const getAccessToken = t.mock.fn(async () => 'token')
  const fetchMock = stubFetch(t, async () => Response.json({}))
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    new HttpService({ baseUrl, getAccessToken }).get('/api/me/profile', {
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
    new HttpService({ baseUrl }).get('/api/me/profile', {
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
    await assert.rejects(http.get(path), TypeError)
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
