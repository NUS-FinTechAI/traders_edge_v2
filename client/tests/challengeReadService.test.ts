import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import firebaseService from '../services/firebaseService.ts'
import {
  loadChallengeOverview,
  startAvailability,
  challengeBrief,
  challengeDecisionReview,
  challengeError,
  challengeStartPath,
  parseChallengeWallet,
  utcTime,
} from '../services/challengeReadService.ts'
import { HttpError } from '../services/httpService.ts'
import { challenge, completedChallenge } from './fixtures/challengeFixtures.ts'

test('saved naive UTC timestamps keep their UTC hour in a different browser timezone', () => {
  const previous = process.env.TZ
  process.env.TZ = 'Asia/Singapore'
  try {
    assert.equal(
      utcTime('2026-10-19T16:01:17.698483'),
      '19 Oct 2026, 16:01 UTC',
    )
  } finally {
    if (previous === undefined) delete process.env.TZ
    else process.env.TZ = previous
  }
})

test('explicit timestamp offsets are converted to UTC once', () => {
  assert.equal(utcTime('2026-10-20T00:01:17+08:00'), '19 Oct 2026, 16:01 UTC')
})

async function overview(t: TestContext, mastered: string[] = []) {
  const chapters = [1, 2, 3, 4, 5].map((order) => ({
    module_id: `m0${order}`,
    title: `Chapter ${order}`,
    order,
    unlocked: true,
    entry_boss: {
      available: order > 1,
      reason: order === 1 ? 'introductory_diagnostic' : null,
      active_attempt_ids: [],
    },
    exit_boss: {
      available: false,
      reason: 'required_levels_incomplete',
      active_attempt_ids: [],
    },
  }))
  const wallet = {
    policy_version: '1',
    timezone: 'UTC',
    stocks_week: '2026-10-19',
    stocks_expires_at: '2026-10-26T00:00:00Z',
    stocks_balance: 0,
    premium_balance: 0,
    login_streak_days: 0,
    daily_cooldown_until: null,
    login_last_day: null,
    simulated_trading_funds: 'Separate from game currency',
  }
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(
    globalThis,
    'fetch',
    async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input)
      return Response.json(
        url.endsWith('/api/challenges')
          ? { attempts: [] }
          : url.endsWith('/api/adventure')
            ? { chapters }
            : url.endsWith('/profile')
              ? { id: 'owner', mastered_module_ids: mastered }
              : wallet,
      )
    },
  )
  return loadChallengeOverview()
}

test('early chapter access does not make AI practice eligible without four learning checks', async (t) => {
  const data = await overview(t)

  assert.equal(data.practiceAvailable, false)
  assert.deepEqual(
    data.missing.map((chapter) => chapter.module_id),
    ['m01', 'm02', 'm03', 'm04'],
  )
  assert.match(
    startAvailability(data, 'practice') ?? '',
    /learning checks in Chapters 1–4/,
  )
})

test('passing the first four module checks makes practice available', async (t) => {
  const data = await overview(t, ['m01', 'm02', 'm03', 'm04'])

  assert.equal(data.practiceAvailable, true)
  assert.equal(startAvailability(data, 'practice'), null)
})

test('daily cooldown guidance gives the saved UTC retry time', async (t) => {
  const data = await overview(t)
  data.wallet.daily_cooldown_until = '2026-10-19T12:30:00Z'

  const reason = startAvailability(data, 'daily')

  assert.match(reason ?? '', /19 Oct 2026, 12:30 UTC/)
})

test('an active daily attempt is resumable before a new daily start', async (t) => {
  const data = await overview(t)
  data.attempts.push({
    id: 'daily-one',
    challenge_id: 'daily:2026-10-19',
    mode: 'daily',
    module_id: null,
    status: 'active',
    created_at: '2026-10-19T00:00:00Z',
    updated_at: '2026-10-19T00:00:00Z',
  })

  assert.match(
    startAvailability(data, 'daily') ?? '',
    /Resume your saved daily attempt/,
  )
})

test('boss starts respect the server introductory-diagnostic reason', async (t) => {
  const data = await overview(t)

  assert.match(
    startAvailability(data, 'chapter_entry', 'm01') ?? '',
    /introductory assessment instead/,
  )
})

test('a saved boss attempt is offered for resume even while a fresh start is available', async (t) => {
  const data = await overview(t)
  data.chapters[1].entry_boss.active_attempt_ids.push('boss-one')

  assert.match(
    startAvailability(data, 'chapter_entry', 'm02') ?? '',
    /Resume your saved boss/,
  )
})

test('boss launch rejects an absent chapter and retains its chapter identifier in links', async (t) => {
  const data = await overview(t)

  assert.match(
    startAvailability(data, 'chapter_exit', 'missing') ?? '',
    /Choose a chapter/,
  )
  assert.equal(
    challengeStartPath('chapter_exit', 'a/b'),
    '/challenges/start/chapter_exit?chapter=a%2Fb',
  )
})

test('three active attempts explain the common fresh-start limit', async (t) => {
  const data = await overview(t, ['m01', 'm02', 'm03', 'm04'])
  data.attempts = [1, 2, 3].map((number) => ({
    id: `attempt-${number}`,
    challenge_id: 'practice-foundation-1',
    mode: 'practice',
    module_id: null,
    status: 'active',
    created_at: '2026-10-19T00:00:00Z',
    updated_at: '2026-10-19T00:00:00Z',
  }))

  assert.match(
    startAvailability(data, 'practice') ?? '',
    /three attempts are already open/,
  )
})

test('legacy challenges remain readable without newly authored policy context', () => {
  const value = challenge()

  assert.deepEqual(challengeBrief(value), {
    context: undefined,
    review_prompts: undefined,
    assessment_basis: undefined,
  })
  assert.equal(challengeDecisionReview(value), null)
})

test('new policy context and factual decision review remain separate from the profit result', () => {
  const value = completedChallenge()
  Object.assign(value.policy, {
    context: 'Compare execution intent with actual fills.',
    review_prompts: ['Which fill assumption changed?'],
    assessment_basis: 'Operational facts, not validated learning.',
  })
  const review = {
    basis: 'Recorded facts only',
    cash_percent: '100.00',
    largest_position_percent: '0.00',
    max_drawdown_percent: '0.00',
    fees: '0.00',
    submitted_orders: 0,
    filled_orders: 0,
    review_prompts: ['Why did you remain in cash?'],
  }
  Object.assign(value.result!, { decision_review: review })

  assert.equal(
    challengeBrief(value).context,
    'Compare execution intent with actual fills.',
  )
  assert.deepEqual(challengeDecisionReview(value), review)
  assert.equal(value.result?.win, false)
})

test('daily rejection presents its saved retry time rather than a generic failure', () => {
  const error = new HttpError('Conflict', 'http', 409, {
    message: 'Daily challenge retry is cooling down',
    retry_at: '2026-10-19T12:30:00Z',
    refresh_premium_cost: 10,
  })

  assert.match(challengeError(error), /12:30 UTC/)
})

test('an invalid wallet balance is rejected instead of displaying invented availability', () => {
  assert.throws(() => parseChallengeWallet({ stocks_balance: -1 }), {
    kind: 'invalid-response',
  })
})
