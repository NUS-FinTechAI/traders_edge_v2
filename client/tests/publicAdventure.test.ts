import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadPublicAdventure } from '../services/adventureService.ts'
import firebaseService from '../services/firebaseService.ts'

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
