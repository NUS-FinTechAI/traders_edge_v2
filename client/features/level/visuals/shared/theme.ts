/** Night-map tokens for SVG paint (applied through `style`, not attributes). */
export const C = {
  bg: 'var(--bg-elev)',
  surface: 'var(--surface)',
  surface2: 'var(--surface-2)',
  surface3: 'var(--surface-3)',
  border: 'var(--border)',
  borderStrong: 'var(--border-strong)',
  text: 'var(--text)',
  muted: 'var(--text-muted)',
  dim: 'var(--text-dim)',
  gold: 'var(--gold)',
  goldSoft: 'var(--gold-soft)',
  gain: 'var(--gain)',
  gainSoft: 'var(--gain-soft)',
  loss: 'var(--loss)',
  candleUp: 'var(--candle-up)',
  candleDown: 'var(--candle-down)',
  lossSoft: 'var(--loss-soft)',
  info: 'var(--info)',
  infoSoft: 'var(--info-soft)',
  gem: 'var(--gem)',
  gemSoft: 'var(--gem-soft)',
} as const

/** Arrow glyph so direction never relies on colour alone. */
export const arrow = (value: number) =>
  value > 0.0001 ? '▲' : value < -0.0001 ? '▼' : '•'

export const signColor = (value: number) =>
  value > 0.0001 ? C.gain : value < -0.0001 ? C.loss : C.muted
