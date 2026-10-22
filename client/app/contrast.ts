/** WCAG 2.x contrast maths for the theme tests and docs; pure, no DOM. */

/** Parse `#rgb`, `#rrggbb` or `#rrggbbaa` (alpha ignored) into 0–255 channels. */
export function parseHex(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(hex.trim())
  if (!match) throw new Error(`Not a hex colour: ${hex}`)
  let digits = match[1]
  if (digits.length === 3) digits = [...digits].map((d) => d + d).join('')
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ]
}

/** Relative luminance as defined by WCAG 2.x. */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((channel) => {
    const c = channel / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Contrast ratio between two colours, from 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Body text needs 4.5:1; large text and UI boundaries need 3:1. */
export const AA_TEXT = 4.5
export const AA_LARGE = 3
