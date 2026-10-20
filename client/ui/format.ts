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
