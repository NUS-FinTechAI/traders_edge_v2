import { HttpError } from './httpService.ts'

export function waitForRequest<T>(
  request: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) return request
  if (signal.aborted)
    return Promise.reject(new HttpError('Request cancelled', 'aborted'))
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new HttpError('Request cancelled', 'aborted'))
    signal.addEventListener('abort', abort, { once: true })
    void request.then(
      (value) => {
        signal.removeEventListener('abort', abort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort)
        reject(error)
      },
    )
  })
}
