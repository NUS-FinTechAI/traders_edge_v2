import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  openLessonSimulation,
  resumeLessonSimulation,
  LessonSimulationCommands,
  parseLessonSimulation,
  type LessonAction,
  getLessonAuditFeedback,
} from '../services/lessonSimulationService.ts'
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
function session(tick = 0) {
  return {
    id: 'session-one',
    mode: 'guided',
    tick,
    finished: false,
    version: 1,
    total_ticks: 30,
    observation_token: 'a'.repeat(64),
    audited_observation: null,
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
    bound_policy: {
      run_id: 'run-one',
      session_id: 'session-one',
      engine_version: 1,
      symbol: 'NORTH',
      side: 'buy',
      order_type: 'limit',
      max_orders: 2,
      max_quantity: 5,
      max_advance: 2,
      min_observe: 10,
      max_tick: 29,
      investment_thesis_supplied: false,
      unit_price_cap: '100.10',
    },
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
    version: 1,
    total_ticks: 30,
    policy: session().bound_policy,
    observationToken: 'a'.repeat(64),
    audited_observation: null,
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

test('resume rejects an order referencing an asset absent from the observed market', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      ...session(),
      orders: [
        {
          id: 'order-1',
          symbol: 'HARBOR',
          quantity: 1,
          filled: 0,
          remaining: 1,
        },
      ],
    }),
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

const plannedOrder: LessonAction = {
  kind: 'order',
  order: {
    symbol: 'NORTH',
    side: 'buy',
    type: 'limit',
    quantity: 3,
    price: '99.00',
    plan: {
      reason: 'Test a bounded order after observing the quote.',
      risk: 'The price may fall or the order may remain unfilled.',
      exit: 'Reconsider after the next two observations.',
      size_reason: 'Keep the example position within the stated limit.',
      max_loss: '20.00',
    },
  },
}

function auditAction(
  observed = session(10),
): Extract<LessonAction, { kind: 'review' }> {
  return {
    kind: 'review',
    audit: {
      tick: observed.tick,
      engine_version: 1,
      observation_token: observed.observation_token,
      orders: [],
      session_fees: '0.00',
      price_limit_guarantees_fill: false,
      no_order_reason: 'no_thesis_supplied',
    },
  }
}
function auditRun(completed = false) {
  return {
    id: 'run-one',
    module_id: 'm05',
    level_id: 'm05-l01',
    purpose: 'practice',
    status: completed ? 'completed' : 'active',
    current_step: completed
      ? null
      : {
          id: 'simulation-one',
          type: 'simulation',
          prompt: 'Inspect the order record',
        },
    progress: { completed_steps: completed ? 4 : 3, total_steps: 4 },
    result: completed
      ? {
          passed: true,
          standard_star: true,
          score_percent: 100,
          xp_awarded: 20,
        }
      : null,
    feedback: [
      {
        step_id: 'simulation-one',
        correct: completed,
        explanation: 'Audit the recorded facts.',
        issues: completed
          ? []
          : [
              {
                code: 'session_fees',
                message: 'Use the total recorded session fees.',
                expected: '0.00',
              },
            ],
      },
    ],
  }
}

test('a lost planned-order response replays its unchanged plan and key after reload', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const requests: { url: string; body: string }[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (input: Parameters<typeof fetch>[0], options?: RequestInit) => {
      if (options?.method === 'POST') {
        requests.push({ url: String(input), body: String(options.body) })
        if (requests.length === 1)
          throw new TypeError('Connection lost after commit')
      }
      return Response.json(session(2))
    },
  )
  const storage = memoryStorage()
  const before = new LessonSimulationCommands('owner', 'run-one', storage)
  await assert.rejects(
    before.submit(parseLessonSimulation(session(), 'run-one'), plannedOrder),
  )

  const after = new LessonSimulationCommands('owner', 'run-one', storage)
  const result = await after.retry()

  assert.equal(requests[0].body, requests[1].body)
  assert(
    requests.every((request) =>
      request.url.endsWith('/api/simulations/session-one/orders/submit'),
    ),
  )
  assert.deepEqual(JSON.parse(requests[1].body).order, plannedOrder.order)
  assert.equal(result.session.tick, 2)
  assert.equal(after.pending(), null)
})

