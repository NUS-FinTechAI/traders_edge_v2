import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pageTitle } from '../app/usePageTitle.ts'

test('each quiz section page has its own document title', () => {
  assert.equal(pageTitle('/quiz'), 'Quiz · Trader’s Edge')
  assert.equal(pageTitle('/quiz/daily'), 'Daily Quiz · Trader’s Edge')
  assert.equal(pageTitle('/quiz/chapters'), 'Chapter Quizzes · Trader’s Edge')
  assert.equal(pageTitle('/quiz/classroom'), 'Classroom · Trader’s Edge')
})

test('quiz attempts and class rooms keep their titles', () => {
  assert.equal(pageTitle('/quiz/attempt/a1'), 'Quiz · Trader’s Edge')
  assert.equal(pageTitle('/quiz/room/r1'), 'Class room · Trader’s Edge')
})

test('an unknown path falls back to the app name', () => {
  assert.equal(pageTitle('/nowhere'), 'Trader’s Edge')
})
