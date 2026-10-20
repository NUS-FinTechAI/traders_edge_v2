import assert from 'node:assert/strict'
import { test } from 'node:test'
import { QuizCommands } from '../services/quizCommands.ts'
import {
  getQuizAttempt,
  getQuizRoom,
  parseQuizAttempt,
  quizError,
  readQuizAsOwner,
  type QuizAttempt,
  type QuizAction,
} from '../services/quizService.ts'
import firebaseService from '../services/firebaseService.ts'
import { HttpError } from '../services/httpService.ts'

function storage() {
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
function attempt(answered = 0): QuizAttempt {
  return {
    id: 'quiz-one',
    quiz_id: 'standalone:one',
    room_id: null,
    content_version: 'edition-one',
    policy_version: 'quiz-1',
    attempt_number: 1,
    status: 'active',
    title: 'Money before markets',
    current_question: {
      id: `question-${answered + 1}`,
      prompt: 'Which money must remain available?',
      options: [
        { id: 'protect', text: 'Essential spending' },
        { id: 'risk', text: 'Risk every amount' },
      ],
    },
    progress: { answered, total: 2 },
    result: null,
  }
}
function room() {
  return {
    id: 'room-one',
    host_id: 'teacher',
    title: 'Classroom quiz',
    join_code: 'ABCDEFGH',
    status: 'waiting',
    content_version: 'edition-one',
    policy_version: 'quiz-1',
    attempt_limit: 1,
    question_count: 2,
    member_count: 1,
    capacity: 30,
    private: true,
    xp_rewards: false,
    can_manage: false,
  }
}
const answer: QuizAction = {
  kind: 'answer',
  attemptId: 'quiz-one',
  answer: { question_id: 'question-1', option_id: 'protect', confidence: 60 },
}

test('lost answer response preserves the original frozen answer and key across reload', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const posts: string[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(String(init.body))
        if (posts.length === 1) throw new TypeError('Response lost')
      }
      return Response.json(attempt(1))
    },
  )
  const journal = storage()
  await assert.rejects(new QuizCommands('owner', journal).submit(answer))

  const commands = new QuizCommands('owner', journal)
  const result = await commands.retry()

  assert.equal(posts[0], posts[1])
  assert.deepEqual(JSON.parse(posts[1]).answer, answer.answer)
  assert.equal(result.kind, 'attempt')
  assert.equal(commands.pending(), null)
})

test('an old replay receipt is followed by the current saved question', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], init?: RequestInit) =>
      Response.json(attempt(init?.method === 'POST' ? 0 : 1)),
  )

  const result = await new QuizCommands('owner', storage()).submit({
    kind: 'start',
    moduleId: 'm1',
  })

  assert.equal(result.kind, 'attempt')
  if (result.kind === 'attempt')
    assert.equal(result.attempt.current_question?.id, 'question-2')
})

test('a confirmed answer followed by a failed fresh read retains the exact command', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const posts: string[] = []
  let reads = 0
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (init?.method === 'POST') posts.push(String(init.body))
      else if (++reads === 1)
        return Response.json(
          { detail: 'Saved quiz unavailable' },
          { status: 409 },
        )
      return Response.json(attempt(1))
    },
  )
  const commands = new QuizCommands('owner', storage())
  await assert.rejects(commands.submit(answer), { status: 409 })
  assert.equal(commands.pending()?.action.kind, 'answer')

  await commands.retry()

  assert.equal(posts[0], posts[1])
  assert.equal(commands.pending(), null)
})

test('uncertain quiz commands prevent a second choice anywhere in quiz mode', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Offline')
  })
  const journal = storage()
  await assert.rejects(new QuizCommands('owner', journal).submit(answer))

  await assert.rejects(
    new QuizCommands('owner', journal).submit({
      kind: 'join-room',
      code: 'ABCDEFGH',
    }),
    /Confirm your saved/,
  )

  assert.equal(fetch.mock.callCount(), 1)
})

