import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import authGuard from '../auth-guards/authGuard.ts'
import authService, { type UserProfile } from '../services/authService.ts'

function mockRedirect(t: TestContext) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const replace = t.mock.fn()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { replace } },
  })

  t.after(() => {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow)
    } else {
      Reflect.deleteProperty(globalThis, 'window')
    }
  })

  return replace
}

test('authenticated users are allowed to perform the action', async (t) => {
  t.mock.method(authService, 'isAuthenticated', async () => true)
  const replace = mockRedirect(t)

  const allowed = await authGuard.canActivate(
    new URL('http://localhost/adventure/runs/saved?step=one'),
  )

  assert.equal(allowed, true)
  assert.equal(replace.mock.callCount(), 0)
})

test('unauthenticated users are denied and redirected', async (t) => {
  t.mock.method(authService, 'isAuthenticated', async () => false)
  const replace = mockRedirect(t)

  await assert.rejects(
    authGuard.canActivate(
      new URL('http://localhost/adventure/runs/saved?step=one'),
    ),
    (error) => {
      assert(error instanceof Response)
      assert.equal(error.status, 302)
      assert.equal(
        error.headers.get('Location'),
        '/login?returnTo=%2Fadventure%2Fruns%2Fsaved%3Fstep%3Done',
      )
      return true
    },
  )
  assert.equal(replace.mock.callCount(), 0)
})

test('authentication check failures propagate without redirecting', async (t) => {
  const failure = new Error('Offline')
  t.mock.method(authService, 'isAuthenticated', async () => {
    throw failure
  })
  const replace = mockRedirect(t)

  await assert.rejects(
    authGuard.canActivate(
      new URL('http://localhost/adventure/runs/saved?step=one'),
    ),
    failure,
  )

  assert.equal(replace.mock.callCount(), 0)
})

test('route loader redirects signed-out users before mounting the protected page', async (t) => {
  t.mock.method(authService, 'isAuthenticated', async () => false)
  const replace = mockRedirect(t)
  const request = new Request('http://localhost/adventure/start/bonus/m01-l01')

  await assert.rejects(authGuard.loader({ request }), (error) => {
    assert(error instanceof Response)
    assert.equal(error.status, 302)
    assert.equal(
      error.headers.get('Location'),
      '/login?returnTo=%2Fadventure%2Fstart%2Fbonus%2Fm01-l01',
    )
    return true
  })
  assert.equal(replace.mock.callCount(), 0)
})

test('route loader returns the verified profile and forwards navigation cancellation', async (t) => {
  const profile = { id: 'owner' } as UserProfile
  const check = t.mock.method(authService, 'isAuthenticated', async () => true)
  t.mock.method(authService, 'getUser', () => profile)
  const request = new Request('http://localhost/adventure/runs/saved')

  const result = await authGuard.loader({ request })

  assert.equal(result, profile)
  assert.equal(check.mock.calls[0].arguments[0]?.signal, request.signal)
})

test('route loader propagates verification failures instead of granting access', async (t) => {
  const failure = new Error('Profile service unavailable')
  t.mock.method(authService, 'isAuthenticated', async () => {
    throw failure
  })

  await assert.rejects(
    authGuard.loader({
      request: new Request('http://localhost/adventure/runs/saved'),
    }),
    failure,
  )
})

test('cancelled navigation does not redirect after a late authentication response', async (t) => {
  t.mock.method(authService, 'isAuthenticated', async () => false)
  const replace = mockRedirect(t)
  const controller = new AbortController()
  controller.abort()

  await assert.rejects(
    authGuard.canActivate(
      new URL('http://localhost/adventure'),
      controller.signal,
    ),
    { name: 'AbortError' },
  )

  assert.equal(replace.mock.callCount(), 0)
})
