import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  chapterOf,
  equitySeries,
  executionPrice,
  fee,
  hasCents,
  levelOf,
  maxAffordable,
  money,
  positionCapQty,
  quote,
  rankHeadline,
  riskIfStopped,
} from '../features/arena/arenaLogic.ts'
import {
  ema,
  macd,
  niceTicks,
  rsi,
  sma,
} from '../features/arena/chart/indicators.ts'
import type {
  GameResult,
  LeaderboardEntry,
  Me,
  Order,
} from '../services/gameService.ts'

const scenario = { fee: { rate: 0.001, min: 1 }, spread: 0.002 }

function entry(
  name: string,
  rank: number,
  profit: number,
  isMe = false,
): LeaderboardEntry {
  return {
    participant_id: name,
    name,
    kind: isMe ? 'human' : 'bot',
    bot_id: isMe ? null : name,
    avatar: null,
    style: null,
    tier: null,
    profit,
    rank,
    is_me: isMe,
    forfeited: false,
  }
}

function result(
  rank: number,
  leaderboard: LeaderboardEntry[],
  extra: Partial<GameResult> = {},
): GameResult {
  return {
    won: rank === 1 && leaderboard.filter((e) => e.rank === 1).length === 1,
    rank,
    of: leaderboard.length,
    forfeited: false,
    profit: leaderboard.find((e) => e.is_me)?.profit ?? 0,
    profit_pct: 0,
    leaderboard,
    missions: [],
    stars: null,
    rewards: { xp: 0, stocks: 0, gems: 0, items: [], badges: [] },
    plan_review: null,
    decision_score: 50,
    decision_breakdown: { missions: 20, plan: 25, risk: 0, overtrading: 5 },
    key_moments: [],
    stats: {
      trades: 0,
      fees: 0,
      biggest_position_pct: 0,
      max_drawdown_pct: 0,
      buy_hold_profit: 0,
    },
    debrief: '',
    unlocked: null,
    ...extra,
  }
}

test('max affordable shares leave room for the percentage fee', () => {
  assert.equal(maxAffordable(10000, 50, scenario), 199)
})

test('max affordable shares respect the minimum fee on small orders', () => {
  assert.equal(maxAffordable(101, 50, scenario), 2)
  assert.equal(maxAffordable(100.5, 50, scenario), 1)
})

test('max affordable shares are zero without cash or price', () => {
  assert.equal(maxAffordable(0, 50, scenario), 0)
  assert.equal(maxAffordable(1000, 0, scenario), 0)
})

test('risk if stopped includes the exit spread and both fees', () => {
  const risk = riskIfStopped(10, 50, 45, scenario, 10000)

  const exit = 44.96
  const expected = 10 * (50 - exit) + 1 + 1
  assert.ok(Math.abs(risk.amount - expected) < 1e-9)
  assert.ok(Math.abs(risk.pct - expected / 100) < 1e-9)
})

test('the headline names the leader and the gap when the player is not first', () => {
  const board = [entry('Momentum Max', 1, 410), entry('You', 2, 200, true)]

  assert.equal(
    rankHeadline(result(2, board)),
    '2nd of 2 — Momentum Max finished $210.00 ahead',
  )
})

test('a shared first place against AI is called out as not a win', () => {
  const board = [entry('You', 1, 100, true), entry('Hannah', 1, 100)]

  assert.equal(
    rankHeadline(result(1, board)),
    'Tied for 1st — a tie isn’t a win against AI',
  )
})

test('an outright first place says every rival was beaten', () => {
  const board = [entry('You', 1, 300, true), entry('Hannah', 2, 100)]

  assert.equal(
    rankHeadline(result(1, board)),
    'You finished 1st of 2 — you beat every rival!',
  )
})

test('a forfeit headline ranks the player last', () => {
  const board = [entry('Hannah', 1, 100), entry('You', 2, 0, true)]

  assert.match(
    rankHeadline(result(2, board, { forfeited: true })),
    /rank 2nd of 2/,
  )
})

test('a solo mission headline does not mention rivals', () => {
  assert.equal(
    rankHeadline(result(1, [entry('You', 1, 120, true)])),
    'Mission complete',
  )
})

test('chapter and level ids fall back to the scenario id prefix', () => {
  const state = { scenario: { id: 'ch2-l3-practice' } }

  assert.equal(chapterOf(state), 'ch2')
  assert.equal(levelOf(state), 'ch2-l3')
  assert.equal(chapterOf({ scenario: { id: 'practice-trend-rider' } }), null)
  assert.equal(
    chapterOf({ chapter_id: 'ch5', scenario: { id: 'ch2-l3' } }),
    'ch5',
  )
})

