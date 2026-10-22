import type { Breadcrumb, Event } from '@sentry/react'

const BREADCRUMB_URLS = ['url', 'from', 'to']

/** Drops the query string and fragment, which can carry tokens or return paths. */
export function withoutQuery(url: string): string {
  return url.split(/[?#]/, 1)[0]
}

function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb {
  if (!crumb.data) return crumb
  const data = { ...crumb.data }
  for (const key of BREADCRUMB_URLS) {
    if (typeof data[key] === 'string') data[key] = withoutQuery(data[key])
  }
  return { ...crumb, data }
}

/** Keeps the page, browser and stack; drops cookies, other headers, bodies and query strings. */
export function scrubEvent<T extends Event>(event: T): T {
  const { request } = event
  if (request) {
    const userAgent = request.headers?.['User-Agent']
    event.request = {
      ...(request.url && { url: withoutQuery(request.url) }),
      ...(request.method && { method: request.method }),
      ...(userAgent && { headers: { 'User-Agent': userAgent } }),
    }
  }
  if (event.breadcrumbs)
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb)
  return event
}
