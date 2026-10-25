import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  hasNewUnlocks,
  mergeUnlockKeys,
  unreadUnlocks,
  withoutSeenUnlocks,
} from '../app/unlockNotifications.ts'

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

test('repeated equip and view events queue each unlock only once', () => {
  const avatar = { category: 'cosmetics', item_id: 'parrot' }
  const theme = { category: 'cosmetics', item_id: 'candles' }
  let batch = mergeUnlockKeys([], [avatar])
  batch = mergeUnlockKeys(batch, [avatar, theme])
  batch = mergeUnlockKeys(batch, [theme, avatar])

  assert.deepEqual(batch, [avatar, theme])
})

test('local equip feedback removes the item and gallery dots while preserving other unread items', () => {
  const updated = withoutSeenUnlocks(player, [
    { category: 'cosmetics', item_id: 'parrot' },
  ])

  assert.deepEqual(unreadUnlocks(updated, 'cosmetics', 'avatars'), [])
  assert.equal(unreadUnlocks(updated, 'cosmetics', 'themes').length, 1)
  assert.equal(unreadUnlocks(updated, 'campaign').length, 1)
  assert.equal(unreadUnlocks(player).length, 3)
})

test('equipping the last unread cosmetic clears the profile indicator locally', () => {
  const updated = withoutSeenUnlocks(player, unreadUnlocks(player, 'cosmetics'))

  assert.deepEqual(unreadUnlocks(updated, 'cosmetics'), [])
  assert.equal(unreadUnlocks(updated, 'campaign').length, 1)
})

test('local clears survive profile refreshes until the batch is acknowledged', () => {
  const pending = [{ category: 'cosmetics', item_id: 'parrot' }]
  const refreshed = {
    ...player,
    unread_unlocks: [
      ...player.unread_unlocks,
      { category: 'cosmetics', group: 'titles', item_id: 'captain' },
    ],
  }

  const updated = withoutSeenUnlocks(refreshed, pending)

  assert.deepEqual(
    unreadUnlocks(updated, 'cosmetics').map((item) => item.item_id),
    ['candles', 'captain'],
  )
})

test('equal item ids in different unlock categories remain separate', () => {
  const keys = [
    { category: 'cosmetics', item_id: 'shared' },
    { category: 'campaign', item_id: 'shared' },
  ]

  assert.deepEqual(mergeUnlockKeys([], keys), keys)
})

test('clearing dots locally does not signal new content that needs another API refresh', () => {
  const updated = withoutSeenUnlocks(player, unreadUnlocks(player, 'cosmetics'))
  assert.equal(hasNewUnlocks(player, updated, 'cosmetics'), false)
})

test('genuinely new cosmetics still signal a collection refresh', () => {
  const updated = {
    unread_unlocks: [
      ...player.unread_unlocks,
      { category: 'cosmetics', group: 'titles', item_id: 'captain' },
    ],
  }
  assert.equal(hasNewUnlocks(player, updated, 'cosmetics'), true)
})
