import { api } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import { HttpError } from './httpService.ts'

export type LessonSimulation = {
  id: string
  runId: string
  tick: number
  finished: boolean
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>

function invalid(): never {
  throw new HttpError(
    'The saved simulation could not be verified.',
    'invalid-response',
  )
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid()
  return value as Record<string, unknown>
}

function parseSession(value: unknown, runId: string): LessonSimulation {
  const session = record(value)
  const policy = record(session.bound_policy)
  if (
    typeof session.id !== 'string' ||
    !session.id ||
    policy.run_id !== runId ||
    policy.session_id !== session.id ||
    session.mode !== 'guided' ||
    typeof session.tick !== 'number' ||
    !Number.isInteger(session.tick) ||
    session.tick < 0 ||
    typeof session.finished !== 'boolean'
  )
    return invalid()
  return {
    id: session.id,
    runId,
    tick: session.tick,
    finished: session.finished,
  }
}

export async function resumeLessonSimulation(
  runId: string,
  signal?: AbortSignal,
) {
  return parseSession(
    await api.call(apiEndpoints.resumeLearningSimulation, {
      path: { run_id: runId },
      signal,
    }),
    runId,
  )
}

export async function openLessonSimulation(
  owner: string,
  runId: string,
  storage: Storage,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted()
  const storageKey = `adventure-simulation:${encodeURIComponent(owner)}:${encodeURIComponent(runId)}:bind`
  const key = storage.getItem(storageKey) ?? crypto.randomUUID()
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(key)) return invalid()
  // Retain the key for this run so interrupted starts always recover the same binding.
  storage.setItem(storageKey, key)
  const bound = parseSession(
    await api.call(apiEndpoints.bindLearningSimulation, {
      path: { run_id: runId },
      body: { idempotency_key: key },
      signal,
    }),
    runId,
  )
  // A committed bind response can be old; resume supplies the current observation.
  const current = await resumeLessonSimulation(runId, signal)
  if (current.id !== bound.id) return invalid()
  return current
}
