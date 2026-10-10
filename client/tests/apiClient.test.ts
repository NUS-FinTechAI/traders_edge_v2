import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiClient } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import { HttpService } from '../services/httpService.ts'

test('typed endpoint encodes each path parameter and includes authentication', async (t) => {
  const client = new ApiClient(
    new HttpService({
      baseUrl: 'http://localhost:8000',
      getAccessToken: async () => 'test-token',
    }),
  )
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ id: 'attempt' }),
  )

  const result = await client.call(apiEndpoints.getChallenge, {
    path: { attempt_id: 'a/b ?#%' },
  })

  assert.deepEqual(result, { id: 'attempt' })
  const [url, init] = fetchMock.mock.calls[0].arguments
  assert.equal(
    String(url),
    'http://localhost:8000/api/challenges/a%2Fb%20%3F%23%25',
  )
  assert.equal(init?.method, 'GET')
  assert.equal(init?.credentials, 'include')
  assert.equal(
    new Headers(init?.headers).get('Authorization'),
    'Bearer test-token',
  )
})

test('typed endpoint serializes query parameters', async (t) => {
  const client = new ApiClient(
    new HttpService({ baseUrl: 'http://localhost:8000' }),
  )
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ entries: [] }),
  )

  await client.call(apiEndpoints.listJournal, { query: { limit: 12 } })

  assert.equal(
    String(fetchMock.mock.calls[0].arguments[0]),
    'http://localhost:8000/api/journal?limit=12',
  )
})

test('typed mutation sends its generated method and body', async (t) => {
  const client = new ApiClient(
    new HttpService({ baseUrl: 'http://localhost:8000' }),
  )
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ id: 'learner' }),
  )

  await client.call(apiEndpoints.updateProfile, {
    body: { display_name: 'Learner' },
  })

  const [url, init] = fetchMock.mock.calls[0].arguments
  assert.equal(String(url), 'http://localhost:8000/api/me/profile')
  assert.equal(init?.method, 'PATCH')
  assert.deepEqual(JSON.parse(String(init?.body)), { display_name: 'Learner' })
})

test('typed logout accepts an empty 204 response', async (t) => {
  const client = new ApiClient(
    new HttpService({ baseUrl: 'http://localhost:8000' }),
  )
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(null, { status: 204 }),
  )

  const result = await client.call(apiEndpoints.logout)

  assert.equal(result, undefined)
})

test('typed calls preserve cancellation and do not fetch after abort', async (t) => {
  const client = new ApiClient(
    new HttpService({ baseUrl: 'http://localhost:8000' }),
  )
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({}),
  )
  const controller = new AbortController()
  controller.abort()

  await assert.rejects(
    client.call(apiEndpoints.getProfile, { signal: controller.signal }),
    { kind: 'aborted' },
  )

  assert.equal(fetchMock.mock.callCount(), 0)
})

test('typed calls preserve HTTP failures without retrying', async (t) => {
  const client = new ApiClient(
    new HttpService({ baseUrl: 'http://localhost:8000' }),
  )
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ detail: 'Unavailable' }, { status: 503 }),
  )

  await assert.rejects(client.call(apiEndpoints.getProfile), {
    kind: 'http',
    status: 503,
  })

  assert.equal(fetchMock.mock.callCount(), 1)
})

test('dot-segment path values are rejected before fetching', (t) => {
  const client = new ApiClient(
    new HttpService({ baseUrl: 'http://localhost:8000' }),
  )
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({}),
  )

  assert.throws(
    () =>
      client.call(apiEndpoints.getChallenge, { path: { attempt_id: '..' } }),
    TypeError,
  )

  assert.equal(fetchMock.mock.callCount(), 0)
})
