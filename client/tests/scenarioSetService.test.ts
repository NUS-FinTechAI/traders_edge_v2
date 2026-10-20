import assert from 'node:assert/strict'
import { test } from 'node:test'
import firebaseService from '../services/firebaseService.ts'
import { getLearningRun } from '../services/learningRunService.ts'
import {
  parseScenarioSet,
  readScenarioSet,
  ScenarioSetCommands,
  type ScenarioAudit,
  type ScenarioOrder,
  type ScenarioSession,
} from '../services/scenarioSetService.ts'

const owner = 'owner'
const runId = 'run-one'
const token = 'a'.repeat(64)
const symbols = ['NORTH', 'HARBOR', 'PLAIN', 'COVE']
const plan = {
  reason: 'An observed case comparison.',
  risk: 'The price could move lower.',
  exit: 'Reconsider after observation.',
  size_reason: 'One unit respects the bound.',
  max_loss: '20.00',
}
const order: ScenarioOrder = {
  symbol: 'NORTH',
  side: 'buy',
  type: 'limit',
  quantity: 1,
  price: '99.00',
  plan,
}
function storage() {
  const entries = new Map<string, string>()
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value)
    },
    removeItem: (key: string) => {
      entries.delete(key)
    },
  }
}
function raw(tick = 0, completed = 0, bound = true) {
  const caseId = completed < 4 ? 'path-' + (completed + 1) : null
  const policy = {
    id: 'm09-l03-four-path-review-v1',
    engine_version: 1,
    provenance: 'Controlled synthetic cases.',
    brief: 'No investment thesis supplied.',
    grade_basis: 'Observed records, not profit.',
    total_cases: 4,
    total_ticks: 20,
    max_advance: 5,
    max_order_quantity: 5,
    max_asset_units: 10,
    max_orders: 8,
    max_planned_loss: '100.00',
    investment_thesis_supplied: false,
  }
  const done = Array.from({ length: completed }, (_, index) => ({
    case_id: 'path-' + (index + 1),
    session_id: 'session-' + (index + 1),
    generator_profile: ['rising', 'falling', 'sideways', 'volatile'][index],
    cash: '10000.00',
    equity: '10000.00',
    fees: '0.00',
    benchmark_value: '10000.00',
    max_drawdown_percent: '0.00',
    audit: audit('path-' + (index + 1)),
  }))
  return {
    run: {
      id: runId,
      purpose: 'practice',
      module_id: 'm09-integrated-simulation',
      level_id: 'm09-l03',
      content_version: 'edition-one',
      status: completed === 4 ? 'completed' : 'active',
      current_step:
        completed === 4
          ? null
          : {
              id: 'm09-l03-simulation',
              type: 'simulation',
              prompt: 'Audit all four paths.',
            },
      progress: { completed_steps: completed === 4 ? 3 : 2, total_steps: 3 },
      feedback: [],
      result:
        completed === 4
          ? {
              passed: true,
              score_percent: 100,
              standard_star: true,
              bonus_star: false,
              xp_awarded: 90,
            }
          : null,
      scenario_set: {
        url: '/api/learning-runs/' + runId + '/scenario-set',
        binding_id: policy.id,
        current_case_id: caseId,
        completed_case_ids: done.map((item) => item.case_id),
        total_cases: 4,
      },
    },
    policy,
    current_case_id: caseId,
    session:
      bound && caseId
        ? {
            id: 'session-' + (completed + 1),
            mode: 'guided',
            updated_at: null,
            version: 1,
            tick,
            total_ticks: 20,
            scenario: 'Controlled synthetic practice',
            finished: false,
            cash: '10000.00',
            available_cash: '10000.00',
            equity: '10000.00',
            fees: '0.00',
            positions: [],
            orders: [],
            fills: [],
            quotes: symbols.map((symbol) => ({
              symbol,
              mid: '100.00',
              bid: '99.90',
              ask: '100.10',
              available_units: 5,
            })),
            history: Object.fromEntries(
              symbols.map((symbol) => [symbol, Array(tick + 1).fill('100.00')]),
            ),
            benchmark_value: '10000.00',
            max_drawdown_percent: '0.00',
            reflection: null,
            rules: {
              max_asset_weight_percent: 25,
              shorting: false,
              leverage: 1,
              fee_rate: '0.001',
              first_fill_fee: '1.00',
              spread_percent: '0.2',
              settlement: 'Immediate synthetic settlement.',
              benchmark: 'Gross equal-value basket, excluding fees.',
            },
            scenario_set_policy: {
              ...policy,
              run_id: runId,
              case_id: caseId,
              session_id: 'session-' + (completed + 1),
              content_version: 'edition-one',
              rubric_version: 'interactive-3',
            },
            observation_token: token,
            audited_observation: null,
          }
        : null,
    completed_cases: done,
    issues: [] as { code: string; message: string }[],
  }
}
function audit(caseId = 'path-1'): ScenarioAudit {
  return {
    case_id: caseId,
    tick: 19,
    engine_version: 1,
    observation_token: token,
    orders: [],
    positions: [],
    cash: '10000.00',
    session_fees: '0.00',
    benchmark_value: '10000.00',
    benchmark_is_gross: true,
    profit_proves_process: false,
    planned_loss_is_guaranteed: false,
    no_order_reason: 'no_thesis_supplied',
  }
}
function commands(journal = storage(), getOwner = () => owner) {
  return new ScenarioSetCommands(owner, runId, journal, getOwner)
}

