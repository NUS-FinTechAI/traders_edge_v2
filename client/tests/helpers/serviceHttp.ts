import type { TestContext } from 'node:test'
import firebaseService from '../../services/firebaseService.ts'

export interface RecordedRequest {
  url: URL
  method: string
  body: unknown
  signal: AbortSignal | null | undefined
  headers: Headers
}

export function stubHttp(t: TestContext, response: unknown = {}, status = 200) {
  const requests: RecordedRequest[] = []
  t.mock.method(firebaseService, 'getAccessToken', async () => 'test-token')
  t.mock.method(
    globalThis,
    'fetch',
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      requests.push({
        url: new URL(String(input)),
        method: init?.method ?? 'GET',
        body:
          init?.body === undefined ? undefined : JSON.parse(String(init.body)),
        signal: init?.signal,
        headers: new Headers(init?.headers),
      })
      return response instanceof Response
        ? response
        : Response.json(response, { status })
    },
  )
  return requests
}
