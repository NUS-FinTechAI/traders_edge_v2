import assert from 'node:assert/strict'
import { test } from 'node:test'
import { layoutMap } from '../features/adventure/mapLayout.ts'

const nodes = [
  { id: 'preview', kind: 'preview' },
  { id: 'l1', kind: 'level' },
  { id: 'l1-reward', kind: 'reward' },
  { id: 'l2', kind: 'level' },
  { id: 'boss', kind: 'boss' },
]

test('main nodes advance along the path and alternate sides', () => {
  const layout = layoutMap(nodes, false)
  const [preview, l1, , l2, boss] = layout.placed

  assert.ok(preview.y < l1.y && l1.y < l2.y && l2.y < boss.y)
  assert.notEqual(preview.x, l1.x)
  assert.equal(preview.x, l2.x)
  assert.equal(layout.trail.length, 3)
})

test('a reward node sits beside its level and joins it with a branch', () => {
  const layout = layoutMap(nodes, true)
  const level = layout.placed[1]
  const reward = layout.placed[2]

  assert.equal(reward.node.id, 'l1-reward')
  assert.equal(reward.x, level.x)
  assert.notEqual(reward.y, level.y)
  assert.deepEqual(reward.branchFrom, { x: level.x, y: level.y })
  assert.deepEqual(
    layout.branches.map(({ to }) => to),
    [2],
  )
})

test('every placed node fits inside the layout bounds', () => {
  for (const horizontal of [false, true]) {
    const layout = layoutMap(nodes, horizontal)
    for (const place of layout.placed) {
      assert.ok(place.x > 0 && place.x < layout.width)
      assert.ok(place.y > 0 && place.y < layout.height)
    }
  }
})
