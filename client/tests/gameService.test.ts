import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  findBriefing,
  isNewer,
  lastBarTick,
  mergeGameState,
  newOrderKey,
  type Bar,
  type GameState,
  type GameSummary,
  type NewsItem,
} from '../services/gameService.ts'

function bar(t: number, c = 50): Bar {
  return { t, o: c, h: c + 1, l: c - 1, c, v: 1000 }
}

function news(id: string, t: number): NewsItem {
  return {
    id,
    t,
    headline: id,
    body: '',
    symbols: ['LEAF'],
    tone: 'neutral',
    kind: 'company',
  }
}

function game(overrides: Partial<GameState> = {}): GameState {
  return {
    id: 'g1',
    mode: 'practice',
    chapter_id: null,
    level_id: null,
    boss: null,
    status: 'running',
    tick: 1,
    ticks: 30,
    tick_label: 'Day',
    tick_ms: 2000,
    speed: 1,
    paused: false,
    server_time: 0,
    next_tick_at: 2000,
    scenario: {
      id: 'practice-trend-rider',
      title: 'Trend Rider',
      briefing: '',
      objective: '',
      difficulty: 1,
      starting_cash: 10000,
      tools: ['candles'],
      allow: { limit: false, stop: false },
      max_position_pct: null,
      fee: { rate: 0.001, min: 1 },
      spread: 0.001,
    },
    assets: [],
    bars: { LEAF: [bar(-1), bar(0), bar(1)] },
    news: [news('n1', 0)],
    me: {
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
    },
    leaderboard: [],
    missions: [],
    result: null,
    ...overrides,
  }
}

test('a since response appends newer bars and news to the held state', () => {
  const previous = game()
  const incoming = game({
    tick: 2,
    bars: { LEAF: [bar(2, 51)] },
    news: [news('n2', 2)],
  })

  const merged = mergeGameState(previous, incoming)

  assert.deepEqual(
    merged.bars.LEAF.map((b) => b.t),
    [-1, 0, 1, 2],
  )
  assert.deepEqual(
    merged.news.map((n) => n.id),
    ['n1', 'n2'],
  )
  assert.equal(merged.tick, 2)
})

test('a repeated bar tick or news id replaces the older copy without duplicates', () => {
  const previous = game()
  const incoming = game({
    bars: { LEAF: [bar(1, 55)] },
    news: [{ ...news('n1', 0), headline: 'updated' }],
  })

  const merged = mergeGameState(previous, incoming)

  assert.equal(merged.bars.LEAF.length, 3)
  assert.equal(merged.bars.LEAF[2].c, 55)
  assert.equal(merged.news.length, 1)
  assert.equal(merged.news[0].headline, 'updated')
})

test('a symbol missing from a since response keeps its held bars', () => {
  const previous = game({ bars: { LEAF: [bar(0)], LUMB: [bar(0, 20)] } })
  const incoming = game({ bars: { LEAF: [bar(1)] } })

  const merged = mergeGameState(previous, incoming)

  assert.equal(merged.bars.LUMB.length, 1)
  assert.equal(merged.bars.LEAF.length, 2)
})

test('a response for a different game replaces the held state', () => {
  const incoming = game({ id: 'g2', bars: { LEAF: [bar(5)] } })

  const merged = mergeGameState(game(), incoming)

  assert.equal(merged, incoming)
})

test('the next since value is the highest bar tick held', () => {
  assert.equal(lastBarTick(null), undefined)
  assert.equal(
    lastBarTick(game({ bars: { LEAF: [bar(0), bar(3)], LUMB: [bar(4)] } })),
    4,
  )
})

test('a reply generated before the shown state is not newer', () => {
  const shown = game({ tick: 5, server_time: 5000 })

  assert.equal(isNewer(shown, game({ tick: 4, server_time: 4000 })), false)
  assert.equal(isNewer(shown, game({ tick: 5, server_time: 4900 })), false)
  assert.equal(isNewer(shown, game({ tick: 5, server_time: 5000 })), true)
  assert.equal(isNewer(shown, game({ tick: 6, server_time: 6000 })), true)
  assert.equal(isNewer(null, game()), true)
})

function summary(overrides: Partial<GameSummary>): GameSummary {
  return {
    id: 'g',
    mode: 'level',
    scenario_id: 'ch1-l1-practice',
    status: 'briefing',
    tick: 0,
    ticks: 30,
    title: 'Practice',
    created_at: '2026-10-20T00:00:00Z',
    ...overrides,
  }
}

test('an unstarted briefing for the same market is reused', () => {
  const games = [
    summary({ id: 'running', status: 'running' }),
    summary({ id: 'other', scenario_id: 'ch1-l2-practice' }),
    summary({ id: 'match' }),
  ]

  assert.equal(findBriefing(games, 'level', 'ch1-l1-practice')?.id, 'match')
  assert.equal(findBriefing(games, 'boss', 'ch1-l1-practice'), null)
  assert.equal(findBriefing(games, 'level', 'ch1-l1-practice', 'match'), null)
})

test('order keys use only the characters the server accepts', () => {
  const key = newOrderKey()

  assert.match(key, /^[a-zA-Z0-9_-]{8,64}$/)
  assert.notEqual(key, newOrderKey())
})
