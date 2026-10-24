/**
 * Drops the query string and fragment from a page URL before it is reported,
 * so join codes, tokens and other parameters never reach analytics.
 */
export function stripUrl(url: string): string {
  const end = url.search(/[?#]/)
  return end === -1 ? url : url.slice(0, end)
}

/** `beforeSend` hook shared by Vercel Web Analytics and Speed Insights. */
export function scrubEvent<T extends { url: string }>(event: T): T {
  return { ...event, url: stripUrl(event.url) }
}
