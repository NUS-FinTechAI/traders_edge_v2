import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AA_LARGE, AA_TEXT, contrast, luminance } from '../app/contrast.ts'
import { BASE_THEMES, THEMES, composeThemeVars } from '../app/themes.ts'

const SURFACES = [
  '--bg',
  '--bg-elev',
  '--surface',
  '--surface-2',
  '--surface-3',
]
const CARD_SURFACES = ['--bg', '--surface', '--surface-2']
const STATES = ['--gold', '--cash', '--gain', '--loss', '--info', '--warning']

const ratio = (vars: Record<string, string | null>, a: string, b: string) =>
  contrast(vars[a]!, vars[b]!)

function expectAtLeast(
  label: string,
  vars: Record<string, string | null>,
  pairs: Array<[string, string]>,
  min: number,
) {
  for (const [a, b] of pairs) {
    const value = ratio(vars, a, b)
    assert.ok(
      value >= min,
      `${label}: ${a} on ${b} is ${value.toFixed(2)}:1, needs ${min}:1`,
    )
  }
}

test('contrast follows the WCAG formula', () => {
  assert.equal(contrast('#000000', '#ffffff'), 21)
  assert.equal(contrast('#fff', '#ffffff'), 1)
  assert.equal(contrast('#767676', '#ffffff').toFixed(2), '4.54')
  assert.equal(luminance('#ffffffcc'), 1)
  assert.throws(() => luminance('teal'))
})

for (const base of BASE_THEMES) {
  const vars = composeThemeVars({ base: base.id, palette: null, candles: null })

  test(`${base.name}: body text meets AA on every surface`, () => {
    const pairs = ['--text', '--text-muted', '--text-dim'].flatMap((text) =>
      SURFACES.map((surface): [string, string] => [text, surface]),
    )
    expectAtLeast(base.name, vars, pairs, AA_TEXT)
  })

  test(`${base.name}: state and currency text meets AA on cards and chips`, () => {
    const pairs: Array<[string, string]> = [
      ...[...STATES, '--gem-text'].flatMap((token) =>
        CARD_SURFACES.map((surface): [string, string] => [token, surface]),
      ),
      ...STATES.map((token): [string, string] => [token, `${token}-soft`]),
      ['--gem-text', '--gem-soft'],
    ]
    expectAtLeast(base.name, vars, pairs, AA_TEXT)
  })

  test(`${base.name}: text on solid buttons meets AA`, () => {
    expectAtLeast(
      base.name,
      vars,
      [
        ['--on-primary', '--primary'],
        ['--on-primary', '--primary-hover'],
        ['--on-gold', '--gold'],
        ['--on-gain', '--gain'],
        ['--on-loss', '--loss'],
      ],
      AA_TEXT,
    )
  })

  test(`${base.name}: inputs, focus ring and candles reach 3:1`, () => {
    const pairs = ['--border-input', '--gold', '--gain', '--loss'].flatMap(
      (token) =>
        CARD_SURFACES.map((surface): [string, string] => [token, surface]),
    )
    expectAtLeast(base.name, vars, pairs, AA_LARGE)
  })

  test(`${base.name}: gains and losses differ in lightness, not hue alone`, () => {
    assert.ok(ratio(vars, '--gain', '--loss') >= 1.15)
  })

  for (const palette of THEMES.filter((theme) => theme.kind === 'palette')) {
    test(`${base.name} + ${palette.name}: text, gains and losses meet AA`, () => {
      const composed = composeThemeVars({
        base: base.id,
        palette: palette.id,
        candles: null,
      })
      const label = `${base.name} + ${palette.name}`
      const text = ['--text', '--text-muted', '--text-dim', '--gain', '--loss']
      const pairs = text.flatMap((token) =>
        CARD_SURFACES.map((surface): [string, string] => [token, surface]),
      )
      expectAtLeast(label, composed, pairs, AA_TEXT)
      expectAtLeast(
        label,
        composed,
        [['--border-input', '--surface']],
        AA_LARGE,
      )
    })
  }

  for (const candles of THEMES.filter((theme) => theme.kind === 'candles')) {
    test(`${base.name} + ${candles.name}: candles reach 3:1`, () => {
      const composed = composeThemeVars({
        base: base.id,
        palette: null,
        candles: candles.id,
      })
      const pairs = ['--candle-up', '--candle-down'].flatMap((token) =>
        ['--bg', '--surface'].map((surface): [string, string] => [
          token,
          surface,
        ]),
      )
      expectAtLeast(`${base.name} + ${candles.name}`, composed, pairs, AA_LARGE)
    })
  }
}
