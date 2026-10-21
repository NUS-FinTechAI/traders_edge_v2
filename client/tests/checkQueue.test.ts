import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  answerQueue,
  firstTryCount,
  startQueue,
} from '../features/level/checkQueue.ts'

test('a correct answer removes the question and extends the streak', () => {
  const state = answerQueue(startQueue(['q1', 'q2']), 'q1', true)

  assert.deepEqual(state.queue, ['q2'])
  assert.equal(state.streak, 1)
  assert.deepEqual(state.firstTry, { q1: true })
})

test('a wrong answer sends the question to the back and resets the streak', () => {
  const started = answerQueue(startQueue(['q1', 'q2', 'q3']), 'q1', true)

  const state = answerQueue(started, 'q2', false)

  assert.deepEqual(state.queue, ['q3', 'q2'])
  assert.equal(state.streak, 0)
})

test('only the first answer to a question counts as first-try accuracy', () => {
  let state = startQueue(['q1', 'q2'])
  state = answerQueue(state, 'q1', false)
  state = answerQueue(state, 'q2', true)
  state = answerQueue(state, 'q1', true)

  assert.deepEqual(state.queue, [])
  assert.deepEqual(state.firstTry, { q1: false, q2: true })
  assert.equal(firstTryCount(state), 1)
})
