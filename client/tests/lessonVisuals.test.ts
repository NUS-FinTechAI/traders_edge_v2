import assert from 'node:assert/strict'
import { test } from 'node:test'
import { seeded, walk } from '../features/level/visuals/shared/data.ts'
import {
  crossovers,
  ema,
  longestRunAtOrAbove,
  macd,
  rsi,
  sma,
} from '../features/level/visuals/shared/indicators.ts'
import {
  breakevenWinRate,
  fillOnFall,
  fillOnRise,
  marketBuy,
  ownershipPct,
  portfolioAfterCrash,
  positionSize,
  recoveryGainPct,
  rMultiple,
  type Candle,
} from '../features/level/visuals/shared/trading.ts'

const close = (actual: number | null, expected: number, digits = 6) =>
  assert.ok(
    actual !== null && Math.abs(actual - expected) < 10 ** -digits,
    `${actual} ≈ ${expected}`,
  )

test('a simple moving average starts after one full period', () => {
  assert.deepEqual(sma([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4])
})

test('an EMA is seeded with the SMA then weights each new value by 2/(n+1)', () => {
  const result = ema([1, 2, 3, 4, 5], 3)

  assert.deepEqual(result.slice(0, 2), [null, null])
  close(result[2], 2)
  close(result[3], 3)
  close(result[4], 4)
  close(ema([2, 4, 6, 10], 3)[3], 0.5 * 10 + 0.5 * 4)
})

test('an EMA skips leading nulls before seeding', () => {
  const result = ema([null, null, 3, 3, 3, 6], 3)

  assert.deepEqual(result.slice(0, 4), [null, null, null, null])
  close(result[4], 3)
  close(result[5], 4.5)
})

test('RSI uses Wilder smoothing of average gains and losses', () => {
  const values = [10, 11, 10.5, 11.5, 12, 11]
  const result = rsi(values, 3)

  // First averages over 3 changes: gains (1 + 0 + 1) / 3, losses 0.5 / 3.
  let gain = 2 / 3
  let loss = 0.5 / 3
  close(result[3], 100 - 100 / (1 + gain / loss))
  gain = (gain * 2 + 0.5) / 3
  loss = (loss * 2 + 0) / 3
  close(result[4], 100 - 100 / (1 + gain / loss))
  gain = (gain * 2 + 0) / 3
  loss = (loss * 2 + 1) / 3
  close(result[5], 100 - 100 / (1 + gain / loss))
  assert.deepEqual(result.slice(0, 3), [null, null, null])
})

test('RSI is 100 with only gains and 50 with no movement', () => {
  assert.equal(rsi([1, 2, 3, 4, 5], 3)[4], 100)
  assert.equal(rsi([5, 5, 5, 5], 3)[3], 50)
})

test('MACD is the 12/26 EMA difference with a 9-period signal', () => {
  const values = walk(5, 80, 50, () => 0.002, 0.01)
  const fast = ema(values, 12)
  const slow = ema(values, 26)
  const result = macd(values)

  assert.equal(result.macd[24], null)
  close(result.macd[25], (fast[25] as number) - (slow[25] as number))
  assert.equal(result.signal[32], null)
  const firstNine = result.macd.slice(25, 34) as number[]
  close(result.signal[33], firstNine.reduce((a, b) => a + b, 0) / 9)
  close(
    result.hist[60],
    (result.macd[60] as number) - (result.signal[60] as number),
  )
})

test('MACD of a flat series is zero', () => {
  const result = macd(Array.from({ length: 50 }, () => 20))

  close(result.macd[49], 0)
  close(result.hist[49], 0)
})

test('crossovers report the direction of each cross', () => {
  assert.deepEqual(crossovers([1, 3, 1], [2, 2, 2]), [
    { index: 1, dir: 'up' },
    { index: 2, dir: 'down' },
  ])
})

test('the longest run at or above a level is found with its start', () => {
  assert.deepEqual(longestRunAtOrAbove([null, 71, 75, 60, 70, 72, 80], 70), {
    start: 4,
    length: 3,
  })
})

test('the seeded generator repeats the same sequence for the same seed', () => {
  const a = seeded(42)
  const b = seeded(42)

  assert.deepEqual([a(), a(), a()], [b(), b(), b()])
})

test('ownership is shares divided by total shares', () => {
  close(ownershipPct(100, 1_000_000), 0.01)
})

test('recovering a 50% loss needs a 100% gain', () => {
  close(recoveryGainPct(50), 100)
  close(recoveryGainPct(20), 25)
  assert.equal(recoveryGainPct(100), Infinity)
})

test('a 2R plan breaks even at a one-in-three win rate', () => {
  close(rMultiple(50, 48, 54), 2)
  close(breakevenWinRate(2), 1 / 3)
})

test('position size divides the risk budget by the stop distance', () => {
  const size = positionSize(10_000, 1, 50, 48)

  assert.ok(size)
  assert.equal(size.shares, 50)
  close(size.risk, 100)
  close(size.value, 2_500)
  assert.equal(size.cappedByCash, false)
})

test('position size is capped by the cash available', () => {
  const size = positionSize(10_000, 5, 50, 49.9)

  assert.ok(size)
  assert.equal(size.shares, 200)
  assert.equal(size.cappedByCash, true)
})

test('position size rejects a stop at or above the entry', () => {
  assert.equal(positionSize(10_000, 1, 50, 50), null)
})

test('a market buy walks the asks and averages the fills', () => {
  const fill = marketBuy(
    [
      { price: 50.05, size: 100 },
      { price: 50.1, size: 200 },
    ],
    250,
  )

  assert.equal(fill.filled, 250)
  close(fill.average, 50.08)
  assert.equal(fill.unfilled, 0)
})

test('a market buy larger than the book leaves the rest unfilled', () => {
  const fill = marketBuy([{ price: 10, size: 5 }], 8)

  assert.equal(fill.filled, 5)
  assert.equal(fill.unfilled, 3)
})

const days: Candle[] = [
  { o: 50, h: 50.5, l: 49.5, c: 50 },
  { o: 49.8, h: 50, l: 47.6, c: 48 },
  { o: 46, h: 47, l: 39, c: 40 },
]

test('a sell stop fills at its level, or at the open after a gap through it', () => {
  assert.deepEqual(fillOnFall(days, 48, 1), { day: 1, price: 48 })
  assert.deepEqual(fillOnFall(days, 47, 1), { day: 2, price: 46 })
  assert.equal(fillOnFall(days, 30, 1), null)
})

test('a sell limit fills when the high reaches it, at the open if above', () => {
  assert.deepEqual(fillOnRise(days, 50.2), { day: 0, price: 50.2 })
  assert.deepEqual(fillOnRise(days, 49), { day: 0, price: 50 })
})

test('one 40% crash in five equal holdings costs 8% of the portfolio', () => {
  close(portfolioAfterCrash(10_000, 5, 40), 9_200)
  close(portfolioAfterCrash(10_000, 1, 40), 6_000)
})
