import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import authGuard from '../auth-guards/authGuard.ts'
import authService from '../services/authService.ts'

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

  const allowed = await authGuard.canActivate()

  assert.equal(allowed, true)
  assert.equal(replace.mock.callCount(), 0)
})

test('unauthenticated users are denied and redirected', async (t) => {
  t.mock.method(authService, 'isAuthenticated', async () => false)
  const replace = mockRedirect(t)

  const allowed = await authGuard.canActivate()

  assert.equal(allowed, false)
  assert.equal(replace.mock.callCount(), 1)
  assert.deepEqual(replace.mock.calls[0].arguments, ['/'])
})

test('authentication check failures propagate without redirecting', async (t) => {
  const failure = new Error('Offline')
  t.mock.method(authService, 'isAuthenticated', async () => {
    throw failure
  })
  const replace = mockRedirect(t)

  await assert.rejects(authGuard.canActivate(), failure)

  assert.equal(replace.mock.callCount(), 0)
})
