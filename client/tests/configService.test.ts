import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { ConfigService } from '../services/configService.ts'
import httpService, { HttpService } from '../services/httpService.ts'

const guestConfig = { auth: { mode: 'guest', firebase_project_id: null } }
const firebaseConfig = {
  auth: { mode: 'firebase', firebase_project_id: 'test-project' },
}

let configService: ConfigService
beforeEach(() => {
  configService = new ConfigService()
})

test('public config loads without consulting the token provider', async (t) => {
  const getAccessToken = t.mock.fn(async () => 'private-token')
  const http = new HttpService({
    baseUrl: 'http://localhost:8000',
    getAccessToken,
  })
  t.mock.method(httpService, 'request', http.request.bind(http))
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json(guestConfig),
  )

  const config = await configService.getConfig()

  assert.deepEqual(config, guestConfig)
  assert.equal(getAccessToken.mock.callCount(), 0)
  assert.equal(fetchMock.mock.callCount(), 1)
  const [url, options] = fetchMock.mock.calls[0].arguments
  assert.equal(String(url), 'http://localhost:8000/api/config')
  assert.equal(options?.method, 'GET')
  assert.equal(options?.cache, 'no-store')
  assert.equal(new Headers(options?.headers).has('Authorization'), false)
})

test('firebase config includes the configured project identity', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(firebaseConfig))

  const config = await configService.getConfig()

  assert.deepEqual(config, firebaseConfig)
})

for (const [condition, body] of [
  ['null response', null],
  ['array response', []],
  ['missing auth', {}],
  ['null auth', { auth: null }],
  ['array auth', { auth: [] }],
  ['unknown mode', { auth: { mode: 'google', firebase_project_id: null } }],
  ['guest missing project field', { auth: { mode: 'guest' } }],
  [
    'guest with active project',
    { auth: { mode: 'guest', firebase_project_id: 'project' } },
  ],
  ['firebase missing project', { auth: { mode: 'firebase' } }],
  [
    'firebase null project',
    { auth: { mode: 'firebase', firebase_project_id: null } },
  ],
  [
    'firebase empty project',
    { auth: { mode: 'firebase', firebase_project_id: '' } },
  ],
  [
    'firebase blank project',
    { auth: { mode: 'firebase', firebase_project_id: '  ' } },
  ],
  [
    'firebase nonstring project',
    { auth: { mode: 'firebase', firebase_project_id: 123 } },
  ],
] as const) {
  test(`config rejects ${condition} without defaulting to guest`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body))

    await assert.rejects(configService.getConfig(), {
      kind: 'invalid-response',
    })
  })
}

test('subsequent config requests reuse the successful response', async (t) => {
  let response: unknown = guestConfig
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json(response),
  )
  assert.deepEqual(await configService.getConfig(), guestConfig)
  response = firebaseConfig

  const config = await configService.getConfig()

  assert.deepEqual(config, guestConfig)
  assert.equal(fetchMock.mock.callCount(), 1)
})

test('invalid responses are not cached and can be retried', async (t) => {
  let response: unknown = {}
  t.mock.method(globalThis, 'fetch', async () => Response.json(response))
  await assert.rejects(configService.getConfig(), { kind: 'invalid-response' })
  response = guestConfig

  const config = await configService.getConfig()

  assert.deepEqual(config, guestConfig)
})

test('an aborted request rejects even when configuration is cached', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json(guestConfig),
  )
  await configService.getConfig()
  const controller = new AbortController()
  controller.abort()

  await assert.rejects(configService.getConfig({ signal: controller.signal }), {
    kind: 'aborted',
  })

  assert.equal(fetchMock.mock.callCount(), 1)
  assert.deepEqual(await configService.getConfig(), guestConfig)
})

test('config can be retried after a network failure', async (t) => {
  let offline = true
  t.mock.method(globalThis, 'fetch', async () => {
    if (offline) throw new TypeError('Offline')
    return Response.json(guestConfig)
  })
  await assert.rejects(configService.getConfig(), { kind: 'network' })
  offline = false

  const config = await configService.getConfig()

  assert.deepEqual(config, guestConfig)
})

for (const status of [401, 503]) {
  test(`config preserves HTTP ${status} without triggering a login redirect`, async (t) => {
    const onUnauthorized = t.mock.fn()
    const http = new HttpService({
      baseUrl: 'http://localhost:8000',
      onUnauthorized,
    })
    t.mock.method(httpService, 'request', http.request.bind(http))
    t.mock.method(globalThis, 'fetch', async () =>
      Response.json({ detail: 'Unavailable' }, { status }),
    )

    await assert.rejects(configService.getConfig(), { kind: 'http', status })

    assert.equal(onUnauthorized.mock.callCount(), 0)
  })
}

test('cancelled config requests do not call the server', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json(guestConfig),
  )
  const controller = new AbortController()
  controller.abort()

  await assert.rejects(configService.getConfig({ signal: controller.signal }), {
    kind: 'aborted',
  })

  assert.equal(fetchMock.mock.callCount(), 0)
})

test('config cancellation forwards the signal during a request', async (t) => {
  const controller = new AbortController()
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], options?: RequestInit) => {
      assert.equal(options?.signal, controller.signal)
      controller.abort()
      throw controller.signal.reason
    },
  )

  await assert.rejects(configService.getConfig({ signal: controller.signal }), {
    kind: 'aborted',
  })
})
