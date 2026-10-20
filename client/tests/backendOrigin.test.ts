import assert from 'node:assert/strict'
import { test } from 'node:test'
import { backendOrigin } from '../services/backendOrigin.ts'

test('an explicit backend origin overrides local or hosted defaults', () => {
  assert.equal(
    backendOrigin('https://api.example.test', true, 'http://localhost:5173'),
    'https://api.example.test',
  )
})

test('development uses the frontend hostname with backend port 8000', () => {
  assert.equal(
    backendOrigin(undefined, true, 'http://127.0.0.1:5173'),
    'http://127.0.0.1:8000',
  )
})

test('development preserves an IPv6 hostname without constructing an invalid URL', () => {
  assert.equal(
    backendOrigin(undefined, true, 'http://[::1]:5173'),
    'http://[::1]:8000',
  )
})

test('a hosted build defaults to its own origin for reverse-proxied API routes', () => {
  assert.equal(
    backendOrigin(undefined, false, 'https://learn.example.test'),
    'https://learn.example.test',
  )
})

test('non-browser service consumers retain the local test origin', () => {
  assert.equal(backendOrigin(undefined, false), 'http://localhost:8000')
})
