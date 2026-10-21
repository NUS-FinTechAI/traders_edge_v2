import httpService from './httpService.ts'
import type { components } from '../api/api-types.ts'

type Schemas = components['schemas']

export type QuizTopic = Schemas['QuizTopic']

export type QuizRoomSummary = Schemas['QuizRoomSummary']

export type QuizRoom = Schemas['QuizRoom']

export type QuizQuestion = Schemas['QuizQuestion']

export type QuizAttempt = Schemas['QuizAttempt']

export type Confidence = 'sure' | 'think' | 'guess'

export function getQuizzes(
  signal?: AbortSignal,
): Promise<{ topics: QuizTopic[]; rooms: QuizRoomSummary[] }> {
  return httpService.request<{
    topics: QuizTopic[]
    rooms: QuizRoomSummary[]
  }>('/api/quizzes', { signal })
}

export function startAttempt(
  start: { topic_id: string } | { room_code: string },
): Promise<QuizAttempt> {
  return httpService.request<QuizAttempt>('/api/quizzes/attempts', {
    method: 'POST',
    body: start,
  })
}

export function getAttempt(
  attemptId: string,
  signal?: AbortSignal,
): Promise<QuizAttempt> {
  return httpService.request<QuizAttempt>(
    `/api/quizzes/attempts/${encodeURIComponent(attemptId)}`,
    { signal },
  )
}

export function answerQuestion(
  attemptId: string,
  answer: { question_id: string; option_id: string; confidence?: Confidence },
): Promise<QuizAttempt> {
  return httpService.request<QuizAttempt>(
    `/api/quizzes/attempts/${encodeURIComponent(attemptId)}/answers`,
    { method: 'POST', body: answer },
  )
}

export function createRoom(topicId: string, title: string): Promise<QuizRoom> {
  return httpService.request<QuizRoom>('/api/quizzes/rooms', {
    method: 'POST',
    body: { topic_id: topicId, title },
  })
}

export function getRoom(
  roomId: string,
  signal?: AbortSignal,
): Promise<QuizRoom> {
  return httpService.request<QuizRoom>(
    `/api/quizzes/rooms/${encodeURIComponent(roomId)}`,
    { signal },
  )
}
