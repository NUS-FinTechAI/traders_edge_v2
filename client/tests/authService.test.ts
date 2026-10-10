import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AuthService, type UserProfile } from '../services/authService.ts'
import { HttpError, HttpService } from '../services/httpService.ts'

const authService = new AuthService(
  new HttpService({ baseUrl: 'http://localhost:8000' }),
)

test('logout signs out the identity provider after clearing the backend session', async (t) => {
  let backendCleared = false
  t.mock.method(globalThis, 'fetch', async () => {
    backendCleared = true
    return new Response(null, { status: 204 })
  })
  const signOut = t.mock.fn(async () => {
    assert.equal(backendCleared, true)
  })
  const auth = new AuthService(
    new HttpService({ baseUrl: 'http://localhost:8000' }),
    signOut,
  )
  await auth.logout()
  assert.equal(signOut.mock.callCount(), 1)
})

test('logout signs out the identity provider when the backend session has expired', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ detail: 'Expired' }, { status: 401 }),
  )
  const signOut = t.mock.fn(async () => {})
  const auth = new AuthService(
    new HttpService({ baseUrl: 'http://localhost:8000' }),
    signOut,
  )
  await auth.logout()
  assert.equal(signOut.mock.callCount(), 1)
})

test('logout preserves identity when backend session deletion fails', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Offline')
  })
  const signOut = t.mock.fn(async () => {})
  const auth = new AuthService(
    new HttpService({ baseUrl: 'http://localhost:8000' }),
    signOut,
  )
  await assert.rejects(auth.logout(), { kind: 'network' })
  assert.equal(signOut.mock.callCount(), 0)
})

const profile: UserProfile = {
  id: 'learner-id',
  display_name: 'Learner',
  leaderboard_opt_in: false,
  analytics_opt_in: false,
  xp: 0,
  completed_lesson_ids: [],
  mastered_module_ids: [],
  activity_days: [],
  activity_timezone: 'UTC',
  due_review_count: 0,
  learning_only: true,
  learning_xp: 0,
  game_xp: 0,
  player_level: 1,
  player_level_policy: '100-xp-per-level-1',
  xp_basis: 'learning and game events',
}

test('guest session creation is explicit and uses the shared HTTP service', async (t) => {
  const session = {
    profile_id: profile.id,
    auth_mode: 'guest',
    expires_at: '2026-10-13T00:00:00Z',
  }
  const getAccessToken = t.mock.fn(async () => 'token')
  const auth = new AuthService(
    new HttpService({
      baseUrl: 'http://localhost:8000',
      getAccessToken,
    }),
  )
  const fetchMock = t.mock.method(
    globalThis,
    'fetch',
    async (input: Parameters<typeof fetch>[0], options?: RequestInit) => {
      assert.equal(new URL(String(input)).pathname, '/api/session')
      assert.equal(options?.method, 'POST')
      assert.equal(options?.body, undefined)
      assert.equal(options?.credentials, 'include')
      return Response.json(session)
    },
  )
  assert.deepEqual(await auth.startGuestSession(), session)
  assert.equal(getAccessToken.mock.callCount(), 0)
  assert.equal(fetchMock.mock.callCount(), 1)
})

test('authentication checks consult the backend each time without creating a guest session', async (t) => {
  let status = 200
  const fetchMock = t.mock.method(
    globalThis,
    'fetch',
    async (input: Parameters<typeof fetch>[0], options?: RequestInit) => {
      assert.equal(new URL(String(input)).pathname, '/api/me/profile')
      assert.equal(options?.method, 'GET')
      return Response.json(
        status === 200 ? profile : { detail: 'Session expired' },
        { status },
      )
    },
  )
  assert.deepEqual(await authService.getProfile(), profile)
  assert.equal(await authService.isAuthenticated(), true)
  status = 401
  assert.equal(await authService.isAuthenticated(), false)
  assert.equal(fetchMock.mock.callCount(), 3)
})

test('getProfile preserves missing-session errors for its caller', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ detail: 'Sign in' }, { status: 401 }),
  )
  await assert.rejects(authService.getProfile(), { kind: 'http', status: 401 })
})

test('authentication checks propagate forbidden, server and network errors', async (t) => {
  let status = 403
  t.mock.method(globalThis, 'fetch', async () => {
    if (status === 0) throw new TypeError('Offline')
    return Response.json({ detail: 'Unavailable' }, { status })
  })
  for (status of [403, 503]) {
    await assert.rejects(authService.isAuthenticated(), {
      kind: 'http',
      status,
    })
  }
  status = 0
  await assert.rejects(authService.isAuthenticated(), {
    kind: 'network',
    status: null,
  })
})

test('authentication checks reject successful responses without a valid identity', async (t) => {
  let body: unknown = {}
  t.mock.method(globalThis, 'fetch', async () => Response.json(body))
  for (body of [null, {}, { id: '' }, { id: 123 }]) {
    await assert.rejects(authService.isAuthenticated(), {
      kind: 'invalid-response',
      status: 200,
    })
  }
})

test('logout deletes the session', async (t) => {
  const fetchMock = t.mock.method(
    globalThis,
    'fetch',
    async (input: Parameters<typeof fetch>[0], options?: RequestInit) => {
      assert.equal(new URL(String(input)).pathname, '/api/session')
      assert.equal(options?.method, 'DELETE')
      assert.equal(options?.credentials, 'include')
      return new Response(null, { status: 204 })
    },
  )
  await assert.doesNotReject(authService.logout())
  assert.equal(fetchMock.mock.callCount(), 1)
})

test('logout accepts an already expired session', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ detail: 'Session expired' }, { status: 401 }),
  )
  await assert.doesNotReject(authService.logout())
})

test('logout surfaces network failures instead of claiming the session was revoked', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Offline')
  })
  await assert.rejects(authService.logout(), { kind: 'network' })
})

test('cancelled authentication checks remain errors rather than unauthenticated results', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json(profile),
  )
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    authService.isAuthenticated({ signal: controller.signal }),
    (error: unknown) => {
      assert.ok(error instanceof HttpError)
      assert.equal(error.kind, 'aborted')
      return true
    },
  )
  assert.equal(fetchMock.mock.callCount(), 0)
})
