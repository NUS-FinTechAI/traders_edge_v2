import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  FirebaseService,
  type FirebaseSession,
} from '../services/firebaseService.ts'
import { HttpService } from '../services/httpService.ts'

const firebaseConfig = {
  auth: { mode: 'firebase' as const, firebase_project_id: 'academy' },
}
const webConfig = {
  apiKey: 'public-key',
  authDomain: 'academy.firebaseapp.com',
  appId: 'app-id',
}

function session(): FirebaseSession {
  return {
    getAccessToken: async () => 'id-token',
    signInWithGoogle: async () => {},
    signInWithEmail: async () => {},
    createAccount: async () => {},
    signOut: async () => {},
  }
}

test('guest mode returns no token without initializing Firebase', async (t) => {
  const factory = t.mock.fn(async () => session())
  const service = new FirebaseService(
    async () => ({ auth: { mode: 'guest', firebase_project_id: null } }),
    {},
    factory,
  )
  assert.equal(await service.getAccessToken(), null)
  assert.equal(factory.mock.callCount(), 0)
})

test('guest mode rejects account creation without initializing Firebase', async (t) => {
  const factory = t.mock.fn(async () => session())
  const service = new FirebaseService(
    async () => ({ auth: { mode: 'guest', firebase_project_id: null } }),
    {},
    factory,
  )
  await assert.rejects(
    service.createAccount('a@example.com', 'password'),
    /unavailable in guest mode/,
  )
  assert.equal(factory.mock.callCount(), 0)
})

test('Firebase initialization uses the backend project and is reused', async (t) => {
  const factory = t.mock.fn(
    async (_config: typeof webConfig & { projectId: string }) => session(),
  )
  const service = new FirebaseService(
    async () => firebaseConfig,
    webConfig,
    factory,
  )
  await Promise.all([service.getAccessToken(), service.getAccessToken()])
  assert.equal(factory.mock.callCount(), 1)
  assert.deepEqual(factory.mock.calls[0]?.arguments[0], {
    ...webConfig,
    projectId: 'academy',
  })
})

test('missing web configuration rejects initialization', async (t) => {
  const factory = t.mock.fn(async () => session())
  const service = new FirebaseService(async () => firebaseConfig, {}, factory)
  await assert.rejects(service.getAccessToken(), /not been configured/)
  assert.equal(factory.mock.callCount(), 0)
})

test('failed initialization can be retried', async (t) => {
  const factory = t.mock.fn(async (): Promise<FirebaseSession> => {
    throw new Error('Initialization failed')
  })
  const service = new FirebaseService(
    async () => firebaseConfig,
    webConfig,
    factory,
  )
  await assert.rejects(service.getAccessToken(), /Initialization failed/)
  factory.mock.mockImplementation(async () => session())
  assert.equal(await service.getAccessToken(), 'id-token')
})

test('email sign-in trims the email and preserves the password', async (t) => {
  const identity = session()
  const signIn = t.mock.method(identity, 'signInWithEmail')
  const service = new FirebaseService(
    async () => firebaseConfig,
    webConfig,
    async () => identity,
  )
  await service.signInWithEmail(' a@example.com ', ' password ')
  assert.deepEqual(signIn.mock.calls[0]?.arguments, [
    'a@example.com',
    ' password ',
  ])
})

test('account creation delegates to Firebase', async (t) => {
  const identity = session()
  const create = t.mock.method(identity, 'createAccount')
  const service = new FirebaseService(
    async () => firebaseConfig,
    webConfig,
    async () => identity,
  )
  await service.createAccount('a@example.com', 'password')
  assert.deepEqual(create.mock.calls[0]?.arguments, [
    'a@example.com',
    'password',
  ])
})

test('Google sign-in propagates cancellation', async () => {
  const identity = session()
  const error = new Error('Popup cancelled')
  identity.signInWithGoogle = async () => {
    throw error
  }
  const service = new FirebaseService(
    async () => firebaseConfig,
    webConfig,
    async () => identity,
  )
  await assert.rejects(service.signInWithGoogle(), (actual) => actual === error)
})

test('sign-out delegates to Firebase', async (t) => {
  const identity = session()
  const signOut = t.mock.method(identity, 'signOut')
  const service = new FirebaseService(
    async () => firebaseConfig,
    webConfig,
    async () => identity,
  )
  await service.signOut()
  assert.equal(signOut.mock.callCount(), 1)
})

test('protected HTTP calls attach Firebase tokens and public calls skip tokens', async (t) => {
  const service = new FirebaseService(
    async () => firebaseConfig,
    webConfig,
    async () => session(),
  )
  const getAccessToken = t.mock.fn(() => service.getAccessToken())
  const http = new HttpService({
    baseUrl: 'http://localhost:8000',
    getAccessToken,
  })
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({}),
  )
  await http.request('/api/me/profile')
  await http.request('/api/config', { auth: 'none' })
  assert.equal(
    new Headers(fetchMock.mock.calls[0]?.arguments[1]?.headers).get(
      'Authorization',
    ),
    'Bearer id-token',
  )
  assert.equal(
    new Headers(fetchMock.mock.calls[1]?.arguments[1]?.headers).has(
      'Authorization',
    ),
    false,
  )
  assert.equal(getAccessToken.mock.callCount(), 1)
})
