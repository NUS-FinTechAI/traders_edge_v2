import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  PlayerCommands as Commands,
  loadPlayer,
} from '../services/playerService.ts'
import firebaseService from '../services/firebaseService.ts'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
}

function createCommands(
  owner: string,
  storage: ReturnType<typeof memoryStorage>,
) {
  return new Commands(owner, storage, undefined, () => owner)
}

const wallet = { policy_version: '1', stocks_balance: 20, premium_balance: 100 }
const item = {
  id: 'avatar-market-observer',
  shop_id: 'avatar-market-observer',
  status: 'owned',
}

test('another tab cannot replace an in-flight player command after its response is lost', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  let entered!: () => void
  const started = new Promise<void>((resolve) => {
    entered = resolve
  })
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const request = t.mock.method(globalThis, 'fetch', async () => {
    entered()
    await gate
    throw new TypeError('Response lost after commit')
  })
  const storage = memoryStorage()
  const first = createCommands('owner', storage)
  const second = createCommands('owner', storage)
  const sending = assert.rejects(
    first.submit({ kind: 'purchase', itemId: item.shop_id }),
  )
  await started
  const original = first.pending()
  const overlapping = assert.rejects(
    second.submit({ kind: 'login' }),
    /Confirm the saved player action/,
  )

  release()
  await Promise.all([sending, overlapping])

  assert.equal(request.mock.callCount(), 1)
  assert.deepEqual(first.pending(), original)
})

test('a browser without cross-tab locks sends no player command', async (t) => {
  t.mock.getter(navigator, 'locks', () => undefined)
  const request = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Unexpected request')
  })
  const commands = createCommands('owner', memoryStorage())

  await assert.rejects(commands.submit({ kind: 'login' }), /Web Locks support/)

  assert.equal(commands.pending(), null)
  assert.equal(request.mock.callCount(), 0)
})

test('a lost purchase response preserves its exact item and command key across reload', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const requests: string[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], options?: RequestInit) => {
      requests.push(String(options?.body))
      if (requests.length === 1)
        throw new TypeError('Response lost after commit')
      return Response.json({ item, wallet, spent: { premium: 100 } })
    },
  )
  const storage = memoryStorage()
  await assert.rejects(
    createCommands('owner', storage).submit({
      kind: 'purchase',
      itemId: item.shop_id,
    }),
  )

  const reloaded = createCommands('owner', storage)
  await reloaded.retry()

  assert.equal(requests[0], requests[1])
  assert.equal(reloaded.pending(), null)
})

test('an uncertain player command blocks another purchase before fetching', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const request = t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Offline')
  })
  const commands = createCommands('owner', memoryStorage())
  await assert.rejects(commands.submit({ kind: 'login' }))

  await assert.rejects(
    commands.submit({ kind: 'purchase', itemId: 'other-item' }),
    /Confirm the saved player action/,
  )

  assert.equal(request.mock.callCount(), 1)
})

test('equipment changes send only the chosen slot and preserve explicit unequip', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const request = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ equipment: { avatar_id: null, title_id: 'kept-title' } }),
  )

  await createCommands('owner', memoryStorage()).submit({
    kind: 'equip',
    slot: 'avatar_id',
    itemId: null,
  })

  assert.equal(request.mock.calls[0].arguments[1]?.method, 'PATCH')
  const body = JSON.parse(String(request.mock.calls[0].arguments[1]?.body))
  assert.equal(body.avatar_id, null)
  assert.equal('title_id' in body, false)
})

test('a response for another reward retains the original claim for recovery', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ item: { id: 'different-item', status: 'owned' } }),
  )
  const commands = createCommands('owner', memoryStorage())

  await assert.rejects(
    commands.submit({ kind: 'claim', itemId: 'badge-first-lesson' }),
    { kind: 'invalid-response' },
  )

  assert.deepEqual(commands.pending()?.action, {
    kind: 'claim',
    itemId: 'badge-first-lesson',
  })
})

