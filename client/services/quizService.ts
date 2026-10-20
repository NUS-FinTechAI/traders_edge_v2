import { api } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import type { components } from '../api/api-types.ts'
import { HttpError } from './httpService.ts'

export type QuizAttempt = components['schemas']['QuizAttemptResponse']
export type QuizRoom = components['schemas']['QuizRoomResponse']
export type QuizQuestion = components['schemas']['QuizQuestion']
export type QuizResult = components['schemas']['QuizResult']
export type QuizReport = components['schemas']['QuizRoomReport']
export type QuizForm = components['schemas']['QuizForm']
export type QuizAnswer = components['schemas']['Answer']
export type QuizCreateRoom = Omit<
  components['schemas']['CreateQuizRoom'],
  'idempotency_key'
>

export function requireQuizOwner(
  owner: string,
  getOwnerId: () => string | null,
) {
  if (getOwnerId() !== owner)
    throw new Error(
      'This quiz belongs to the previous signed-in account. Sign in with that account to confirm its saved action.',
    )
}

export async function readQuizAsOwner<T>(
  owner: string,
  getOwnerId: () => string | null,
  read: () => Promise<T>,
): Promise<T> {
  requireQuizOwner(owner, getOwnerId)
  try {
    const result = await read()
    requireQuizOwner(owner, getOwnerId)
    return result
  } catch (error) {
    requireQuizOwner(owner, getOwnerId)
    throw error
  }
}

function invalid(): never {
  throw new HttpError(
    'The saved quiz could not be read consistently.',
    'invalid-response',
  )
}

export function parseQuizAttempt(attempt: QuizAttempt): QuizAttempt {
  const { answered, total } = attempt.progress
  if (
    answered < 0 ||
    answered > total ||
    total < 1 ||
    (attempt.status === 'active'
      ? !attempt.current_question ||
        attempt.result !== null ||
        answered === total ||
        !!attempt.completed_questions?.length
      : attempt.current_question !== null ||
        !attempt.result ||
        answered !== total)
  )
    return invalid()
  if (
    attempt.result &&
    (attempt.result.feedback.length !== total ||
      attempt.result.first_answers.length !== total ||
      (attempt.room_id !== null && attempt.result.xp_earned !== 0))
  )
    return invalid()
  return structuredClone(attempt)
}

export async function getQuizAttempt(attemptId: string, signal?: AbortSignal) {
  const attempt = parseQuizAttempt(
    await api.call(apiEndpoints.getQuizAttempt, {
      path: { attempt_id: attemptId },
      signal,
    }),
  )
  if (attempt.id !== attemptId) return invalid()
  return attempt
}
export async function getQuizRoom(roomId: string, signal?: AbortSignal) {
  const room = await api.call(apiEndpoints.getQuizRoom, {
    path: { room_id: roomId },
    signal,
  })
  if (room.id !== roomId || room.private !== true || room.xp_rewards !== false)
    return invalid()
  return room
}
export const listQuizForms = (signal?: AbortSignal) =>
  api.call(apiEndpoints.listQuizForms, { signal })
export const listQuizAttempts = (signal?: AbortSignal) =>
  api.call(apiEndpoints.listQuizAttempts, { signal })
export const listQuizRooms = (signal?: AbortSignal) =>
  api.call(apiEndpoints.listQuizRooms, { signal })
export const getQuizBank = (signal?: AbortSignal) =>
  api.call(apiEndpoints.getQuizQuestionBank, { signal })
export const getQuizReport = (roomId: string, signal?: AbortSignal) =>
  api.call(apiEndpoints.getQuizRoomResults, {
    path: { room_id: roomId },
    signal,
  })

export type QuizAction =
  | { kind: 'start'; moduleId: string }
  | { kind: 'room-attempt'; roomId: string }
  | { kind: 'answer'; attemptId: string; answer: QuizAnswer }
  | { kind: 'create-room'; input: QuizCreateRoom }
  | { kind: 'join-room'; code: string }
  | { kind: 'start-room' | 'close-room'; roomId: string }
export type QuizCommand = { owner: string; key: string; action: QuizAction }
export type QuizCommandResult =
  { kind: 'attempt'; attempt: QuizAttempt } | { kind: 'room'; room: QuizRoom }

export async function sendQuizCommand(
  command: QuizCommand,
): Promise<QuizCommandResult> {
  const { action, key } = command
  const body = { idempotency_key: key }
  if (action.kind === 'start' || action.kind === 'room-attempt') {
    const receipt = parseQuizAttempt(
      await api.call(apiEndpoints.startQuizAttempt, {
        body: {
          ...body,
          ...(action.kind === 'start'
            ? { module_id: action.moduleId }
            : { room_id: action.roomId }),
        },
      }),
    )
    if (
      (action.kind === 'start' && receipt.room_id !== null) ||
      (action.kind === 'room-attempt' && receipt.room_id !== action.roomId)
    )
      return invalid()
    return { kind: 'attempt', attempt: receipt }
  }
  if (action.kind === 'answer') {
    const receipt = parseQuizAttempt(
      await api.call(apiEndpoints.submitQuizAnswer, {
        path: { attempt_id: action.attemptId },
        body: { ...body, answer: action.answer },
      }),
    )
    if (receipt.id !== action.attemptId) return invalid()
    return { kind: 'attempt', attempt: receipt }
  }
  let room: QuizRoom
  if (action.kind === 'create-room')
    room = await api.call(apiEndpoints.createQuizRoom, {
      body: { ...action.input, ...body },
    })
  else if (action.kind === 'join-room')
    room = await api.call(apiEndpoints.joinQuizRoom, {
      body: { ...body, join_code: action.code },
    })
  else
    room = await api.call(
      action.kind === 'start-room'
        ? apiEndpoints.startQuizRoom
        : apiEndpoints.closeQuizRoom,
      { path: { room_id: action.roomId }, body },
    )
  if (
    room.private !== true ||
    room.xp_rewards !== false ||
    ((action.kind === 'start-room' || action.kind === 'close-room') &&
      room.id !== action.roomId)
  )
    return invalid()
  return { kind: 'room', room }
}

export function quizError(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.status === 401)
      return 'Your session expired. Sign in again, then confirm any saved quiz action.'
    if (error.status === 503)
      return 'This quiz content is awaiting publication review.'
    if (typeof error.details === 'string') return error.details
    if (
      error.details &&
      typeof error.details === 'object' &&
      'message' in error.details &&
      typeof error.details.message === 'string'
    )
      return error.details.message
    if (error.status === 404)
      return 'This quiz or classroom is unavailable for your account.'
    if (error.status === 422)
      return 'Check the required quiz fields and choose a valid answer before trying again.'
  }
  return error instanceof Error && !(error instanceof HttpError)
    ? error.message
    : 'The request could not be confirmed. Confirm the saved action before choosing again.'
}

export function resumableQuiz(error: unknown): string | null {
  return error instanceof HttpError &&
    error.status === 409 &&
    error.details &&
    typeof error.details === 'object' &&
    'attempt_id' in error.details &&
    typeof error.details.attempt_id === 'string'
    ? error.details.attempt_id
    : null
}