test('definite validation rejection releases the answer for a corrected choice with a new key', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const posts: string[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(String(init.body))
        if (posts.length === 1)
          return Response.json(
            { detail: 'Answer the current question' },
            { status: 422 },
          )
      }
      return Response.json(attempt(1))
    },
  )
  const commands = new QuizCommands('owner', storage())
  await assert.rejects(commands.submit(answer), { status: 422 })
  assert.equal(commands.pending(), null)

  await commands.submit(answer)

  assert.notEqual(
    JSON.parse(posts[0]).idempotency_key,
    JSON.parse(posts[1]).idempotency_key,
  )
})

test('an expired sign-in retains the pending answer for later authenticated confirmation', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ detail: 'Sign in required' }, { status: 401 }),
  )
  const commands = new QuizCommands('owner', storage())

  await assert.rejects(commands.submit(answer), { status: 401 })

  assert.deepEqual(commands.pending()?.action, answer)
})

test('classroom lifecycle commands use their own endpoint and never send client permission claims', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const requests: { url: string; body: Record<string, unknown> }[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (init?.method === 'POST')
        requests.push({
          url: String(input),
          body: JSON.parse(String(init.body)),
        })
      return Response.json(room())
    },
  )
  const commands = new QuizCommands('teacher', storage())
  await commands.submit({
    kind: 'create-room',
    input: { title: 'Risk quiz', question_ids: ['q1'], attempt_limit: 2 },
  })
  await commands.submit({ kind: 'join-room', code: 'ABCDEFGH' })
  await commands.submit({ kind: 'start-room', roomId: 'room-one' })
  await commands.submit({ kind: 'close-room', roomId: 'room-one' })

  assert.deepEqual(
    requests.map((request) => new URL(request.url).pathname),
    [
      '/api/quizzes/rooms',
      '/api/quizzes/rooms/join',
      '/api/quizzes/rooms/room-one/start',
      '/api/quizzes/rooms/room-one/close',
    ],
  )
  assert.deepEqual(requests[0].body.question_ids, ['q1'])
  assert.equal(requests[0].body.attempt_limit, 2)
  assert(
    requests.every(
      (request) =>
        !('role' in request.body) &&
        !('owner' in request.body) &&
        !('instructor' in request.body),
    ),
  )
})

test('classroom attempts pin the joined room rather than a standalone module', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  const submitted: Record<string, unknown>[] = []
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (init?.method === 'POST') submitted.push(JSON.parse(String(init.body)))
      return Response.json({ ...attempt(), room_id: 'room-one' })
    },
  )

  const result = await new QuizCommands('owner', storage()).submit({
    kind: 'room-attempt',
    roomId: 'room-one',
  })

  assert.equal(result.kind, 'attempt')
  assert.equal(submitted[0].room_id, 'room-one')
  assert.equal(submitted[0].module_id, undefined)
})

test('private attempts cannot display a nonzero XP result', () => {
  const result = {
    score: 100,
    passed: true,
    critical_passed: true,
    feedback: [1, 2].map((index) => ({
      question_id: `question-${index}`,
      correct: true,
      selected_option_id: 'protect',
      correct_option_id: 'protect',
      explanation: 'Keep essential spending available.',
      confidence: 60,
    })),
    first_answers: [1, 2].map((index) => ({
      question_id: `question-${index}`,
      option_id: 'protect',
      confidence: 60,
      recorded_at: '2026-10-19T00:00:00+00:00',
    })),
    xp_earned: 20,
  }
  assert.throws(
    () =>
      parseQuizAttempt({
        ...attempt(),
        room_id: 'room-one',
        status: 'completed',
        current_question: null,
        progress: { answered: 2, total: 2 },
        result,
      }),
    { kind: 'invalid-response' },
  )
})

test('active attempts cannot disclose whole-form feedback or completed question previews', () => {
  assert.throws(
    () =>
      parseQuizAttempt({
        ...attempt(),
        completed_questions: [attempt().current_question!],
      }),
    { kind: 'invalid-response' },
  )
})

