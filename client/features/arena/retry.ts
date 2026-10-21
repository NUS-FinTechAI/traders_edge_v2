import { HttpError } from '../../services/httpService.ts'

/** Network trouble and server faults may clear up; refusals (4xx) will not. */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof HttpError)) return true
  if (error.kind === 'network' || error.kind === 'invalid-response') return true
  if (error.kind !== 'http' || error.status === null) return false
  return error.status >= 500 || error.status === 429 || error.status === 408
}

/** Back off 1.5 s, 3 s, 6 s … up to 15 s after consecutive failures. */
export function retryDelay(failures: number): number {
  return Math.min(15000, 1500 * 2 ** Math.max(0, failures - 1))
}
