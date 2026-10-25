import assert from 'node:assert/strict'
import { test } from 'node:test'
import { unreadUnlocks } from '../app/unlockNotifications.ts'

const player = {
  unread_unlocks: [
    { category: 'cosmetics', group: 'avatars', item_id: 'parrot' },
    { category: 'cosmetics', group: 'themes', item_id: 'candles' },
    { category: 'campaign', group: 'chapters', item_id: 'ch2' },
  ],
}

test('the unfiltered selector includes every supported unlock category', () => {
  assert.equal(unreadUnlocks(player).length, 3)
})

test('cosmetic indicators do not include other feature categories', () => {
  assert.deepEqual(
    unreadUnlocks(player, 'cosmetics').map((item) => item.item_id),
    ['parrot', 'candles'],
  )
})

test('gallery indicators include only their own new items', () => {
  assert.deepEqual(
    unreadUnlocks(player, 'cosmetics', 'themes').map((item) => item.item_id),
    ['candles'],
  )
  assert.deepEqual(unreadUnlocks(player, 'cosmetics', 'titles'), [])
})

test('signed-out and older cached profiles have no indicators', () => {
  assert.deepEqual(unreadUnlocks(null), [])
  assert.deepEqual(unreadUnlocks({}), [])
})
