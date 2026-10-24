import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  rewardToasts,
  takeUnseen,
  type SeenStore,
} from '../features/rewards/rewardToasts.ts'

const rewards = {
  badges: [{ id: 'risk-aware', name: 'Risk Aware' }],
  items: [
    { id: 'parrot', kind: 'avatar', name: 'Parrot', image: 'parrot' },
    { id: 'first-mate', kind: 'title', name: 'First Mate' },
  ],
}

function memoryStore(initial: string[] = []): SeenStore & { keys: string[] } {
  const store = {
    keys: initial,
    read: () => store.keys,
    write: (keys: string[]) => {
      store.keys = keys
    },
  }
  return store
}

test('every earned badge and item becomes a toast with its own heading', () => {
  const toasts = rewardToasts('g1', rewards)
  assert.deepEqual(
    toasts.map((toast) => [toast.key, toast.heading, toast.image]),
    [
      ['g1:avatar:parrot', 'New avatar unlocked', 'parrot'],
      ['g1:title:first-mate', 'New title unlocked', null],
      ['g1:badge:risk-aware', 'New badge unlocked', null],
    ],
  )
})

test('a game with no cosmetics makes no toasts', () => {
  assert.deepEqual(rewardToasts('g1', { badges: [], items: [] }), [])
})

test('an unknown item kind gets a generic heading', () => {
  const [toast] = rewardToasts('g1', {
    badges: [],
    items: [{ id: 'x', kind: 'sticker', name: 'X' }],
  })
  assert.equal(toast.heading, 'New reward unlocked')
})

test('rewards already shown are not toasted again', () => {
  const store = memoryStore()
  const toasts = rewardToasts('g1', rewards)
  assert.equal(takeUnseen(toasts, store).length, 3)
  assert.deepEqual(takeUnseen(toasts, store), [])
})

test('the same reward from a different game toasts again', () => {
  const store = memoryStore()
  takeUnseen(rewardToasts('g1', rewards), store)
  assert.equal(takeUnseen(rewardToasts('g2', rewards), store).length, 3)
})

test('the remembered keys stay bounded', () => {
  const store = memoryStore(Array.from({ length: 100 }, (_, i) => `old${i}`))
  takeUnseen(rewardToasts('g1', rewards), store)
  assert.equal(store.keys.length, 100)
  assert.equal(store.keys.at(-1), 'g1:badge:risk-aware')
})