test('loading a Module 9 simulation preserves the four-path link for lesson dispatch', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(globalThis, 'fetch', async () => Response.json(raw().run))

  const run = await getLearningRun(runId)

  assert.equal(run.current_step?.type, 'simulation')
  assert.equal(run.scenario_set?.binding_id, 'm09-l03-four-path-review-v1')
  assert.equal(run.scenario_set?.total_cases, 4)
})

test('opening a four-path lesson reads saved state without binding any new path', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const requests: RequestInit[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      requests.push(init ?? {})
      return Response.json(raw(0, 0, false))
    },
  )
  const current = await readScenarioSet(owner, runId, undefined, () => owner)
  assert.equal(current.session, null)
  assert.deepEqual(
    requests.map((request) => request.method),
    ['GET'],
  )
})

test('a lost advance response replays the original owner run case and exact key after reload', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const posts: string[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(String(init.body))
        if (posts.length === 1) throw TypeError('Lost response')
        return Response.json(raw(5).session)
      }
      return Response.json(raw(5))
    },
  )
  const journal = storage()
  await assert.rejects(
    commands(journal).submit(parseScenarioSet(raw(), runId), {
      kind: 'advance',
      steps: 5,
    }),
  )
  const restored = commands(journal)
  assert.equal(restored.pending()?.caseId, 'path-1')
  const current = await restored.retry()
  assert.equal(current.session?.tick, 5)
  assert.equal(posts[0], posts[1])
  assert.equal(restored.pending(), null)
})

test('an old bind receipt is followed by current progress without silently starting the next path', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const methods: string[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      methods.push(init?.method ?? 'GET')
      return Response.json(init?.method === 'POST' ? raw() : raw(0, 1, false))
    },
  )
  const current = await commands().submit(
    parseScenarioSet(raw(0, 0, false), runId),
    { kind: 'bind' },
  )
  assert.equal(current.current_case_id, 'path-2')
  assert.equal(current.session, null)
  assert.deepEqual(methods, ['POST', 'GET'])
})

