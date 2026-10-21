import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildHeatmap } from '../features/profile/heatmap.ts'

// 2026-10-21 is a Wednesday.
const TODAY = '2026-10-21'

test('the grid ends on today with Monday-first rows and no future days', () => {
  const map = buildHeatmap([], 2, TODAY)

  assert.equal(map.columns.length, 2)
  assert.equal(map.columns[0][0]?.date, '2026-10-12')
  assert.equal(map.columns[1][2]?.date, TODAY)
  assert.equal(map.columns[1][3], null)
})

test('activity counts become levels relative to the busiest day', () => {
  const map = buildHeatmap(
    [
      { date: '2026-10-19', count: 8 },
      { date: '2026-10-20', count: 1 },
      { date: '2025-01-01', count: 99 },
    ],
    1,
    TODAY,
  )

  assert.equal(map.columns[0][0]?.level, 4)
  assert.equal(map.columns[0][1]?.level, 1)
  assert.equal(map.columns[0][2]?.level, 0)
  assert.equal(map.activeDays, 2)
})

test('a month label marks the first week of each new month', () => {
  const map = buildHeatmap([], 6, TODAY)

  assert.deepEqual(
    map.months.map(({ label }) => label),
    ['Sep', 'Oct'],
  )
})
