import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadPublicAdventure } from '../services/adventureService.ts'
import firebaseService from '../services/firebaseService.ts'
import { loginDestination } from '../services/loginDestination.ts'

test('public adventure loads without requesting an identity token', async (t) => {
  const token = t.mock.method(firebaseService, 'getAccessToken', async () => {
    throw new Error('No identity')
  })
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ chapters: [] }),
  )

  const result = await loadPublicAdventure(new AbortController().signal)

  assert.deepEqual(result, { chapters: [] })
  assert.equal(token.mock.callCount(), 0)
  assert.match(
    String(fetch.mock.calls[0].arguments[0]),
    /\/api\/adventure\/catalog$/,
  )
})

test('sign-in return preserves the selected adventure level', () => {
  assert.equal(
    loginDestination('/adventure/chapters/m01?stop=m01-l01'),
    '/adventure/chapters/m01?stop=m01-l01',
  )
})

for (const destination of [
  'https://example.com',
  '//example.com',
  '/\\example.com',
  '/adventure/../login',
  '/login',
  null,
]) {
  test(`sign-in return rejects unsupported destination ${destination}`, () => {
    assert.equal(loginDestination(destination), '/')
  })
}
