import { api } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import type { components } from '../api/api-types.ts'
import type { QuizAnswerConfidence } from '../api/api-enums.ts'

export { QuizAnswerConfidence } from '../api/api-enums.ts'

type Schemas = components['schemas']

export type QuizTopic = Schemas['QuizTopic']

export type QuizRoomSummary = Schemas['QuizRoomSummary']

export type QuizRoom = Schemas['QuizRoom']

export type QuizQuestion = Schemas['QuizQuestion']

export type QuizAttempt = Schemas['QuizAttempt']

export function getQuizzes(
  signal?: AbortSignal,
): Promise<{ topics: QuizTopic[]; rooms: QuizRoomSummary[] }> {
  return api.call(apiEndpoints.listQuizzes, { signal })
}

export function startAttempt(
  start: { topic_id: string } | { room_code: string },
): Promise<QuizAttempt> {
  return api.call(apiEndpoints.startQuizAttempt, { body: start })
}

export function getAttempt(
  attemptId: string,
  signal?: AbortSignal,
): Promise<QuizAttempt> {
  return api.call(apiEndpoints.getQuizAttempt, {
    path: { attempt_id: attemptId },
    signal,
  })
}

export function answerQuestion(
  attemptId: string,
  answer: {
    question_id: string
    option_id: string
    confidence?: QuizAnswerConfidence
  },
): Promise<QuizAttempt> {
  return api.call(apiEndpoints.answerQuiz, {
    path: { attempt_id: attemptId },
    body: answer,
  })
}

export function createRoom(topicId: string, title: string): Promise<QuizRoom> {
  return api.call(apiEndpoints.createQuizRoom, {
    body: { topic_id: topicId, title },
  })
}

export function getRoom(
  roomId: string,
  signal?: AbortSignal,
): Promise<QuizRoom> {
  return api.call(apiEndpoints.getQuizRoom, {
    path: { room_id: roomId },
    signal,
  })
}