test('advance reads the latest token instead of displaying an old replay receipt', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  let body: unknown
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], options?: RequestInit) => {
      if (options?.method === 'POST') {
        body = JSON.parse(String(options.body))
        return Response.json(session(2))
      }
      return Response.json({ ...session(4), observation_token: 'b'.repeat(64) })
    },
  )
  const commands = new LessonSimulationCommands(
    'owner',
    'run-one',
    memoryStorage(),
  )

  const result = await commands.submit(
    parseLessonSimulation(session(), 'run-one'),
    { kind: 'advance', steps: 2 },
  )

  assert.equal((body as { steps: number }).steps, 2)
  assert.equal(result.session.tick, 4)
  assert.equal(result.session.observationToken, 'b'.repeat(64))
})

test('cancellation uses the recorded order identity and preserves its unfilled remainder', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const cancelled = {
    id: 'order-1',
    symbol: 'NORTH',
    side: 'buy',
    type: 'limit',
    price: '99.00',
    quantity: 3,
    filled: 1,
    remaining: 2,
    status: 'cancelled',
  }
  const paths: string[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (input: Parameters<typeof fetch>[0]) => {
      paths.push(String(input))
      return Response.json({ ...session(5), orders: [cancelled] })
    },
  )
  const commands = new LessonSimulationCommands(
    'owner',
    'run-one',
    memoryStorage(),
  )

  const result = await commands.submit(
    parseLessonSimulation(session(5), 'run-one'),
    { kind: 'cancel', orderId: 'order-1' },
  )

  assert(
    paths[0].endsWith('/api/simulations/session-one/orders/order-1/cancel'),
  )
  assert.deepEqual(result.session.orders, [cancelled])
})

test('audit sends the displayed observation token and preserves specific correction feedback', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  let submitted: unknown
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], options?: RequestInit) => {
      if (options?.method === 'POST') {
        submitted = JSON.parse(String(options.body))
        return Response.json(auditRun())
      }
      return Response.json(session(10))
    },
  )
  const commands = new LessonSimulationCommands(
    'owner',
    'run-one',
    memoryStorage(),
  )
  const action = auditAction()

  const result = await commands.submit(
    parseLessonSimulation(session(10), 'run-one'),
    action,
  )

  assert.deepEqual((submitted as { audit: unknown }).audit, action.audit)
  assert.equal(result.run?.status, 'active')
  assert.equal(result.feedback[0].issues?.[0].code, 'session_fees')
  assert.equal(commands.pending(), null)
})

test('a successful audit returns the completed learning run and finished saved observation', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], options?: RequestInit) =>
      Response.json(
        options?.method === 'POST'
          ? auditRun(true)
          : { ...session(10), finished: true },
      ),
  )
  const commands = new LessonSimulationCommands(
    'owner',
    'run-one',
    memoryStorage(),
  )

  const result = await commands.submit(
    parseLessonSimulation(session(10), 'run-one'),
    auditAction(),
  )

  assert.equal(result.run?.status, 'completed')
  assert.equal(result.run?.result?.standard_star, true)
  assert.equal(result.session.finished, true)
})

