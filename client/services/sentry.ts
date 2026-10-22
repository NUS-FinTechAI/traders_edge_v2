import { captureException, captureReactException, init } from '@sentry/react'
import { scrubEvent } from './errorScrub.ts'

export { captureException, captureReactException }

/** Errors only: no tracing, session replay or personal data. */
export function startSentry(dsn: string): void {
  const env = import.meta.env
  init({
    dsn,
    environment: env.VITE_SENTRY_ENVIRONMENT || env.MODE,
    release: env.VITE_SENTRY_RELEASE || env.VERCEL_GIT_COMMIT_SHA || undefined,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { allow: ['User-Agent'] }, response: false },
      httpBodies: [],
      urlQueryParams: false,
    },
    beforeSend: scrubEvent,
  })
}
