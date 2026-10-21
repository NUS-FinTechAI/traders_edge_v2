import type { Candle } from './trading.ts'

/** Deterministic 32-bit PRNG (mulberry32) so charts never change per render. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round2 = (value: number) => Math.round(value * 100) / 100

/**
 * Candles that pass through the given closes. Each day opens near the previous
 * close and its wicks extend a little beyond the body.
 */
export function candlesFromCloses(
  closes: readonly number[],
  seed: number,
  wick = 0.006,
): Candle[] {
  const rand = seeded(seed)
  return closes.map((close, i) => {
    const prev = i === 0 ? close * (1 - (rand() - 0.5) * 0.01) : closes[i - 1]
    const open = round2(prev + (close - prev) * (rand() - 0.5) * 0.3)
    const top = Math.max(open, close)
    const bottom = Math.min(open, close)
    return {
      o: open,
      c: round2(close),
      h: round2(top + close * wick * (0.2 + rand())),
      l: round2(bottom - close * wick * (0.2 + rand())),
    }
  })
}

/** A random walk of closes with daily drift and volatility (fractions). */
export function walk(
  seed: number,
  length: number,
  start: number,
  drift: (day: number) => number,
  volatility: number,
): number[] {
  const rand = seeded(seed)
  const out = [start]
  for (let day = 1; day < length; day++) {
    const shock = (rand() + rand() + rand() - 1.5) * 2 * volatility
    out.push(round2(out[day - 1] * (1 + drift(day) + shock)))
  }
  return out
}

/** Linear interpolation through `[day, price]` anchor points with seeded noise. */
export function throughPoints(
  anchors: readonly (readonly [number, number])[],
  seed: number,
  noise = 0.004,
): number[] {
  const rand = seeded(seed)
  const out: number[] = []
  for (let k = 0; k < anchors.length - 1; k++) {
    const [d0, p0] = anchors[k]
    const [d1, p1] = anchors[k + 1]
    for (let d = d0; d < d1; d++) {
      const t = (d - d0) / (d1 - d0)
      const base = p0 + (p1 - p0) * t
      const jitter = d === d0 ? 0 : (rand() - 0.5) * 2 * noise * base
      out.push(round2(base + jitter))
    }
  }
  out.push(anchors[anchors.length - 1][1])
  return out
}

/** Mirror candles around a price so an up example becomes a down example. */
export function mirror(candles: readonly Candle[], around: number): Candle[] {
  return candles.map(({ o, h, l, c, v }) => ({
    o: round2(2 * around - o),
    h: round2(2 * around - l),
    l: round2(2 * around - h),
    c: round2(2 * around - c),
    v,
  }))
}
