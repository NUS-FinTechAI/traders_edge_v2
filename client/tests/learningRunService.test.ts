import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getLearningRun,
  LearningCommands,
  parseLearningRun,
  type LearningRun,
} from '../services/learningRunService.ts'
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
function run(): LearningRun {
  return {
    id: 'run-one',
    module_id: 'm01',
    level_id: 'm01-l01',
    purpose: 'practice',
    status: 'active',
    current_step: {
      id: 'choice-one',
      type: 'choice',
      prompt: 'Protect essential spending',
      options: [
        { id: 'protect', text: 'Keep it available' },
        { id: 'risk', text: 'Risk it' },
      ],
    },
    progress: { completed_steps: 1, total_steps: 3 },
    feedback: [],
    result: null,
  }
}

test('lost answer response is replayed with identical key and payload after reload', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const payloads: string[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], options?: RequestInit) => {
      payloads.push(String(options?.body))
      if (payloads.length === 1)
        throw new TypeError('Connection lost after commit')
      return Response.json(run())
    },
  )
  const storage = memoryStorage()
  const beforeReload = new LearningCommands('owner', storage)
  await assert.rejects(
    beforeReload.submit(run(), { option_id: 'protect', confidence: 75 }),
  )

  const afterReload = new LearningCommands('owner', storage)
  await afterReload.submit(run(), { option_id: 'risk' })

  assert.equal(payloads[0], payloads[1])
  assert.equal(JSON.parse(payloads[1]).answer.option_id, 'protect')
  assert.equal(afterReload.pending('run-one'), null)
})

test('deliberate retry after wrong feedback creates a new command key', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const payloads: string[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], options?: RequestInit) => {
      payloads.push(String(options?.body))
      return Response.json({
        ...run(),
        feedback: [
          {
            step_id: 'choice-one',
            correct: false,
            explanation: 'Protect essential spending.',
          },
        ],
      })
    },
  )
  const commands = new LearningCommands('owner', memoryStorage())

  const wrong = await commands.submit(run(), { option_id: 'risk' })
  await commands.submit(wrong, { option_id: 'protect' })

  assert.notEqual(
    JSON.parse(payloads[0]).idempotency_key,
    JSON.parse(payloads[1]).idempotency_key,
  )
})

test('pending answers are isolated by learner identity', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Offline')
  })
  const storage = memoryStorage()
  const first = new LearningCommands('first', storage)
  await assert.rejects(first.submit(run(), { option_id: 'protect' }))

  const second = new LearningCommands('second', storage)

  assert.equal(second.pending('run-one'), null)
  assert.equal(first.pending('run-one')?.answer.option_id, 'protect')
})

test('storage failure prevents an unrepeatable mutation from being sent', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    Response.json(run()),
  )
  const commands = new LearningCommands('owner', {
    ...memoryStorage(),
    setItem: () => {
      throw new Error('Storage unavailable')
    },
  })

  await assert.rejects(
    commands.submit(run(), { option_id: 'protect' }),
    /Storage unavailable/,
  )

  assert.equal(fetch.mock.callCount(), 0)
})

test('failed start keeps its command key across reloads', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const requests: string[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], options?: RequestInit) => {
      requests.push(String(options?.body))
      if (requests.length === 1) throw new TypeError('Offline')
      return Response.json(run())
    },
  )
  const storage = memoryStorage()
  await assert.rejects(
    new LearningCommands('owner', storage).start('practice', 'm01-l01'),
  )

  await new LearningCommands('owner', storage).start('practice', 'm01-l01')

  assert.equal(requests[0], requests[1])
})

test('bonus start uses the level endpoint with an explicit bonus purpose', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const request = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ ...run(), purpose: 'bonus' }),
  )

  await new LearningCommands('owner', memoryStorage()).start('bonus', 'm01-l01')

  assert.match(
    String(request.mock.calls[0].arguments[0]),
    /\/levels\/m01-l01\/runs$/,
  )
  assert.equal(
    JSON.parse(String(request.mock.calls[0].arguments[1]?.body)).purpose,
    'bonus',
  )
})

test('diagnostic start uses the module endpoint without a practice purpose', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const request = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ ...run(), purpose: 'diagnostic', level_id: null }),
  )

  await new LearningCommands('owner', memoryStorage()).start(
    'diagnostic',
    'm01',
  )

  assert.match(
    String(request.mock.calls[0].arguments[0]),
    /\/modules\/m01\/diagnostic-runs$/,
  )
  assert.deepEqual(
    Object.keys(JSON.parse(String(request.mock.calls[0].arguments[1]?.body))),
    ['idempotency_key'],
  )
})

test('inconsistent progress retains the pending answer for exact recovery', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const inconsistent = run()
  inconsistent.progress.completed_steps = inconsistent.progress.total_steps
  t.mock.method(globalThis, 'fetch', async () => Response.json(inconsistent))
  const commands = new LearningCommands('owner', memoryStorage())

  await assert.rejects(commands.submit(run(), { option_id: 'protect' }))

  assert.equal(commands.pending('run-one')?.step_id, 'choice-one')
})

test('simulation tasks cannot use the ordinary answer route', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    Response.json(run()),
  )
  const simulation = {
    ...run(),
    current_step: {
      id: 'audit',
      type: 'simulation' as const,
      prompt: 'Audit the observed session',
    },
  }

  await assert.rejects(
    new LearningCommands('owner', memoryStorage()).submit(simulation, {
      acknowledged: true,
    }),
    /cannot be submitted/,
  )

  assert.equal(fetch.mock.callCount(), 0)
})

test('saved run read rejects a mismatched identity', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(globalThis, 'fetch', async () => Response.json(run()))

  await assert.rejects(getLearningRun('different-run'))
})

test('parser retains classification content but excludes private task fields', () => {
  const current_step = {
    id: 'sort',
    type: 'classification' as const,
    prompt: 'Sort these needs',
    items: [{ id: 'rent', text: 'Rent' }],
    categories: [{ id: 'protect', text: 'Protect' }],
    correct_assignments: { rent: 'protect' },
  }
  const payload: LearningRun = { ...run(), current_step }

  const result = parseLearningRun(payload)

  assert.equal(result.current_step?.type, 'classification')
  assert.equal('correct_assignments' in result.current_step!, false)
})

test('completed diagnostic accepts a null pass result and server score', () => {
  const payload: LearningRun = {
    ...run(),
    purpose: 'diagnostic',
    status: 'completed',
    current_step: null,
    progress: { completed_steps: 3, total_steps: 3 },
    result: {
      passed: null,
      score_percent: 0,
      standard_star: false,
      bonus_star: false,
      xp_awarded: 0,
    },
  }

  const result = parseLearningRun(payload)

  assert.equal(result.result?.passed, null)
  assert.equal(result.result?.score_percent, 0)
})
