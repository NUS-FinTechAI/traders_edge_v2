import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  loadAdventure,
  loadChapter,
  loadLevel,
  levelLockReason,
  bossStatus,
  adventureError,
  type ModuleMap,
  type LevelProgress,
} from '../services/adventureService.ts'
import firebaseService from '../services/firebaseService.ts'
import { HttpError } from '../services/httpService.ts'

const level: LevelProgress = {
  id: 'first',
  title: 'Protect essential spending',
  objective: 'Recognize essential money',
  unlocked: false,
  status: 'locked',
  standard_star: false,
  bonus_star: false,
  completion_source: null,
  bonus_available: false,
  active_run_id: null,
}
const map: ModuleMap = {
  module_id: 'chapter',
  title: 'Money before markets',
  content_version: 'edition',
  interactive_available: true,
  unlocked: true,
  prerequisite_module_ids: [],
  mastered: false,
  diagnostic: { required: true, completed: false, run_id: null },
  levels: [level],
  assessment_available: false,
}

test('chapter read includes offered locked bonuses without changing progress and forwards cancellation', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const chapter = { module_id: 'chapter', unlocked: true }
  const fetchMock = t.mock.method(
    globalThis,
    'fetch',
    async (input: Parameters<typeof fetch>[0]) =>
      Response.json(
        String(input).endsWith('/catalog')
          ? {
              chapters: [
                {
                  module_id: 'chapter',
                  levels: [
                    { id: 'first', bonus_steps: 1 },
                    { id: 'no-bonus', bonus_steps: 0 },
                  ],
                },
              ],
            }
          : String(input).endsWith('/adventure')
            ? { chapters: [chapter] }
            : map,
      ),
  )
  const controller = new AbortController()

  const result = await loadChapter('chapter', controller.signal)

  assert.deepEqual(result, {
    chapter,
    map,
    chapters: [chapter],
    bonusLevelIds: ['first'],
  })
  assert.equal(fetchMock.mock.calls.length, 3)
  for (const call of fetchMock.mock.calls) {
    assert.equal(call.arguments[1]?.signal, controller.signal)
    assert.equal(call.arguments[1]?.credentials, 'include')
    assert.equal(call.arguments[1]?.method, 'GET')
  }
})

test('chapter absent from overview is reported as not found', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(
    globalThis,
    'fetch',
    async (input: Parameters<typeof fetch>[0]) =>
      Response.json(
        String(input).endsWith('/adventure') ? { chapters: [] } : map,
      ),
  )

  await assert.rejects(
    loadChapter('chapter', new AbortController().signal),
    (error) => error instanceof HttpError && error.status === 404,
  )
})

test('level briefing request safely encodes the level identifier', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ level }),
  )

  const response = await loadLevel('level/one', new AbortController().signal)

  assert.deepEqual(response, { level })
  assert.equal(
    String(fetchMock.mock.calls[0].arguments[0]),
    'http://localhost:8000/api/levels/level%2Fone',
  )
})

test('overview failure remains retryable without inventing empty progress', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  let requests = 0
  t.mock.method(globalThis, 'fetch', async () =>
    ++requests === 1
      ? Response.json({ detail: 'Unavailable' }, { status: 503 })
      : Response.json({ policy_version: 'adventure-1', chapters: [] }),
  )

  await assert.rejects(
    loadAdventure(new AbortController().signal),
    (error) => error instanceof HttpError && error.status === 503,
  )
  const recovered = await loadAdventure(new AbortController().signal)

  assert.deepEqual(recovered.chapters, [])
  assert.equal(requests, 2)
})

test('cancelled overview does not fetch or expose old progress', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ chapters: [] }),
  )
  const controller = new AbortController()
  controller.abort()

  await assert.rejects(
    loadAdventure(controller.signal),
    (error) => error instanceof HttpError && error.kind === 'aborted',
  )

  assert.equal(fetchMock.mock.calls.length, 0)
})

test('early chapter access still explains the introductory assessment gate', () => {
  assert.match(levelLockReason(map, level) ?? '', /introductory assessment/)
  assert.equal(levelLockReason(map, { ...level, unlocked: true }), null)
})

test('locked level names incomplete earlier missions after the diagnostic', () => {
  const second = { ...level, id: 'second', title: 'Compare goals' }
  const afterDiagnostic = {
    ...map,
    diagnostic: { ...map.diagnostic, completed: true },
    levels: [level, second],
  }

  assert.equal(
    levelLockReason(afterDiagnostic, second),
    'Complete the required missions in Protect essential spending first.',
  )
})

test('active boss remains labelled in progress when fresh starts are blocked', () => {
  assert.equal(
    bossStatus(
      {
        available: false,
        reason: 'active_challenge_limit',
        active_attempt_ids: ['attempt'],
      },
      false,
    ),
    'Attempt in progress',
  )
})

test('publication and missing-session failures explain their distinct recovery', () => {
  assert.match(
    adventureError(new HttpError('Private detail', 'http', 503)),
    /publication review/,
  )
  assert.match(
    adventureError(new HttpError('Private detail', 'http', 401)),
    /Sign in again/,
  )
  assert.doesNotMatch(
    adventureError(new Error('Private detail')),
    /Private detail/,
  )
})
