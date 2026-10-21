import httpService from './httpService.ts'

export interface QuizTopic {
  id: string
  kind: 'chapter' | 'review' | 'mixed'
  title: string
  questions: number
  best: number | null
  passed: boolean
  locked: boolean
}

export interface QuizRoomSummary {
  id: string
  title: string
  code: string
  is_host: boolean
  members: number
}

export interface QuizRoom extends QuizRoomSummary {
  topic_title: string
  /** The host sees every member; members see only their own row. */
  results: {
    name: string
    score: number | null
    total: number
    finished: boolean
  }[]
  my_attempt_id: string | null
}

export interface QuizAnswer {
  option_id: string
  correct: boolean
  correct_option_id: string
  explanation: string
}

export interface QuizQuestion {
  id: string
  prompt: string
  options: { id: string; text: string }[]
  answered: QuizAnswer | null
}

export interface QuizAttempt {
  id: string
  title: string
  room_id: string | null
  status: 'active' | 'complete'
  questions: QuizQuestion[]
  score: number
  total: number
  passed: boolean | null
  xp: number
}

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
