import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiClient } from '../api/apiClient.ts'
import { ChallengeController } from '../controllers/challengeController.ts'
import {
  ChallengeService,
  parseChallenge,
  type ChallengeCommand,
} from '../services/challengeService.ts'
import { HttpService } from '../services/httpService.ts'
import {
  challenge,
  completedChallenge,
  memoryStorage,
} from './challengeFixtures.ts'

test('service sends each challenge command through its generated authenticated endpoint', async (t) => {
  const requests: { url: string; body: unknown; method?: string }[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      requests.push({
        url: String(input),
        method: init?.method,
        body: JSON.parse(String(init?.body)),
      })
      assert.equal(init?.credentials, 'include')
      if (String(input).endsWith('/complete'))
        return Response.json(completedChallenge())
      const value = challenge()
      if (String(input).endsWith('/abandon')) {
        value.status = 'abandoned'
        value.player.finished = true
      }
      return Response.json(value)
    },
  )
  const service = new ChallengeService(
    new ApiClient(new HttpService({ baseUrl: 'http://localhost:8000' })),
  )
  const key = 'stable-command-key'
  const attemptId = 'attempt-one'
  const order = {
    symbol: 'NORTH' as const,
    side: 'buy' as const,
    type: 'market' as const,
    quantity: 1,
    plan: {
      reason: 'A reason for the order',
      risk: 'Prices may fall after buying',
      exit: 'Review after five observations',
      size_reason: 'Keep exposure within my limit',
      max_loss: '10.00',
    },
  }
  const commands: ChallengeCommand[] = [
    { kind: 'start', key, input: { mode: 'practice', opponent_count: 1 } },
    { kind: 'order', key, attemptId, order },
    { kind: 'cancel', key, attemptId, orderId: 'order/a' },
    { kind: 'advance', key, attemptId, steps: 3 },
    {
      kind: 'complete',
      key,
      attemptId,
      reflection: 'I compared the plan and outcome.',
    },
    { kind: 'abandon', key, attemptId },
  ]

  for (const command of commands) await service.execute(command)

  assert.deepEqual(
    requests.map((item) => item.url.replace('http://localhost:8000', '')),
    [
      '/api/challenges',
      '/api/challenges/attempt-one/orders',
      '/api/challenges/attempt-one/orders/order%2Fa/cancel',
      '/api/challenges/attempt-one/advance',
      '/api/challenges/attempt-one/complete',
      '/api/challenges/attempt-one/abandon',
    ],
  )
  assert(requests.every((item) => item.method === 'POST'))
  assert.deepEqual(
    requests.map((item) => item.body),
    [
      { idempotency_key: key, mode: 'practice', opponent_count: 1 },
      { idempotency_key: key, order },
      { idempotency_key: key },
      { idempotency_key: key, steps: 3 },
      { idempotency_key: key, reflection: 'I compared the plan and outcome.' },
      { idempotency_key: key },
    ],
  )
})

test('service lists and resumes owned challenges', async (t) => {
  const paths: string[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      paths.push(String(input))
      assert.equal(init?.method, 'GET')
      return Response.json(
        String(input).endsWith('/attempt-one')
          ? challenge(7)
          : { attempts: [] },
      )
    },
  )
  const service = new ChallengeService(
    new ApiClient(new HttpService({ baseUrl: 'http://localhost:8000' })),
  )

  assert.deepEqual(await service.list(), { attempts: [] })
  assert.equal((await service.get('attempt-one')).player.tick, 7)
  assert.equal(paths.length, 2)
})

test('service rejects a response belonging to a different requested attempt', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(challenge()))
  const service = new ChallengeService(
    new ApiClient(new HttpService({ baseUrl: 'http://localhost:8000' })),
  )

  await assert.rejects(service.get('another-attempt'), {
    kind: 'invalid-response',
  })
})

test('challenge consistency check rejects history beyond the observed tick', () => {
  const future = challenge()
  future.player.history.NORTH.push('45.00')

  assert.throws(() => parseChallenge(future), { kind: 'invalid-response' })
})

test('completed challenge without its result is rejected as inconsistent', () => {
  const value = challenge(29)
  value.status = 'completed'
  value.player.finished = true

  assert.throws(() => parseChallenge(value), { kind: 'invalid-response' })
})

test('completed ties and negative profits remain server-owned results', () => {
  const value = completedChallenge()
  value.result!.profit = '-1.00'
  for (const entry of value.result!.leaderboard) entry.profit = '-1.00'

  assert.deepEqual(parseChallenge(value), value)
  assert.equal(parseChallenge(value).result!.win, false)
})

test('challenge consistency check rejects an opponent on a different tick', () => {
  const value = challenge(5)
  value.opponents[0].tick = 4

  assert.throws(() => parseChallenge(value), { kind: 'invalid-response' })
})

test('active challenge cannot have a finished player observation', () => {
  const value = challenge()
  value.player.finished = true

  assert.throws(() => parseChallenge(value), { kind: 'invalid-response' })
})

test('final result must reference the same challenge attempt', () => {
  const value = completedChallenge()
  value.result!.attempt_id = 'another-attempt'

  assert.throws(() => parseChallenge(value), { kind: 'invalid-response' })
})

test('leaderboard must contain the same participants as the challenge', () => {
  const value = completedChallenge()
  value.result!.leaderboard[0].participant_id = 'another-opponent'

  assert.throws(() => parseChallenge(value), { kind: 'invalid-response' })
})

test('HTTP response loss recovers the exact persisted start body and then loads current state', async (t) => {
  const bodies: string[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (init?.method === 'POST') {
        bodies.push(String(init.body))
        if (bodies.length === 1)
          throw new TypeError('Response lost after commit')
        return Response.json(challenge())
      }
      return Response.json(challenge(7))
    },
  )
  const transport = new ChallengeService(
    new ApiClient(new HttpService({ baseUrl: 'http://localhost:8000' })),
  )
  const storage = memoryStorage()
  const options = {
    ownerId: 'owner',
    getOwnerId: () => 'owner',
    storage,
    transport,
  }
  const original = new ChallengeController(options)
  await assert.rejects(
    original.start({ mode: 'practice', opponent_count: 1 }),
    { kind: 'network' },
  )
  const reloaded = new ChallengeController(options)

  await reloaded.recover()

  assert.equal(bodies.length, 2)
  assert.equal(bodies[1], bodies[0])
  assert.equal(reloaded.getSnapshot().challenge?.player.tick, 7)
})
