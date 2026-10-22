import assert from 'node:assert/strict'
import { test } from 'node:test'
import { topicListPath } from '../features/quiz/paths.ts'

test('a chapter quiz returns to the chapter quizzes page', () => {
  assert.equal(topicListPath('chapter-3'), '/quiz/chapters')
})

test('the daily review and mixed quiz return to the daily quiz page', () => {
  assert.equal(topicListPath('daily-review'), '/quiz/daily')
  assert.equal(topicListPath('mixed'), '/quiz/daily')
})

test('an attempt without a topic returns to the quiz hub', () => {
  assert.equal(topicListPath(null), '/quiz')
})
