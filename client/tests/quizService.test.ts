import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as quiz from '../services/quizService.ts'
import { stubHttp } from './helpers/serviceHttp.ts'

for (const [name, load, path, response] of [
  ['quiz hub', quiz.getQuizzes, '/api/quizzes', { topics: [], rooms: [] }],
  [
    'attempt',
    (signal?: AbortSignal) => quiz.getAttempt('attempt/a ?#', signal),
    '/api/quizzes/attempts/attempt%2Fa%20%3F%23',
    { id: 'attempt/a ?#' },
  ],
  [
    'classroom room',
    (signal?: AbortSignal) => quiz.getRoom('room/a ?#', signal),
    '/api/quizzes/rooms/room%2Fa%20%3F%23',
    { id: 'room/a ?#' },
  ],
] as const) {
  test(`loading ${name} returns server data and forwards cancellation`, async (t) => {
    const requests = stubHttp(t, response)
    const controller = new AbortController()

    const result = await load(controller.signal)

    assert.deepEqual(result, response)
    assert.equal(requests[0].url.pathname, path)
    assert.equal(requests[0].method, 'GET')
    assert.equal(requests[0].signal, controller.signal)
  })
}

for (const start of [{ topic_id: 'ch1' }, { room_code: 'AB12CD' }]) {
  test(`starting an attempt with ${Object.keys(start)[0]} preserves its selection`, async (t) => {
    const requests = stubHttp(t, { id: 'attempt' })

    const result = await quiz.startAttempt(start)

    assert.deepEqual(result, { id: 'attempt' })
    assert.equal(requests[0].url.pathname, '/api/quizzes/attempts')
    assert.equal(requests[0].method, 'POST')
    assert.deepEqual(requests[0].body, start)
  })
}

for (const confidence of ['sure', 'think', 'guess', undefined] as const) {
  test(`answering with confidence ${confidence ?? 'omitted'} retains the answer fields`, async (t) => {
    const response = { id: 'attempt', completed: true }
    const requests = stubHttp(t, response)
    const answer = {
      question_id: 'question',
      option_id: 'option',
      ...(confidence === undefined ? {} : { confidence }),
    }

    const result = await quiz.answerQuestion('attempt/a', answer)

    assert.deepEqual(result, response)
    assert.equal(
      requests[0].url.pathname,
      '/api/quizzes/attempts/attempt%2Fa/answers',
    )
    assert.equal(requests[0].method, 'POST')
    assert.deepEqual(requests[0].body, answer)
  })
}

test('creating a classroom room sends the topic and title', async (t) => {
  const requests = stubHttp(t, { id: 'room', code: 'AB12CD' })

  const result = await quiz.createRoom('ch1', 'Class A')

  assert.deepEqual(result, { id: 'room', code: 'AB12CD' })
  assert.equal(requests[0].url.pathname, '/api/quizzes/rooms')
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].body, { topic_id: 'ch1', title: 'Class A' })
})

test('a closed room propagates the rejection without retrying the attempt', async (t) => {
  const requests = stubHttp(t, { detail: 'Room is closed' }, 409)

  await assert.rejects(quiz.startAttempt({ room_code: 'AB12CD' }), {
    status: 409,
    message: 'Room is closed',
  })

  assert.equal(requests.length, 1)
})

test('an aborted attempt read does not reach the network', async (t) => {
  const requests = stubHttp(t)
  const controller = new AbortController()
  controller.abort()

  await assert.rejects(quiz.getAttempt('attempt', controller.signal), {
    kind: 'aborted',
  })

  assert.equal(requests.length, 0)
})
