import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as games from '../services/gameService.ts'
import { stubHttp } from './helpers/serviceHttp.ts'
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

test('creating a game preserves the selected mode and scenario', async (t) => {
  const response = game({ status: 'briefing' })
  const requests = stubHttp(t, response)
  const body = {
    mode: 'practice',
    scenario_id: 'practice-trend-rider',
    bots: 0,
  } as const

  const result = await games.createGame(body)

  assert.deepEqual(result, response)
  assert.equal(requests[0].url.pathname, '/api/games')
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].body, body)
})

for (const since of [undefined, 0, 12]) {
  test(`polling a game with since=${since} encodes the game ID and forwards cancellation`, async (t) => {
    const response = game()
    const requests = stubHttp(t, response)
    const controller = new AbortController()

    const result = await games.getGame('game/a ?#', since, controller.signal)

    assert.deepEqual(result, response)
    assert.equal(requests[0].url.pathname, '/api/games/game%2Fa%20%3F%23')
    assert.equal(requests[0].method, 'GET')
    assert.equal(
      requests[0].url.searchParams.get('since'),
      since === undefined ? null : String(since),
    )
    assert.equal(requests[0].signal, controller.signal)
  })
}

test('starting a game submits the selected strategy and loss limit', async (t) => {
  const requests = stubHttp(t, game())
  const plan = { strategy: 'cautious', max_loss_pct: 5 } as const

  await games.startGame('game/a', plan)

  assert.equal(requests[0].url.pathname, '/api/games/game%2Fa/start')
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].body, { plan })
})

for (const action of ['pause', 'resume', 'step'] as const) {
  test(`the ${action} clock action does not invent a speed value`, async (t) => {
    const requests = stubHttp(t, game())

    await games.controlClock('game/a', action)

    assert.equal(requests[0].url.pathname, '/api/games/game%2Fa/clock')
    assert.equal(requests[0].method, 'POST')
    assert.deepEqual(requests[0].body, { action })
  })
}

for (const speed of [1, 2, 4] as const) {
  test(`changing clock speed to ${speed} sends the selected multiplier`, async (t) => {
    const requests = stubHttp(t, game())

    await games.controlClock('game', 'speed', speed)

    assert.deepEqual(requests[0].body, { action: 'speed', speed })
  })
}

test('placing an order preserves a caller-supplied idempotency key and prices', async (t) => {
  const response = { order_id: 'order' }
  const requests = stubHttp(t, response)
  const order = {
    client_order_id: 'stable-key',
    symbol: 'LEAF',
    side: 'buy',
    type: 'limit',
    qty: 2,
    limit_price: 50,
    stop_price: 45,
  } as const

  const result = await games.placeOrder('game/a', order)

  assert.deepEqual(result, response)
  assert.equal(requests[0].url.pathname, '/api/games/game%2Fa/orders')
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].body, order)
})

test('orders without a caller key receive different valid idempotency keys', async (t) => {
  const requests = stubHttp(t, {})
  const order = {
    symbol: 'LEAF',
    side: 'sell',
    type: 'market',
    qty: 1,
  } as const

  await games.placeOrder('game', order)
  await games.placeOrder('game', order)

  const keys = requests.map(({ body }) => {
    assert.ok(body && typeof body === 'object' && 'client_order_id' in body)
    assert.equal(typeof body.client_order_id, 'string')
    const key = String(body.client_order_id)
    assert.match(key, /^[a-zA-Z0-9_-]{8,64}$/)
    return key
  })
  assert.notEqual(keys[0], keys[1])
  assert.equal('client_order_id' in order, false)
})

test('cancelling an order encodes the game and order IDs', async (t) => {
  const response = game()
  const requests = stubHttp(t, response)

  const result = await games.cancelOrder('game/a', 'order/b ?#')

  assert.deepEqual(result, response)
  assert.equal(
    requests[0].url.pathname,
    '/api/games/game%2Fa/orders/order%2Fb%20%3F%23',
  )
  assert.equal(requests[0].method, 'DELETE')
})

for (const body of [
  undefined,
  { forfeit: false, reflection: '' },
  { forfeit: true, reflection: 'Review my plan' },
]) {
  test(`finishing a game with ${body === undefined ? 'default options' : JSON.stringify(body)} preserves the settlement request`, async (t) => {
    const response = { game_id: 'game', profit: 10 }
    const requests = stubHttp(t, response)

    const result = await games.finishGame('game/a', body)

    assert.deepEqual(result, response)
    assert.equal(requests[0].url.pathname, '/api/games/game%2Fa/finish')
    assert.equal(requests[0].method, 'POST')
    assert.deepEqual(requests[0].body, body ?? {})
  })
}

test('loading a result encodes the game ID and returns the settlement', async (t) => {
  const response = { game_id: 'game', profit: 10 }
  const requests = stubHttp(t, response)

  const result = await games.getResult('game/a')

  assert.deepEqual(result, response)
  assert.equal(requests[0].url.pathname, '/api/games/game%2Fa/result')
  assert.equal(requests[0].method, 'GET')
})

test('listing games requests only active games and forwards cancellation', async (t) => {
  const requests = stubHttp(t, { games: [] })
  const controller = new AbortController()

  const result = await games.listGames(controller.signal)

  assert.deepEqual(result, { games: [] })
  assert.equal(requests[0].url.pathname, '/api/games')
  assert.equal(requests[0].url.searchParams.get('status'), 'active')
  assert.equal(requests[0].signal, controller.signal)
})

test('a refused order propagates its reason without retrying the mutation', async (t) => {
  const requests = stubHttp(t, { detail: 'Insufficient available cash' }, 422)

  await assert.rejects(
    games.placeOrder('game', {
      symbol: 'LEAF',
      side: 'buy',
      type: 'market',
      qty: 999,
    }),
    { status: 422, message: 'Insufficient available cash' },
  )

  assert.equal(requests.length, 1)
})

test('an aborted game poll does not reach the network', async (t) => {
  const requests = stubHttp(t)
  const controller = new AbortController()
  controller.abort()

  await assert.rejects(games.getGame('game', 0, controller.signal), {
    kind: 'aborted',
  })

  assert.equal(requests.length, 0)
})
