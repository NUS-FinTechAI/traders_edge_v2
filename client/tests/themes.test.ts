import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  BASE_THEMES,
  BASE_TOKENS,
  DEFAULT_BASE_THEME,
  THEMES,
  composeThemeVars,
  currentTheme,
  equipTheme,
  isThemeEquipped,
  storedTheme,
  themeFromQuery,
  themeSelection,
  themeVars,
} from '../app/themes.ts'
import { pageTitle } from '../app/usePageTitle.ts'

// Node has no localStorage without a flag; a Map stands in for the browser's.
const store = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
})

test('equipping a theme sets its properties and clears every other theme’s', () => {
  const vars = themeVars('theme-candles-ocean')

  assert.equal(vars['--candle-up'], '#4f9fd8')
  assert.equal(vars['--candle-down'], '#e8893a')
  assert.equal(vars['--gain'], null)
  assert.equal(vars['--text'], null)
})

test('no theme clears every themed property', () => {
  assert.ok(Object.values(themeVars(null)).every((value) => value === null))
})

test('the colour-blind palette swaps gains and losses to blue and orange', () => {
  const palette = THEMES.find(
    (theme) => theme.id === 'theme-palette-colorblind',
  )

  assert.equal(palette?.free, true)
  assert.equal(palette?.vars['--gain'], '#5aa9e6')
  assert.equal(palette?.vars['--loss'], '#f0a03c')
})

test('a signed-out visitor has no stored theme', () => {
  assert.equal(storedTheme(null), null)
})

test('three free base themes set every colour token, with Midnight Ledger first and default', () => {
  assert.deepEqual(
    BASE_THEMES.map((theme) => theme.id),
    ['midnight-ledger', 'parchment-day', 'harbor-dusk'],
  )
  assert.equal(BASE_THEMES[0].id, DEFAULT_BASE_THEME)
  for (const theme of BASE_THEMES) {
    assert.equal(theme.free, true)
    assert.deepEqual(Object.keys(theme.vars).sort(), [...BASE_TOKENS].sort())
  }
})

test('tokens.css first-paint values match the default theme', () => {
  const css = readFileSync(new URL('../ui/tokens.css', import.meta.url), 'utf8')
  const defaultTheme = BASE_THEMES.find(
    (theme) => theme.id === DEFAULT_BASE_THEME,
  )!
  const declared = new Map(
    [...css.matchAll(/^\s*(--[\w-]+|color-scheme):\s*([^;]+);/gm)].map(
      ([, name, value]) => [name, value.trim()],
    ),
  )
  for (const [name, value] of Object.entries(defaultTheme.vars)) {
    assert.equal(declared.get(name), value, name)
  }
})

test('a candle theme recolours candles only and keeps the base theme', () => {
  const vars = composeThemeVars({
    base: 'midnight-ledger',
    palette: null,
    candles: 'theme-candles-ocean',
  })

  assert.equal(vars['--bg'], '#101419')
  assert.equal(vars['--gain'], '#3fc1a5')
  assert.equal(vars['--candle-up'], '#4f9fd8')
  assert.equal(vars['--candle-down'], '#e8893a')
})

test('without a candle theme, candles follow the base or palette gain and loss', () => {
  const vars = composeThemeVars({
    base: 'harbor-dusk',
    palette: 'theme-palette-colorblind',
    candles: null,
  })

  assert.equal(vars['--candle-up'], null)
  assert.equal(vars['--gain'], '#5aa9e6')
  assert.equal(vars['--bg'], '#17131a')
})

test('palettes and candles adapt to the light base', () => {
  const vars = composeThemeVars({
    base: 'parchment-day',
    palette: 'theme-palette-high-contrast',
    candles: 'theme-candles-ink',
  })

  assert.equal(vars['color-scheme'], 'light')
  assert.equal(vars['--text'], '#000000')
  assert.equal(vars['--candle-up'], '#977a4b')
})

test('an unknown base falls back to the default', () => {
  const vars = composeThemeVars({ base: 'gone', palette: null, candles: null })
  const fallback = BASE_THEMES.find((theme) => theme.id === DEFAULT_BASE_THEME)!
  assert.equal(vars['--bg'], fallback.vars['--bg'])
})

test('a retired night-map choice in storage falls back to the default', () => {
  store.set(
    'traders-edge:themes:player-retired',
    JSON.stringify({ base: 'night-map', candles: 'theme-candles-ink' }),
  )

  assert.deepEqual(themeSelection('player-retired'), {
    base: DEFAULT_BASE_THEME,
    palette: null,
    candles: 'theme-candles-ink',
  })
})

test('a ?theme= link opens free themes only', () => {
  assert.equal(themeFromQuery('?theme=parchment-day'), 'parchment-day')
  assert.equal(
    themeFromQuery('?x=1&theme=theme-palette-colorblind'),
    'theme-palette-colorblind',
  )
  assert.equal(themeFromQuery('?theme=theme-candles-ocean'), null)
  assert.equal(themeFromQuery('?theme=unknown'), null)
  assert.equal(themeFromQuery('?theme=night-map'), null)
  assert.equal(themeFromQuery(''), null)
})

test('each kind has its own slot, and the standard choice clears them all', () => {
  const id = 'player-slots'
  assert.equal(themeSelection(id).base, DEFAULT_BASE_THEME)
  assert.ok(isThemeEquipped(id, null))

  equipTheme(id, 'harbor-dusk')
  equipTheme(id, 'theme-candles-sunset')
  equipTheme(id, 'theme-palette-colorblind')
  assert.deepEqual(themeSelection(id), {
    base: 'harbor-dusk',
    palette: 'theme-palette-colorblind',
    candles: 'theme-candles-sunset',
  })
  assert.equal(themeSelection(id), themeSelection(id))
  assert.ok(isThemeEquipped(id, 'harbor-dusk'))
  assert.equal(currentTheme(id), 'theme-candles-sunset')

  equipTheme(id, null, 'candles')
  assert.equal(themeSelection(id).candles, null)
  assert.equal(themeSelection(id).base, 'harbor-dusk')

  equipTheme(id, null)
  assert.ok(isThemeEquipped(id, null))
  assert.equal(currentTheme(id), null)
})

test('a theme stored before base themes existed is still applied', () => {
  store.set('traders-edge:theme:player-legacy', 'theme-candles-ink')
  assert.equal(themeSelection('player-legacy').candles, 'theme-candles-ink')
  assert.equal(themeSelection('player-legacy').base, DEFAULT_BASE_THEME)

  equipTheme('player-legacy', 'parchment-day')
  assert.equal(store.has('traders-edge:theme:player-legacy'), false)
  assert.deepEqual(themeSelection('player-legacy'), {
    base: 'parchment-day',
    palette: null,
    candles: 'theme-candles-ink',
  })
})

test('each route has a page title naming the app', () => {
  assert.equal(pageTitle('/adventure'), 'Adventure · Trader’s Edge')
  assert.equal(pageTitle('/adventure/ch2'), 'Chapter map · Trader’s Edge')
  assert.equal(pageTitle('/'), 'Home · Trader’s Edge')
  assert.equal(pageTitle('/unknown'), 'Trader’s Edge')
})