test('retrying an uncommitted bind preserves its original case after another tab progresses', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const posts: { case_id: string; idempotency_key: string }[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(JSON.parse(String(init.body)))
        if (posts.length === 1) throw new TypeError('Not confirmed')
        if (posts.length === 2)
          return Response.json(
            { detail: 'Bind only the current path' },
            { status: 409 },
          )
        return Response.json(raw(0, 1))
      }
      return Response.json(raw(0, 1, posts.length === 3))
    },
  )
  const client = commands()
  await assert.rejects(
    client.submit(parseScenarioSet(raw(0, 0, false), runId), { kind: 'bind' }),
  )
  const progressed = await readScenarioSet(owner, runId, undefined, () => owner)

  await assert.rejects(client.retry(), { status: 409 })
  assert.deepEqual(posts[0], posts[1])
  assert.equal(posts[1].case_id, 'path-1')
  await client.submit(progressed, { kind: 'bind' })

  assert.equal(posts[2].case_id, 'path-2')
  assert.notEqual(posts[2].idempotency_key, posts[1].idempotency_key)
})

test('a confirmed mutation followed by a failed current read remains recoverable with the same command', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const posts: string[] = []
  let reads = 0
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(String(init.body))
        return Response.json(raw(1).session)
      }
      if (++reads === 1)
        return Response.json(
          { detail: 'Current read unavailable' },
          { status: 409 },
        )
      return Response.json(raw(1))
    },
  )
  const client = commands()
  await assert.rejects(
    client.submit(parseScenarioSet(raw(), runId), {
      kind: 'advance',
      steps: 1,
    }),
    { status: 409 },
  )
  assert.equal(client.pending()?.action.kind, 'advance')
  await client.retry()
  assert.equal(posts[0], posts[1])
  assert.equal(client.pending(), null)
})

test('a wrong audit returns specific feedback while keeping the same path open for correction', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const wrong = raw(19)
  wrong.issues = [{ code: 'cash', message: 'Use the recorded cash.' }]
  t.mock.method(globalThis, 'fetch', async () => Response.json(wrong))
  const client = commands()
  const current = await client.submit(parseScenarioSet(raw(19), runId), {
    kind: 'review',
    audit: { ...audit(), cash: '9000.00' },
  })
  assert.equal(current.current_case_id, 'path-1')
  assert.equal(current.run.status, 'active')
  assert.equal(current.issues[0].code, 'cash')
  assert.equal(current.completed_cases.length, 0)
  assert.equal(client.pending(), null)
})

test('the fourth server-confirmed audit alone returns the completed normal-star result', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json(raw(0, 4, false)),
  )
  const result = await commands().submit(parseScenarioSet(raw(19, 3), runId), {
    kind: 'review',
    audit: audit('path-4'),
  })
  assert.equal(result.completed_cases.length, 4)
  assert.equal(result.run.status, 'completed')
  assert.equal(result.run.result?.standard_star, true)
  assert.equal(result.run.result?.xp_awarded, 90)
  assert.equal(result.session, null)
})

test('a lost fourth-audit response remains explicitly confirmable after reading the completed lesson', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const posts: string[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(String(init.body))
        if (posts.length === 1) throw new TypeError('Final response lost')
      }
      return Response.json(raw(0, 4, false))
    },
  )
  const journal = storage()
  await assert.rejects(
    commands(journal).submit(parseScenarioSet(raw(19, 3), runId), {
      kind: 'review',
      audit: audit('path-4'),
    }),
  )

  const completed = await readScenarioSet(owner, runId, undefined, () => owner)
  const restored = commands(journal)
  assert.equal(completed.run.status, 'completed')
  assert.equal(restored.pending()?.caseId, 'path-4')
  const confirmed = await restored.retry()

  assert.equal(confirmed.run.result?.standard_star, true)
  assert.equal(posts[0], posts[1])
  assert.equal(restored.pending(), null)
})

test('an unconfirmed action blocks a different action before sending another request', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw TypeError('Offline')
  })
  const client = commands(),
    current = parseScenarioSet(raw(), runId)
  await assert.rejects(client.submit(current, { kind: 'advance', steps: 1 }))
  await assert.rejects(
    client.submit(current, { kind: 'order', order }),
    /Confirm the saved/,
  )
  assert.equal(fetch.mock.callCount(), 1)
})