test('a stale audit rejection clears its request so current observations can be reviewed with a new key', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const bodies: string[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], options?: RequestInit) => {
      if (options?.method === 'POST') {
        bodies.push(String(options.body))
        if (bodies.length === 1)
          return Response.json(
            { detail: 'The audit is stale' },
            { status: 409 },
          )
        return Response.json(auditRun())
      }
      return Response.json({
        ...session(10),
        observation_token: 'b'.repeat(64),
      })
    },
  )
  const commands = new LessonSimulationCommands(
    'owner',
    'run-one',
    memoryStorage(),
  )
  await assert.rejects(
    commands.submit(
      parseLessonSimulation(session(10), 'run-one'),
      auditAction(),
    ),
    { status: 409 },
  )
  assert.equal(commands.pending(), null)
  const current = { ...session(10), observation_token: 'b'.repeat(64) }

  await commands.submit(
    parseLessonSimulation(current, 'run-one'),
    auditAction(current),
  )

  assert.notEqual(
    JSON.parse(bodies[0]).idempotency_key,
    JSON.parse(bodies[1]).idempotency_key,
  )
  assert.equal(JSON.parse(bodies[1]).audit.observation_token, 'b'.repeat(64))
})

test('a failed fresh read retains a confirmed advance for exact recovery instead of advancing twice', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const posts: string[] = []
  let reads = 0
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], options?: RequestInit) => {
      if (options?.method === 'POST') {
        posts.push(String(options.body))
        return Response.json(session(2))
      }
      if (++reads === 1)
        return Response.json(
          { detail: 'Saved content is temporarily unavailable' },
          { status: 409 },
        )
      return Response.json(session(2))
    },
  )
  const commands = new LessonSimulationCommands(
    'owner',
    'run-one',
    memoryStorage(),
  )
  await assert.rejects(
    commands.submit(parseLessonSimulation(session(), 'run-one'), {
      kind: 'advance',
      steps: 2,
    }),
    { status: 409 },
  )
  assert.equal(commands.pending()?.action.kind, 'advance')

  const result = await commands.retry()

  assert.equal(posts[0], posts[1])
  assert.equal(result.session.tick, 2)
})

test('an unconfirmed command prevents a different mutation until recovery', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Offline')
  })
  const commands = new LessonSimulationCommands(
    'owner',
    'run-one',
    memoryStorage(),
  )
  const observed = parseLessonSimulation(session(), 'run-one')
  await assert.rejects(commands.submit(observed, plannedOrder))

  await assert.rejects(
    commands.submit(observed, { kind: 'advance', steps: 2 }),
    /Confirm the saved simulation command/,
  )

  assert.equal(fetch.mock.callCount(), 1)
})

test('pending simulation commands are isolated by owner and learning run', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Offline')
  })
  const storage = memoryStorage()
  const commands = new LessonSimulationCommands('owner', 'run-one', storage)
  await assert.rejects(
    commands.submit(parseLessonSimulation(session(), 'run-one'), plannedOrder),
  )

  assert.equal(
    new LessonSimulationCommands('another-owner', 'run-one', storage).pending(),
    null,
  )
  assert.equal(
    new LessonSimulationCommands('owner', 'another-run', storage).pending(),
    null,
  )
  assert.equal(commands.pending()?.action.kind, 'order')
})

test('unavailable command storage prevents a new simulation mutation', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch')
  const commands = new LessonSimulationCommands('owner', 'run-one', {
    getItem: () => null,
    setItem: () => {
      throw new Error('Storage unavailable')
    },
    removeItem: () => {},
  })

  await assert.rejects(
    commands.submit(parseLessonSimulation(session(), 'run-one'), {
      kind: 'advance',
      steps: 1,
    }),
    /Storage unavailable/,
  )

  assert.equal(fetch.mock.callCount(), 0)
})

test('a session without a valid observation token cannot be used for an audit', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ ...session(), observation_token: null }),
  )

  await assert.rejects(resumeLessonSimulation('run-one'), {
    kind: 'invalid-response',
  })
})

test('reloading audit feedback preserves the prior observed tick and specific corrections', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const saved = {
    ...auditRun().feedback[0],
    observation_phase: 'before_finish_cancellation',
    audited_observation: { tick: 10 },
  }
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ ...auditRun(), feedback: [saved] }),
  )

  const feedback = await getLessonAuditFeedback('run-one')

  assert.deepEqual(feedback, [saved])
  assert.equal(feedback[0].issues?.[0].code, 'session_fees')
})