test('a rejected purchase clears its command so the player can choose again', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ detail: 'Insufficient premium currency' }, { status: 409 }),
  )
  const commands = createCommands('owner', memoryStorage())

  await assert.rejects(
    commands.submit({ kind: 'purchase', itemId: item.shop_id }),
    { status: 409 },
  )

  assert.equal(commands.pending(), null)
})

test('unavailable browser storage prevents a player mutation', async (t) => {
  const request = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({}),
  )
  const storage = {
    ...memoryStorage(),
    setItem() {
      throw new Error('Storage unavailable')
    },
  }

  await assert.rejects(
    createCommands('owner', storage).submit({ kind: 'login' }),
    /Storage unavailable/,
  )

  assert.equal(request.mock.callCount(), 0)
})

test('pending player actions stay with their signed-in owner', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Offline')
  })
  const storage = memoryStorage()
  const first = createCommands('first', storage)
  await assert.rejects(first.submit({ kind: 'refresh' }))

  const second = createCommands('second', storage)

  assert.equal(second.pending(), null)
  assert.equal(first.pending()?.action.kind, 'refresh')
})

test('a failed review read does not hide a successfully loaded wallet and collection', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(
    globalThis,
    'fetch',
    async (input: Parameters<typeof fetch>[0]) => {
      if (String(input).endsWith('/reviews'))
        return Response.json(
          { detail: 'Content awaiting review' },
          { status: 503 },
        )
      if (String(input).endsWith('/economy')) return Response.json(wallet)
      return Response.json({ items: [] })
    },
  )

  const data = await loadPlayer()

  assert.equal(data.wallet.status, 'ready')
  assert.equal(data.inventory.status, 'ready')
  assert.equal(data.reviews.status, 'error')
})

test('a malformed saved purchase is retained and sends no request', async (t) => {
  const request = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({}),
  )
  const storage = memoryStorage()
  storage.setItem(
    'player-command:v1:owner',
    JSON.stringify({
      owner: 'owner',
      key: 'saved-command',
      action: { kind: 'purchase' },
    }),
  )

  await assert.rejects(
    createCommands('owner', storage).retry(),
    /saved player action cannot be read/,
  )

  assert.equal(request.mock.callCount(), 0)
  assert.notEqual(storage.getItem('player-command:v1:owner'), null)
})

test('an account change during a purchase retains the original owner’s command and blocks retry', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  let currentOwner: string | null = 'first'
  const request = t.mock.method(globalThis, 'fetch', async () => {
    currentOwner = 'second'
    return Response.json({ item, wallet, spent: { premium: 100 } })
  })
  const commands = new Commands(
    'first',
    memoryStorage(),
    undefined,
    () => currentOwner,
  )

  await assert.rejects(
    commands.submit({ kind: 'purchase', itemId: item.shop_id }),
    /signed-in player changed/,
  )
  await assert.rejects(commands.retry(), /signed-in player changed/)

  assert.equal(request.mock.callCount(), 1)
  assert.deepEqual(commands.pending()?.action, {
    kind: 'purchase',
    itemId: item.shop_id,
  })
})

test('a different authenticated player cannot send an old owner’s pending request', async (t) => {
  const request = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({}),
  )
  const storage = memoryStorage()
  storage.setItem(
    'player-command:v1:first',
    JSON.stringify({
      owner: 'first',
      key: 'saved-command',
      action: { kind: 'login' },
    }),
  )

  await assert.rejects(
    new Commands('first', storage, undefined, () => 'second').retry(),
    /signed-in player changed/,
  )

  assert.equal(request.mock.callCount(), 0)
  assert.notEqual(storage.getItem('player-command:v1:first'), null)
})

test('an account change while player sections load rejects the data before it is returned', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  let currentOwner: string | null = 'first'
  t.mock.method(globalThis, 'fetch', async () => {
    currentOwner = 'second'
    return Response.json({ ...wallet, items: [], reviews: [] })
  })

  await assert.rejects(
    loadPlayer(undefined, undefined, {
      id: 'first',
      getOwnerId: () => currentOwner,
    }),
    /signed-in player changed/,
  )
})