test('a stale audit rejection releases its key and a corrected retry uses the freshly read observation', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const updated = raw(19)
  updated.session!.observation_token = 'b'.repeat(64)
  const posts: Record<string, unknown>[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(JSON.parse(String(init.body)))
        if (posts.length === 1)
          return Response.json(
            { detail: 'The audit is stale' },
            { status: 409 },
          )
        return Response.json(raw(0, 1, false))
      }
      return Response.json(posts.length === 1 ? updated : raw(0, 1, false))
    },
  )
  const client = commands()
  await assert.rejects(
    client.submit(parseScenarioSet(raw(19), runId), {
      kind: 'review',
      audit: audit(),
    }),
    { status: 409 },
  )
  assert.equal(client.pending(), null)
  const current = await readScenarioSet(owner, runId, undefined, () => owner)
  await client.submit(current, {
    kind: 'review',
    audit: {
      ...audit(),
      observation_token: current.session!.observation_token,
    },
  })
  assert.notEqual(posts[0].idempotency_key, posts[1].idempotency_key)
  assert.equal(
    (posts[1].audit as ScenarioAudit).observation_token,
    'b'.repeat(64),
  )
})

test('a same-tick changed observation token prevents submitting an old local audit', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch')
  const updated = raw(19)
  updated.session!.observation_token = 'b'.repeat(64)
  const client = commands()
  await assert.rejects(
    client.submit(parseScenarioSet(updated, runId), {
      kind: 'review',
      audit: audit(),
    }),
    /current observation/,
  )
  assert.equal(fetch.mock.callCount(), 0)
  assert.equal(client.pending(), null)
})

test('an order exceeding the five-unit case limit sends no request', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch')
  await assert.rejects(
    commands().submit(parseScenarioSet(raw(), runId), {
      kind: 'order',
      order: { ...order, quantity: 6 },
    }),
    /valid action/,
  )
  assert.equal(fetch.mock.callCount(), 0)
})

test('an order exceeding the declared loss ceiling sends no request', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch')
  await assert.rejects(
    commands().submit(parseScenarioSet(raw(), runId), {
      kind: 'order',
      order: { ...order, plan: { ...plan, max_loss: '100.01' } },
    }),
    /valid action/,
  )
  assert.equal(fetch.mock.callCount(), 0)
})

test('held units and pending buys together enforce the ten-unit asset ceiling', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch')
  const data = raw()
  const current = parseScenarioSet(data, runId)
  current.session!.positions = [
    {
      symbol: 'NORTH',
      quantity: 10,
      cost: '1000.00',
      value: '1000.00',
      realized: '0.00',
      weight_percent: '10.00',
    },
  ]
  await assert.rejects(
    commands().submit(current, { kind: 'order', order }),
    /ten held units/,
  )
  assert.equal(fetch.mock.callCount(), 0)
})

test('cancelled orders count toward the eight-order limit while observation remains available', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const recorded: ScenarioSession['orders'] = Array.from(
    { length: 8 },
    (_, index) => ({
      id: 'order-' + index,
      symbol: 'NORTH',
      side: 'buy',
      type: 'limit',
      status: 'cancelled',
      quantity: 1,
      filled: 0,
      remaining: 1,
      price: '99.00',
      triggered: false,
      submitted_tick: 0,
      plan,
    }),
  )
  const next = raw(1)
  Object.assign(next.session!, { orders: recorded })
  const fetch = t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit) =>
      Response.json(init?.method === 'POST' ? next.session : next),
  )
  const current = parseScenarioSet(raw(), runId)
  current.session!.orders = recorded
  const client = commands()

  await assert.rejects(
    client.submit(current, { kind: 'order', order }),
    /eight permitted orders/,
  )
  assert.equal(fetch.mock.callCount(), 0)
  const observed = await client.submit(current, { kind: 'advance', steps: 1 })

  assert.equal(observed.session?.tick, 1)
  assert.equal(observed.session?.orders.length, 8)
})

