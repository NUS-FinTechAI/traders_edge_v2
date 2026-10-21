/** Indicator maths for lesson charts. Undefined warm-up values are `null`. */
export type Series = (number | null)[]

/** Simple moving average over `period` values. */
export function sma(values: readonly number[], period: number): Series {
  const out: Series = values.map(() => null)
  let sum = 0
  values.forEach((value, i) => {
    sum += value
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  })
  return out
}

/**
 * Exponential moving average with alpha = 2 / (period + 1), seeded with the
 * SMA of the first `period` defined values. Leading nulls are skipped.
 */
export function ema(
  values: readonly (number | null)[],
  period: number,
): Series {
  const out: Series = values.map(() => null)
  const start = values.findIndex((value) => value !== null)
  if (start < 0 || values.length - start < period) return out
  const alpha = 2 / (period + 1)
  let seed = 0
  for (let i = start; i < start + period; i++) seed += values[i] as number
  let prev = seed / period
  out[start + period - 1] = prev
  for (let i = start + period; i < values.length; i++) {
    prev = alpha * (values[i] as number) + (1 - alpha) * prev
    out[i] = prev
  }
  return out
}

/** RSI with Wilder smoothing; the first value appears at index `period`. */
export function rsi(values: readonly number[], period = 14): Series {
  const out: Series = values.map(() => null)
  if (values.length <= period) return out
  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1]
    gain += Math.max(change, 0)
    loss += Math.max(-change, 0)
  }
  gain /= period
  loss /= period
  out[period] = rsiValue(gain, loss)
  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1]
    gain = (gain * (period - 1) + Math.max(change, 0)) / period
    loss = (loss * (period - 1) + Math.max(-change, 0)) / period
    out[i] = rsiValue(gain, loss)
  }
  return out
}

function rsiValue(gain: number, loss: number): number {
  if (loss === 0) return gain === 0 ? 50 : 100
  return 100 - 100 / (1 + gain / loss)
}

export interface Macd {
  macd: Series
  signal: Series
  hist: Series
}

/** MACD = EMA(fast) − EMA(slow); signal = EMA(signal) of MACD; histogram = MACD − signal. */
export function macd(
  values: readonly number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): Macd {
  const fastLine = ema(values, fast)
  const slowLine = ema(values, slow)
  const line: Series = values.map((_, i) => {
    const f = fastLine[i]
    const s = slowLine[i]
    return f === null || s === null ? null : f - s
  })
  const signal = ema(line, signalPeriod)
  const hist: Series = line.map((value, i) => {
    const s = signal[i]
    return value === null || s === null ? null : value - s
  })
  return { macd: line, signal, hist }
}

/** Indices where series `a` crosses `b`: up = a moves from ≤ b to > b. */
export function crossovers(
  a: Series,
  b: Series,
): { index: number; dir: 'up' | 'down' }[] {
  const out: { index: number; dir: 'up' | 'down' }[] = []
  for (let i = 1; i < a.length; i++) {
    const [a0, a1, b0, b1] = [a[i - 1], a[i], b[i - 1], b[i]]
    if (a0 === null || a1 === null || b0 === null || b1 === null) continue
    if (a0 <= b0 && a1 > b1) out.push({ index: i, dir: 'up' })
    else if (a0 >= b0 && a1 < b1) out.push({ index: i, dir: 'down' })
  }
  return out
}

/** Length of the longest run of consecutive values at or above `level`. */
export function longestRunAtOrAbove(series: Series, level: number) {
  let best = { start: -1, length: 0 }
  let start = -1
  series.forEach((value, i) => {
    if (value !== null && value >= level) {
      if (start < 0) start = i
      const length = i - start + 1
      if (length > best.length) best = { start, length }
    } else start = -1
  })
  return best
}
