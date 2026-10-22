import type { ErrorInfo } from 'react'
import type { RootOptions } from 'react-dom/client'

type Sentry = typeof import('./sentry.ts')

let sentry: Promise<Sentry> | undefined
const reported = new WeakSet<object>()

/** Loads Sentry only when VITE_SENTRY_DSN is set; without it the SDK is left out of the build. */
export function startMonitoring(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return
  sentry = import('./sentry.ts').then((module) => {
    module.startSentry(dsn)
    return module
  })
}

/** Reports an error once, even when React and the route boundary both see it. */
export function reportError(error: unknown, info?: ErrorInfo): void {
  if (!sentry) return
  if (typeof error === 'object' && error !== null) {
    if (reported.has(error)) return
    reported.add(error)
  }
  void sentry.then((module) =>
    info
      ? module.captureReactException(error, info)
      : module.captureException(error),
  )
}

/** Root callbacks that keep React's console output and also report the error. */
export function reactErrorHandlers(): RootOptions {
  if (!sentry) return {}
  const report = (error: unknown, info: ErrorInfo) => {
    console.error(error)
    reportError(error, info)
  }
  return { onCaughtError: report, onUncaughtError: report }
}
