export interface Scale {
  (value: number): number
  invert: (pixel: number) => number
}

export function linear(
  [d0, d1]: readonly [number, number],
  [r0, r1]: readonly [number, number],
): Scale {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0)
  const scale = ((value: number) => r0 + (value - d0) * k) as Scale
  scale.invert = (pixel: number) => (k === 0 ? d0 : d0 + (pixel - r0) / k)
  return scale
}

/** Round ticks (1, 2 or 5 × 10ⁿ) covering [min, max]. */
export function ticks(min: number, max: number, count = 4): number[] {
  const raw = (max - min) / Math.max(1, count)
  const power = 10 ** Math.floor(Math.log10(raw))
  const step =
    [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? 10 * power
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step)
    out.push(Math.round(v / step) * step)
  return out
}

/** Min and max of the given numbers, padded by a fraction of the range. */
export function extent(
  values: readonly (number | null)[],
  pad = 0.08,
): [number, number] {
  const defined = values.filter((v): v is number => v !== null)
  const lo = Math.min(...defined)
  const hi = Math.max(...defined)
  const room = (hi - lo || Math.abs(hi) || 1) * pad
  return [lo - room, hi + room]
}

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/** Evenly spaced bands for `count` days between x0 and x1. */
export function bands(count: number, x0: number, x1: number) {
  const step = (x1 - x0) / Math.max(1, count)
  return {
    x: (index: number) => x0 + step * (index + 0.5),
    step,
    body: Math.min(18, step * 0.6),
  }
}

/** Smooth SVG path through points (Catmull-Rom converted to cubic Béziers). */
export function smoothPath(points: readonly (readonly [number, number])[]) {
  if (points.length < 2) return ''
  const f = (n: number) => n.toFixed(1)
  let d = `M${f(points[0][0])},${f(points[0][1])}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`
  }
  return d
}

/** SVG path through defined points; gaps (null) start a new segment. */
export function linePath(
  values: readonly (number | null)[],
  x: (index: number) => number,
  y: (value: number) => number,
): string {
  let d = ''
  let pen = false
  values.forEach((value, i) => {
    if (value === null) {
      pen = false
      return
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(value).toFixed(1)}`
    pen = true
  })
  return d
}