test('a path cannot advance beyond its final observation', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch')
  await assert.rejects(
    commands().submit(parseScenarioSet(raw(18), runId), {
      kind: 'advance',
      steps: 5,
    }),
    /final observation/,
  )
  assert.equal(fetch.mock.callCount(), 0)
})

test('private future history is rejected before it can be displayed', () => {
  const data = raw(1)
  data.session!.history.NORTH.push('101.00')
  assert.throws(() => parseScenarioSet(data, runId), {
    kind: 'invalid-response',
  })
})

test('a session linked to another path is rejected before it can be displayed', () => {
  const data = raw()
  data.session!.scenario_set_policy.case_id = 'path-2'
  assert.throws(() => parseScenarioSet(data, runId), {
    kind: 'invalid-response',
  })
})

test('a new account cannot issue a saved path action from a stale page', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch')
  await assert.rejects(
    commands(storage(), () => 'other').submit(parseScenarioSet(raw(), runId), {
      kind: 'advance',
      steps: 1,
    }),
    /signed-in player changed/,
  )
  assert.equal(fetch.mock.callCount(), 0)
})

test('an account change during a definite rejection retains the old owners command and blocks retry', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  let currentOwner = owner
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    currentOwner = 'other'
    return Response.json({ detail: 'Rejected action' }, { status: 422 })
  })
  const client = commands(storage(), () => currentOwner)
  await assert.rejects(
    client.submit(parseScenarioSet(raw(), runId), {
      kind: 'advance',
      steps: 1,
    }),
    /signed-in player changed/,
  )
  const saved = client.pending()
  await assert.rejects(client.retry(), /signed-in player changed/)
  assert.deepEqual(client.pending(), saved)
  assert.equal(fetch.mock.callCount(), 1)
})

test('an account change after a mutation receipt prevents a current read as the new owner', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  let currentOwner = owner
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    currentOwner = 'other'
    return Response.json(raw(1).session)
  })
  const client = commands(storage(), () => currentOwner)

  await assert.rejects(
    client.submit(parseScenarioSet(raw(), runId), {
      kind: 'advance',
      steps: 1,
    }),
    /signed-in player changed/,
  )

  assert.equal(fetch.mock.callCount(), 1)
  assert.equal(client.pending()?.caseId, 'path-1')
})

test('an account change while a read is in flight withholds its saved market', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  let currentOwner = owner
  t.mock.method(globalThis, 'fetch', async () => {
    currentOwner = 'other'
    return Response.json(raw())
  })
  await assert.rejects(
    readScenarioSet(owner, runId, undefined, () => currentOwner),
    /signed-in player changed/,
  )
})

test('storage failure prevents a mutation that could not be recovered', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch')
  const client = new ScenarioSetCommands(
    owner,
    runId,
    {
      getItem: () => null,
      setItem: () => {
        throw Error('Storage unavailable')
      },
      removeItem: () => {},
    },
    () => owner,
  )
  await assert.rejects(
    client.submit(parseScenarioSet(raw(), runId), {
      kind: 'advance',
      steps: 1,
    }),
    /Storage unavailable/,
  )
  assert.equal(fetch.mock.callCount(), 0)
})

test('a malformed saved case action is retained and never sent', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch')
  let removed = false
  const client = new ScenarioSetCommands(
    owner,
    runId,
    {
      getItem: () =>
        JSON.stringify({
          owner,
          runId,
          caseId: 'path-1',
          sessionId: 'session-1',
          key: 'saved-key-123',
          action: { kind: 'review', audit: audit('path-2') },
        }),
      setItem: () => {},
      removeItem: () => {
        removed = true
      },
    },
    () => owner,
  )
  await assert.rejects(client.retry(), /saved path action could not be read/)
  assert.equal(fetch.mock.callCount(), 0)
  assert.equal(removed, false)
})
