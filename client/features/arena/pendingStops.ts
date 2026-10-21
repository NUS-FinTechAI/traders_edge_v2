/** A stop-loss to place once the buy it protects has filled. */
export interface PendingStop {
  symbol: string
  qty: number
  stop: number
}

const key = (gameId: string) => `traders-edge:pending-stops:${gameId}`

/** Pending stops survive a reload in this tab; storage failures are ignored. */
export function loadPendingStops(gameId: string): Map<string, PendingStop> {
  try {
    const raw = sessionStorage.getItem(key(gameId))
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object') return new Map()
    return new Map(
      Object.entries(parsed as Record<string, PendingStop>).filter(
        ([, value]) =>
          value &&
          typeof value.symbol === 'string' &&
          Number.isFinite(value.qty) &&
          Number.isFinite(value.stop),
      ),
    )
  } catch {
    return new Map()
  }
}

export function savePendingStops(
  gameId: string,
  stops: Map<string, PendingStop>,
): void {
  try {
    if (stops.size)
      sessionStorage.setItem(
        key(gameId),
        JSON.stringify(Object.fromEntries(stops)),
      )
    else sessionStorage.removeItem(key(gameId))
  } catch {
    // Without storage the stop is still placed while this page stays open.
  }
}

/** Stable idempotency key for the stop protecting buy order `orderId`. */
export function stopOrderKey(orderId: string): string {
  return `stop-${orderId.replace(/[^a-zA-Z0-9_-]/g, '')}`.slice(0, 64)
}