test('quiz reads reject another resource identity', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(
    globalThis,
    'fetch',
    async (input: Parameters<typeof fetch>[0]) =>
      Response.json(String(input).includes('/rooms/') ? room() : attempt()),
  )
  await assert.rejects(getQuizAttempt('another-attempt'), {
    kind: 'invalid-response',
  })
  await assert.rejects(getQuizRoom('another-room'), {
    kind: 'invalid-response',
  })
})

test('pending quiz actions remain isolated between authenticated owners', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Offline')
  })
  const journal = storage()
  await assert.rejects(new QuizCommands('one', journal).submit(answer))

  assert.equal(new QuizCommands('two', journal).pending(), null)
  assert.deepEqual(new QuizCommands('one', journal).pending()?.action, answer)
})

test('unavailable storage prevents any quiz mutation', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch')
  const commands = new QuizCommands('owner', {
    getItem: () => null,
    setItem: () => {
      throw new Error('Storage disabled')
    },
    removeItem: () => {},
  })

  await assert.rejects(commands.submit(answer), /Storage disabled/)

  assert.equal(fetch.mock.callCount(), 0)
})

test('corrupt saved commands fail closed instead of issuing a different request', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch')
  const commands = new QuizCommands('owner', {
    getItem: () =>
      JSON.stringify({ owner: 'owner', key: 12345678, action: answer }),
    setItem: () => {},
    removeItem: () => {},
  })

  await assert.rejects(commands.retry(), /saved quiz action could not be read/)

  assert.equal(fetch.mock.callCount(), 0)
})

test('known account change prevents a stale quiz page from issuing a mutation', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch')
  const commands = new QuizCommands('owner', storage(), () => 'another-owner')

  await assert.rejects(commands.submit(answer), /previous signed-in account/)

  assert.equal(fetch.mock.callCount(), 0)
  assert.equal(commands.pending(), null)
})

test('account change during a request retains the original owners command without publishing another accounts state', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  let owner = 'owner'
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    owner = 'other'
    return Response.json(attempt(1))
  })
  const commands = new QuizCommands('owner', storage(), () => owner)

  await assert.rejects(commands.submit(answer), /previous signed-in account/)

  assert.equal(fetch.mock.callCount(), 1)
  assert.deepEqual(commands.pending()?.action, answer)
})

test('known account change blocks a stale quiz read before it requests data', async () => {
  let reads = 0

  await assert.rejects(
    readQuizAsOwner(
      'owner',
      () => 'other',
      async () => {
        reads++
        return attempt()
      },
    ),
    /previous signed-in account/,
  )

  assert.equal(reads, 0)
})

test('account change during a quiz read withholds the returned data', async () => {
  let owner = 'owner'
  let published = false

  await assert.rejects(
    readQuizAsOwner(
      'owner',
      () => owner,
      async () => {
        owner = 'other'
        return attempt()
      },
    ).then(() => {
      published = true
    }),
    /previous signed-in account/,
  )

  assert.equal(published, false)
})

test('account change during a rejected command retains its original key and prevents retry as the new owner', async (t) => {
  t.mock.method(firebaseService, 'getAccessToken', async () => null)
  let owner = 'owner'
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    owner = 'other'
    return Response.json(
      { detail: 'Answer the current question' },
      { status: 422 },
    )
  })
  const journal = storage()
  const commands = new QuizCommands('owner', journal, () => owner)
  await assert.rejects(commands.submit(answer), /previous signed-in account/)
  const saved = commands.pending()

  await assert.rejects(commands.retry(), /previous signed-in account/)

  assert.equal(fetch.mock.callCount(), 1)
  assert.deepEqual(commands.pending(), saved)
  assert.deepEqual(saved?.action, answer)
  assert.equal(new QuizCommands('other', journal).pending(), null)
})

test('structured validation errors tell the learner to correct fields rather than confirm an uncertain command', () => {
  const error = new HttpError('Request failed', 'http', 422, {
    detail: [{ loc: ['body', 'answer'], msg: 'Field required' }],
  })

  assert.equal(
    quizError(error),
    'Check the required quiz fields and choose a valid answer before trying again.',
  )
})
