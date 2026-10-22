import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as research from '../services/researchService.ts'
import { stubHttp } from './helpers/serviceHttp.ts'

for (const [name, load, path] of [
  ['metadata', research.getResearchMetadata, '/api/me/research'],
  ['onboarding', research.getOnboarding, '/api/me/research/onboarding'],
  ['summary', research.getResearchSummary, '/api/research/summary'],
  ['pre/post report', research.getPrePost, '/api/research/pre-post'],
] as const) {
  test(`loading research ${name} forwards cancellation and returns server data`, async (t) => {
    const response = { marker: name }
    const requests = stubHttp(t, response)
    const controller = new AbortController()

    const result = await load(controller.signal)

    assert.deepEqual(result, response)
    assert.equal(requests[0].url.pathname, path)
    assert.equal(requests[0].method, 'GET')
    assert.equal(requests[0].signal, controller.signal)
  })
}

test('joining a study sends the accepted policy and a unique command key', async (t) => {
  const requests = stubHttp(t, { consent: true })
  const policy = {
    available: true,
    version: 'v1',
    policy_digest: 'digest',
    text: 'Study policy',
  }

  const result = await research.joinStudy(policy)

  assert.deepEqual(result, { consent: true })
  assert.equal(requests[0].url.pathname, '/api/me/research/consents')
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].body, {
    accepted: true,
    policy_version: 'v1',
    policy_digest: 'digest',
    idempotency_key: assertCommandKey(requests[0].body),
  })
})

function assertCommandKey(body: unknown): string {
  assert.ok(body && typeof body === 'object' && 'idempotency_key' in body)
  assert.equal(typeof body.idempotency_key, 'string')
  const key = String(body.idempotency_key)
  assert.match(key, /^[a-zA-Z0-9_-]{8,100}$/)
  return key
}

test('a missing policy version and digest are sent as empty fields for server validation', async (t) => {
  const requests = stubHttp(t)

  await research.joinStudy({
    available: false,
    version: null,
    policy_digest: null,
    text: null,
  })

  assert.deepEqual(requests[0].body, {
    accepted: true,
    policy_version: '',
    policy_digest: '',
    idempotency_key: assertCommandKey(requests[0].body),
  })
})

test('withdrawing from a study sends a new command key', async (t) => {
  const requests = stubHttp(t, { consent: false })

  const result = await research.leaveStudy()

  assert.deepEqual(result, { consent: false })
  assert.equal(requests[0].url.pathname, '/api/me/research/withdrawals')
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].body, {
    idempotency_key: assertCommandKey(requests[0].body),
  })
})

test('research command keys are unique and use the server-accepted alphabet', () => {
  const first = research.commandKey()
  const second = research.commandKey()

  assert.match(first, /^[a-zA-Z0-9_-]{8,100}$/)
  assert.match(second, /^[a-zA-Z0-9_-]{8,100}$/)
  assert.notEqual(first, second)
})

test('submitting onboarding retains its command key, null answers and elapsed time', async (t) => {
  const response = { completed: true }
  const requests = stubHttp(t, response)
  const body = {
    idempotency_key: 'submission-key',
    instrument_version: 'v1',
    self_report: { brokerage_account: false, confidence: 0 },
    answers: [{ item_id: 'q1', option_id: null }],
    elapsed_seconds: 0,
  }

  const result = await research.submitOnboarding(body)

  assert.deepEqual(result, response)
  assert.equal(
    requests[0].url.pathname,
    '/api/me/research/onboarding/responses',
  )
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].body, body)
})

test('skipping onboarding retains the caller command key and instrument version', async (t) => {
  const requests = stubHttp(t, { skipped: true })

  const result = await research.skipOnboarding('skip-key', 'v1')

  assert.deepEqual(result, { skipped: true })
  assert.equal(requests[0].url.pathname, '/api/me/research/onboarding/skips')
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].body, {
    idempotency_key: 'skip-key',
    instrument_version: 'v1',
  })
})

for (const allowed of [true, false]) {
  test(`research access returns ${allowed} from the access response`, async (t) => {
    const requests = stubHttp(t, { allowed })

    const result = await research.getResearchAccess()

    assert.equal(result, allowed)
    assert.equal(requests[0].url.pathname, '/api/research/access')
  })
}

for (const [name, load, path] of [
  [
    'decision trends',
    research.getDecisionTrends,
    '/api/research/decision-trends',
  ],
  ['check accuracy', research.getCheckAccuracy, '/api/research/checks'],
] as const) {
  for (const chapterId of ['ch/a &b', null]) {
    test(`${name} filters ${chapterId === null ? 'all chapters' : 'the selected chapter'} without losing the cohort`, async (t) => {
      const response = { rows: [] }
      const requests = stubHttp(t, response)
      const controller = new AbortController()

      const result = await load({ chapterId, group: 'all' }, controller.signal)

      assert.deepEqual(result, response)
      assert.equal(requests[0].url.pathname, path)
      assert.equal(requests[0].url.searchParams.get('chapter_id'), chapterId)
      assert.equal(requests[0].url.searchParams.get('group'), 'all')
      assert.equal(requests[0].signal, controller.signal)
    })
  }
}

test('quiz performance sends the cohort filter and cancellation signal', async (t) => {
  const requests = stubHttp(t, { rows: [] })
  const controller = new AbortController()

  const result = await research.getQuizPerformance('all', controller.signal)

  assert.deepEqual(result, { rows: [] })
  assert.equal(requests[0].url.pathname, '/api/research/quizzes')
  assert.equal(requests[0].url.searchParams.get('group'), 'all')
  assert.equal(requests[0].signal, controller.signal)
})

for (const kind of [
  'participants',
  'matches',
  'game-events',
  'check-answers',
  'quiz-answers',
  'prior-knowledge',
] as const) {
  test(`exporting ${kind} requests CSV and preserves quoted fields and line endings`, async (t) => {
    const csv = 'id,name\r\n1,"A,B"\r\n'
    const requests = stubHttp(
      t,
      new Response(csv, { headers: { 'Content-Type': 'text/csv' } }),
    )

    const result = await research.exportCsv(kind)

    assert.equal(result, csv)
    assert.equal(requests[0].url.pathname, `/api/research/exports/${kind}`)
    assert.equal(requests[0].method, 'GET')
    assert.equal(requests[0].headers.get('Accept'), 'text/csv')
  })
}

test('a denied CSV export propagates JSON error details without retrying', async (t) => {
  const requests = stubHttp(t, { detail: 'Research access required' }, 403)

  await assert.rejects(research.exportCsv('participants'), {
    status: 403,
    message: 'Research access required',
  })

  assert.equal(requests.length, 1)
})

test('an aborted research summary read does not reach the network', async (t) => {
  const requests = stubHttp(t)
  const controller = new AbortController()
  controller.abort()

  await assert.rejects(research.getResearchSummary(controller.signal), {
    kind: 'aborted',
  })

  assert.equal(requests.length, 0)
})
