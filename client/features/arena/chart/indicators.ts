export type Series = (number | null)[]

/** Simple moving average; `null` until `period` values exist. */
export function sma(values: number[], period: number): Series {
  const out: Series = []
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    out.push(i >= period - 1 ? sum / period : null)
  }
  return out
}

/** Exponential moving average seeded with the SMA of the first `period` values. */
export function ema(values: number[], period: number): Series {
  const out: Series = []
  const k = 2 / (period + 1)
  let previous: number | null = null
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null)
      continue
    }
    if (previous === null) {
      let sum = 0
      for (let j = i - period + 1; j <= i; j++) sum += values[j]
      previous = sum / period
    } else {
      previous = values[i] * k + previous * (1 - k)
    }
    out.push(previous)
  }
  return out
}

/** Wilder's relative strength index (0–100). */
export function rsi(values: number[], period = 14): Series {
  const out: Series = values.map(() => null)
  if (values.length <= period) return out
  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1]
    if (change > 0) gain += change
    else loss -= change
  }
  gain /= period
  loss /= period
  const value = () =>
    loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss)
  out[period] = value()
  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1]
    gain = (gain * (period - 1) + Math.max(change, 0)) / period
    loss = (loss * (period - 1) + Math.max(-change, 0)) / period
    out[i] = value()
  }
  return out
}

export interface Macd {
  macd: Series
  signal: Series
  histogram: Series
}

/** MACD line (fast EMA − slow EMA), its signal EMA and the histogram. */
export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): Macd {
  const fastLine = ema(values, fast)
  const slowLine = ema(values, slow)
  const line: Series = values.map((_, i) => {
    const a = fastLine[i]
    const b = slowLine[i]
    return a === null || b === null ? null : a - b
  })
  const start = line.findIndex((v) => v !== null)
  const signal: Series = values.map(() => null)
  if (start >= 0) {
    const tail = ema(line.slice(start) as number[], signalPeriod)
    tail.forEach((v, i) => {
      signal[start + i] = v
    })
  }
  const histogram: Series = line.map((v, i) => {
    const s = signal[i]
    return v === null || s === null ? null : v - s
  })
  return { macd: line, signal, histogram }
}

/** 4–6 round axis values covering [min, max]. */
export function niceTicks(min: number, max: number, target = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []
  if (max <= min) {
    const pad = Math.abs(min) * 0.01 || 1
    min -= pad
    max += pad
  }
  const intervals = Math.max(1, target - 1)
  const raw = (max - min) / intervals
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10]
    .map((m) => m * magnitude)
    .reduce((best, s) =>
      Math.abs((max - min) / s - intervals) <
      Math.abs((max - min) / best - intervals)
        ? s
        : best,
    )
  const first = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let v = first; v <= max + step * 1e-9; v += step) {
    ticks.push(Number(v.toFixed(10)))
  }
  return ticks
}
