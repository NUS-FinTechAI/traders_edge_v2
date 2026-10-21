const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const wholeMoney = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const count = new Intl.NumberFormat('en-US')

export function formatMoney(value: number, whole = false): string {
  return (whole ? wholeMoney : money).format(value)
}

/** Signed money with a true minus sign, e.g. "+$12.40" or "−$3.10". */
export function formatSignedMoney(value: number, whole = false): string {
  const text = formatMoney(Math.abs(value), whole)
  if (Math.abs(value) < 0.005) return text
  return `${value > 0 ? '+' : '−'}${text}`
}

export function formatPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

export function formatSignedPct(value: number, digits = 1): string {
  if (Math.abs(value) < 0.5 * 10 ** -digits) return formatPct(0, digits)
  return `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}%`
}

export function formatCount(value: number): string {
  return count.format(value)
}

export function tone(value: number): 'gain' | 'loss' | 'flat' {
  if (value > 0.004) return 'gain'
  if (value < -0.004) return 'loss'
  return 'flat'
}

/** Local clock time such as "14:30" (never a countdown). */
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Short local date such as "Mon 26 Oct". */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** Elapsed time as "m:ss". */
export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** UTC calendar date (YYYY-MM-DD) for a timestamp. */
export function utcDate(time = Date.now()): string {
  return new Date(time).toISOString().slice(0, 10)
}
