import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AuthController } from '../services/authController.ts'
import { HttpError } from '../services/httpService.ts'
import type { UserProfile } from '../services/authService.ts'
import { AuthService } from '../services/authService.ts'
import { ConfigService, type PublicConfig } from '../services/configService.ts'
import { HttpService } from '../services/httpService.ts'

const config = { auth: { mode: 'guest' as const, firebase_project_id: null } }
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

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

test('repeated startup calls share config and profile requests', async (t) => {
  const getConfig = t.mock.fn(async () => config)
  const getProfile = t.mock.fn(async () => profile)
  const controller = new AuthController(
    { getProfile, logout: async () => {} },
    { getConfig },
  )
  await Promise.all([controller.initialize(), controller.initialize()])
  await controller.initialize()
  assert.equal(getConfig.mock.callCount(), 1)
  assert.equal(getProfile.mock.callCount(), 1)
  assert.equal(controller.getSnapshot().status, 'signed-in')
  assert.deepEqual(controller.getSnapshot().user, profile)
})

test('startup with an expired session exposes signed-out state', async () => {
  const controller = new AuthController(
    {
      getProfile: async () => {
        throw new HttpError('Expired', 'http', 401)
      },
      logout: async () => {},
    },
    { getConfig: async () => config },
  )
  await controller.initialize()
  assert.equal(controller.getSnapshot().status, 'signed-out')
  assert.equal(controller.getSnapshot().user, null)
  assert.deepEqual(controller.getSnapshot().config, config)
})

test('a failed config startup can be retried without fetching a profile first', async (t) => {
  const getConfig = t.mock.fn(async (): Promise<PublicConfig> => {
    throw new Error('Offline')
  })
  const getProfile = t.mock.fn(async () => profile)
  const controller = new AuthController(
    { getProfile, logout: async () => {} },
    { getConfig },
  )
  await assert.rejects(controller.initialize(), /Offline/)
  assert.equal(controller.getSnapshot().status, 'unavailable')
  assert.equal(getProfile.mock.callCount(), 0)
  getConfig.mock.mockImplementation(async () => config)
  await controller.retry()
  assert.equal(controller.getSnapshot().status, 'signed-in')
  assert.equal(getProfile.mock.callCount(), 1)
})

test('forbidden profile responses are errors rather than signed-out sessions', async () => {
  const controller = new AuthController(
    {
      getProfile: async () => {
        throw new HttpError('Forbidden', 'http', 403)
      },
      logout: async () => {},
    },
    { getConfig: async () => config },
  )
  await assert.rejects(controller.initialize(), { status: 403 })
  assert.equal(controller.getSnapshot().status, 'unavailable')
})

test('concurrent profile refreshes share one backend request', async (t) => {
  const pending = deferred<UserProfile>()
  const getProfile = t.mock.fn(async () => pending.promise)
  const controller = new AuthController(
    { getProfile, logout: async () => {} },
    { getConfig: async () => config },
  )
  const first = controller.refreshUser()
  const second = controller.refreshUser()
  pending.resolve(profile)
  assert.deepEqual(await first, profile)
  assert.deepEqual(await second, profile)
  assert.equal(getProfile.mock.callCount(), 1)
})

test('successful logout clears the provider user and notifies subscribers', async () => {
  const controller = new AuthController(
    { getProfile: async () => profile, logout: async () => {} },
    { getConfig: async () => config },
  )
  await controller.initialize()
  let userAtNotification: UserProfile | null = profile
  const unsubscribe = controller.subscribe(() => {
    userAtNotification = controller.getSnapshot().user
  })
  await controller.logout()
  assert.equal(controller.getSnapshot().status, 'signed-out')
  assert.equal(userAtNotification, null)
  assert.equal(controller.getSnapshot().signingOut, false)
  unsubscribe()
})

test('failed logout keeps the provider user and exposes an error', async () => {
  const controller = new AuthController(
    {
      getProfile: async () => profile,
      logout: async () => {
        throw new Error('Offline')
      },
    },
    { getConfig: async () => config },
  )
  await controller.initialize()
  await assert.rejects(controller.logout(), /Offline/)
  assert.equal(controller.getSnapshot().status, 'signed-in')
  assert.deepEqual(controller.getSnapshot().user, profile)
  assert.match(controller.getSnapshot().error, /Unable to sign out/)
  assert.equal(controller.getSnapshot().signingOut, false)
})

test('a late profile response cannot restore the provider user after logout', async () => {
  const pending = deferred<UserProfile>()
  const controller = new AuthController(
    { getProfile: async () => pending.promise, logout: async () => {} },
    { getConfig: async () => config },
  )
  const refresh = controller.refreshUser()
  await controller.logout()
  pending.resolve(profile)
  await refresh
  assert.equal(controller.getSnapshot().user, null)
  assert.equal(controller.getSnapshot().status, 'signed-out')
})

test('application startup fetches config once and profile once despite repeated initialization', async (t) => {
  const requests: string[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (input: Parameters<typeof fetch>[0]) => {
      const path = new URL(String(input)).pathname
      requests.push(path)
      return Response.json(path === '/api/config' ? config : profile)
    },
  )
  let configuration!: ConfigService
  const http = new HttpService({
    baseUrl: 'http://localhost:8000',
    getAccessToken: async () => {
      await configuration.getConfig()
      return null
    },
  })
  configuration = new ConfigService(http)
  const controller = new AuthController(new AuthService(http), configuration)
  await Promise.all([controller.initialize(), controller.initialize()])
  assert.deepEqual(requests, ['/api/config', '/api/me/profile'])
  assert.equal(controller.getSnapshot().status, 'signed-in')
})