test('the equity series replays fills against each day’s close', () => {
  const bars = {
    LEAF: [
      { t: 0, o: 10, h: 10, l: 10, c: 10, v: 1 },
      { t: 1, o: 12, h: 12, l: 12, c: 12, v: 1 },
      { t: 2, o: 9, h: 9, l: 9, c: 9, v: 1 },
    ],
  }
  const fills = [
    {
      order_id: 'a',
      t: 0,
      symbol: 'LEAF',
      side: 'buy' as const,
      qty: 10,
      price: 10,
      fee: 1,
    },
    {
      order_id: 'b',
      t: 1,
      symbol: 'LEAF',
      side: 'sell' as const,
      qty: 10,
      price: 12,
      fee: 1,
    },
  ]

  const series = equitySeries(1000, fills, bars, 2)

  assert.deepEqual(
    series.map((p) => p.value),
    [999, 1018, 1018],
  )
})

test('simple and exponential averages start once the period is filled', () => {
  assert.deepEqual(sma([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5])
  const line = ema([1, 2, 3, 4], 2)
  assert.equal(line[0], null)
  assert.equal(line[1], 1.5)
  assert.ok(Math.abs((line[2] as number) - 2.5) < 1e-9)
})

test('RSI is 100 for a steady rise and 0 for a steady fall', () => {
  const rising = Array.from({ length: 20 }, (_, i) => 10 + i)
  const falling = [...rising].reverse()

  assert.equal(rsi(rising)[14], 100)
  assert.equal(rsi(falling)[19], 0)
  assert.equal(rsi(rising.slice(0, 14))[13], null)
})

test('MACD histogram is the line minus its signal', () => {
  const closes = Array.from({ length: 60 }, (_, i) => 50 + Math.sin(i / 4) * 3)

  const { macd: line, signal, histogram } = macd(closes)

  assert.equal(line[24], null)
  assert.notEqual(line[25], null)
  assert.equal(signal[32], null)
  assert.notEqual(signal[33], null)
  const i = 50
  assert.ok(
    Math.abs(
      (histogram[i] as number) - ((line[i] as number) - (signal[i] as number)),
    ) < 1e-9,
  )
})

test('nice ticks use round steps inside the range', () => {
  assert.deepEqual(niceTicks(48.3, 52.9, 5), [49, 50, 51, 52])
  assert.deepEqual(niceTicks(0, 100, 5), [0, 25, 50, 75, 100])
})

test('money rounds halves away from zero to cents', () => {
  assert.equal(money(1.005), 1.01)
  assert.equal(money(2.675), 2.68)
  assert.equal(money(-1.005), -1.01)
  assert.equal(money(10.004), 10)
})

test('quotes and fees are rounded to cents like the server', () => {
  assert.deepEqual(quote(50.25, 0.002), { bid: 50.2, ask: 50.3 })
  assert.equal(fee(1234.5, { fee: { rate: 0.001, min: 1 } }), 1.23)
  assert.equal(fee(500, { fee: { rate: 0.001, min: 1 } }), 1)
})

test('a limit buy is costed at its limit price, not the ask', () => {
  assert.equal(executionPrice('buy', 'limit', 50, scenario, 48), 48)
  assert.equal(executionPrice('buy', 'limit', 50, scenario, 55), 55)
  assert.equal(executionPrice('buy', 'market', 50, scenario), 50.05)
  assert.equal(
    executionPrice('sell', 'stop', 50, scenario, undefined, 45),
    44.96,
  )
})

test('prices with more than two decimals are flagged', () => {
  assert.equal(hasCents(12.34), true)
  assert.equal(hasCents(0.29), true)
  assert.equal(hasCents(12.345), false)
})

function me(overrides: Partial<Me> = {}): Me {
  return {
    participant_id: 'p1',
    cash: 10000,
    available_cash: 10000,
    equity: 10000,
    profit: 0,
    profit_pct: 0,
    positions: [],
    orders: [],
    fills: [],
    max_drawdown_pct: 0,
    plan: null,
    ...overrides,
  }
}

function order(overrides: Partial<Order>): Order {
  return {
    id: 'o1',
    client_order_id: 'key-0001',
    symbol: 'LEAF',
    side: 'buy',
    type: 'limit',
    qty: 10,
    limit_price: 48,
    stop_price: null,
    status: 'open',
    tick: 1,
    ...overrides,
  }
}

test('the position cap counts held shares and resting buys at the close', () => {
  const account = me({
    positions: [
      { symbol: 'LEAF', qty: 20, avg_price: 45, value: 1000, unrealized: 0 },
    ],
    orders: [
      order({ qty: 10 }),
      order({ id: 'o2', qty: 5, status: 'filled' }),
      order({ id: 'o3', qty: 7, side: 'sell' }),
    ],
  })

  assert.equal(positionCapQty(account, 'LEAF', 50, 25), 20)
  assert.equal(positionCapQty(account, 'LEAF', 50, 10), 0)
  assert.equal(positionCapQty(account, 'LEAF', 50, null), Infinity)
})
