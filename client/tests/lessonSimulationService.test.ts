import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  openLessonSimulation,
  resumeLessonSimulation,
} from '../services/lessonSimulationService.ts'
import firebaseService from '../services/firebaseService.ts'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}
function session(tick = 0) {
  return {
    id: 'session-one',
    mode: 'guided',
    tick,
    finished: false,
    cash: '10000.00',
    available_cash: '10000.00',
    equity: '10000.00',
    fees: '0.00',
    quotes: [
      {
        symbol: 'NORTH',
        bid: '99.90',
        ask: '100.10',
        mid: '100.00',
        available_units: 5,
      },
    ],
    history: { NORTH: Array.from({ length: tick + 1 }, () => '100.00') },
    positions: [],
    orders: [],
    bound_policy: { run_id: 'run-one', session_id: 'session-one' },
  }
}

test('opening a lesson binds its run and reads the latest saved observation', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const requests: { url: string; method: string | undefined }[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      requests.push({ url: String(input), method: init?.method })
      return Response.json(session(init?.method === 'POST' ? 0 : 7))
    },
  )

  const result = await openLessonSimulation('owner', 'run-one', memoryStorage())

  assert.deepEqual(result, {
    id: 'session-one',
    runId: 'run-one',
    tick: 7,
    finished: false,
    cash: '10000.00',
    available_cash: '10000.00',
    equity: '10000.00',
    fees: '0.00',
    quotes: [
      {
        symbol: 'NORTH',
        bid: '99.90',
        ask: '100.10',
        mid: '100.00',
        available_units: 5,
      },
    ],
    history: Object.assign(Object.create(null), {
      NORTH: Array.from({ length: 8 }, () => '100.00'),
    }),
    positions: [],
    orders: [],
  })
  assert.deepEqual(
    requests.map((item) => item.method),
    ['POST', 'GET'],
  )
  assert(
    requests.every((item) =>
      item.url.endsWith('/api/learning-runs/run-one/simulation'),
    ),
  )
})

test('lost binding response reuses the same command after reload', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const bodies: string[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (init?.method === 'POST') {
        bodies.push(String(init.body))
        if (bodies.length === 1)
          throw new TypeError('Response lost after commit')
      }
      return Response.json(session(4))
    },
  )
  const storage = memoryStorage()
  await assert.rejects(openLessonSimulation('owner', 'run-one', storage))

  const resumed = await openLessonSimulation('owner', 'run-one', storage)

  assert.equal(bodies[0], bodies[1])
  assert.equal(resumed.id, 'session-one')
  assert.equal(resumed.runId, 'run-one')
})

test('failed fresh read retains the binding key for a subsequent retry', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const bodies: string[] = []
  let reads = 0
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (init?.method === 'POST') bodies.push(String(init.body))
      else if (++reads === 1) throw new TypeError('Offline')
      return Response.json(session(8))
    },
  )
  const storage = memoryStorage()
  await assert.rejects(openLessonSimulation('owner', 'run-one', storage))

  const result = await openLessonSimulation('owner', 'run-one', storage)

  assert.equal(result.tick, 8)
  assert.equal(bodies[0], bodies[1])
})

test('binding commands are isolated between authenticated owners', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const bodies: string[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (init?.method === 'POST') bodies.push(String(init.body))
      return Response.json(session())
    },
  )
  const storage = memoryStorage()

  await openLessonSimulation('owner-one', 'run-one', storage)
  await openLessonSimulation('owner-two', 'run-one', storage)

  assert.notEqual(bodies[0], bodies[1])
})

test('unavailable storage prevents the binding mutation', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch')
  const storage = {
    getItem: () => null,
    setItem: () => {
      throw new Error('Storage unavailable')
    },
  }

  await assert.rejects(
    openLessonSimulation('owner', 'run-one', storage),
    /Storage unavailable/,
  )

  assert.equal(fetch.mock.callCount(), 0)
})

test('resume rejects a session bound to another run', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(globalThis, 'fetch', async () => Response.json(session()))

  await assert.rejects(resumeLessonSimulation('another-run'), {
    kind: 'invalid-response',
  })
})

test('opening rejects a changed session identity in the fresh read', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], init?: RequestInit) =>
      Response.json(
        init?.method === 'POST'
          ? session()
          : {
              ...session(),
              id: 'session-two',
              bound_policy: { run_id: 'run-one', session_id: 'session-two' },
            },
      ),
  )

  await assert.rejects(
    openLessonSimulation('owner', 'run-one', memoryStorage()),
    { kind: 'invalid-response' },
  )
})

test('a denied binding is not followed by a resume request', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ detail: 'Prerequisites incomplete' }, { status: 403 }),
  )

  await assert.rejects(
    openLessonSimulation('owner', 'run-one', memoryStorage()),
    { status: 403 },
  )

  assert.equal(fetch.mock.callCount(), 1)
})

test('cancelled opening does not write storage or send a request', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch')
  const storage = memoryStorage()
  const write = t.mock.method(storage, 'setItem')
  const controller = new AbortController()
  controller.abort()

  await assert.rejects(
    openLessonSimulation('owner', 'run-one', storage, controller.signal),
    { name: 'AbortError' },
  )

  assert.equal(write.mock.callCount(), 0)
  assert.equal(fetch.mock.callCount(), 0)
})

test('resume rejects history containing observations beyond the current tick', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ ...session(), history: { NORTH: ['100.00', '101.00'] } }),
  )

  await assert.rejects(resumeLessonSimulation('run-one'), {
    kind: 'invalid-response',
  })
})

test('resume rejects missing balances rather than displaying a fabricated zero', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ ...session(), available_cash: null }),
  )

  await assert.rejects(resumeLessonSimulation('run-one'), {
    kind: 'invalid-response',
  })
})

test('resume preserves unfilled quantity on a cancelled order', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const cancelled = {
    id: 'order-1',
    symbol: 'NORTH',
    side: 'buy',
    type: 'limit',
    status: 'cancelled',
    quantity: 5,
    filled: 2,
    remaining: 3,
    price: '100.10',
  }
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ ...session(), orders: [cancelled] }),
  )

  const result = await resumeLessonSimulation('run-one')

  assert.deepEqual(result.orders, [cancelled])
})

test('resume rejects inconsistent filled and remaining quantities', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      ...session(),
      orders: [
        {
          id: 'order-1',
          symbol: 'NORTH',
          side: 'buy',
          type: 'limit',
          status: 'partial',
          quantity: 5,
          filled: 2,
          remaining: 5,
          price: '100.10',
        },
      ],
    }),
  )

  await assert.rejects(resumeLessonSimulation('run-one'), {
    kind: 'invalid-response',
  })
})
