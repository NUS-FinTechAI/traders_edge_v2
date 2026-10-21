import assert from 'node:assert/strict'
import { test } from 'node:test'
import { THEMES, storedTheme, themeVars } from '../app/themes.ts'
import { pageTitle } from '../app/usePageTitle.ts'

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

test('each route has a page title naming the app', () => {
  assert.equal(pageTitle('/adventure'), 'Adventure · Trader’s Edge')
  assert.equal(pageTitle('/adventure/ch2'), 'Chapter map · Trader’s Edge')
  assert.equal(pageTitle('/'), 'Home · Trader’s Edge')
  assert.equal(pageTitle('/unknown'), 'Trader’s Edge')
})
