import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JsxEmit, ModuleKind, transpileModule } from 'typescript'

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.css'))
      return { format: 'module', source: '', shortCircuit: true }
    if (url.endsWith('.tsx')) {
      const source = readFileSync(new URL(url), 'utf8')
      return {
        format: 'module',
        source: transpileModule(source, {
          compilerOptions: { jsx: JsxEmit.ReactJSX, module: ModuleKind.ESNext },
        }).outputText,
        shortCircuit: true,
      }
    }
    return nextLoad(url, context)
  },
})

const { default: ReadError } = await import(
  new URL('../components/adventure/read-error/ReadError.tsx', import.meta.url)
    .href
)
const { default: RouteError } = await import(
  new URL('../components/error-panel/RouteError.tsx', import.meta.url).href
)
const { HttpError } = await import('../services/httpService.ts')

test('section read failure renders an alert alongside existing content without recovery buttons', () => {
  const failure = new HttpError('Private server detail', 'http', 503)

  const html = renderToStaticMarkup(
    createElement(
      'section',
      null,
      createElement('h2', null, 'Chapter map'),
      createElement(ReadError, { error: failure }),
    ),
  )

  assert.match(html, /Chapter map/)
  assert.match(html, /role="alert"/)
  assert.doesNotMatch(html, /Private server detail|<button|route-error/)
})

test('essential read failure propagates the original error to the route boundary', () => {
  const failure = new HttpError('Unavailable', 'http', 503)

  assert.throws(
    () =>
      renderToStaticMarkup(
        createElement(ReadError, { error: failure, fatal: true }),
      ),
    (error) => error === failure,
  )
})

test('fatal fallback renders only the error state in the page content', () => {
  const html = renderToStaticMarkup(createElement(RouteError))

  assert.match(html, /<main class="route-error">/)
  assert.match(html, /role="alert"/)
  assert.doesNotMatch(html, /<button|<a |<h1/)
})
