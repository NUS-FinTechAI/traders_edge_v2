import type {
  Bar,
  Fill,
  GameResult,
  GameState,
  Me,
  NewsItem,
  Order,
  OrderType,
  Scenario,
  Side,
} from '../../services/gameService.ts'
import { formatMoney } from '../../ui/format.ts'

/** "Day N" is tick N, as scenario authors write it; history days are negative. */
export function dayNumber(t: number): number {
  return t
}

export function currentDay(state: Pick<GameState, 'tick' | 'ticks'>): number {
  return Math.max(0, Math.min(state.tick, state.ticks))
}

export function isEnded(state: GameState): boolean {
  return (
    state.status === 'ended' ||
    state.status === 'settled' ||
    (state.status !== 'briefing' && state.tick >= state.ticks)
  )
}

export function isPaused(state: GameState): boolean {
  return state.paused
}

export function isMultiplayer(state: Pick<GameState, 'mode'>): boolean {
  return state.mode === 'private' || state.mode === 'ranked'
}

export function fee(value: number, scenario: Pick<Scenario, 'fee'>): number {
  if (value <= 0) return 0
  return Math.max(scenario.fee.min, scenario.fee.rate * value)
}

export function quote(price: number, spread: number) {
  return { bid: price * (1 - spread / 2), ask: price * (1 + spread / 2) }
}

/** Price a new order is expected to execute at. */
export function executionPrice(
  side: Side,
  type: OrderType,
  price: number,
  scenario: Pick<Scenario, 'spread'>,
  limitPrice?: number,
  stopPrice?: number,
): number {
  const { bid, ask } = quote(price, scenario.spread)
  if (type === 'limit' && limitPrice) {
    return side === 'buy'
      ? Math.min(limitPrice, ask)
      : Math.max(limitPrice, bid)
  }
  if (type === 'stop' && stopPrice) return stopPrice * (1 - scenario.spread / 2)
  return side === 'buy' ? ask : bid
}

export function estimate(
  side: Side,
  qty: number,
  unitPrice: number,
  scenario: Pick<Scenario, 'fee'>,
) {
  const value = qty * unitPrice
  const cost = fee(value, scenario)
  return {
    value,
    fee: cost,
    total: side === 'buy' ? value + cost : value - cost,
  }
}

function openOrders(orders: Order[]): Order[] {
  return orders.filter((order) => order.status === 'open')
}

/** Cash not held back by resting buy orders. */
export function availableCash(me: Me): number {
  return Math.max(0, me.available_cash)
}

export function heldShares(me: Me, symbol: string): number {
  return me.positions.find((p) => p.symbol === symbol)?.qty ?? 0
}

/** Shares not already promised to a resting sell order. */
export function availableShares(me: Me, symbol: string): number {
  const reserved = openOrders(me.orders)
    .filter((order) => order.side === 'sell' && order.symbol === symbol)
    .reduce((sum, order) => sum + order.qty, 0)
  return Math.max(0, heldShares(me, symbol) - reserved)
}

/** Largest whole quantity whose value plus fee fits in `cash`. */
export function maxAffordable(
  cash: number,
  unitPrice: number,
  scenario: Pick<Scenario, 'fee'>,
): number {
  if (unitPrice <= 0 || cash <= 0) return 0
  let qty = Math.floor(cash / (unitPrice * (1 + scenario.fee.rate)))
  while (
    qty > 0 &&
    qty * unitPrice + fee(qty * unitPrice, scenario) > cash + 1e-9
  ) {
    qty--
  }
  return qty
}

/** Extra shares allowed by a per-position cap, or Infinity without one. */
export function positionCapQty(
  me: Me,
  symbol: string,
  unitPrice: number,
  maxPositionPct: number | null,
): number {
  if (maxPositionPct === null || unitPrice <= 0) return Infinity
  const current = me.positions.find((p) => p.symbol === symbol)?.value ?? 0
  const room = (maxPositionPct / 100) * me.equity - current
  return Math.max(0, Math.floor(room / unitPrice))
}

/** Loss if a buy at `entry` is stopped out at `stop`, fees included. */
export function riskIfStopped(
  qty: number,
  entry: number,
  stop: number,
  scenario: Pick<Scenario, 'fee' | 'spread'>,
  equity: number,
) {
  const exit = stop * (1 - scenario.spread / 2)
  const amount =
    qty * (entry - exit) +
    fee(qty * entry, scenario) +
    fee(qty * exit, scenario)
  return { amount, pct: equity > 0 ? (amount / equity) * 100 : 0 }
}

export function ordinal(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? 'th'
      : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ??
        'th')
  return `${n}${suffix}`
}

/** One-line summary of where the player finished. */
export function rankHeadline(result: GameResult): string {
  const { rank, of, leaderboard } = result
  if (result.forfeited)
    return `You left early, so you rank ${ordinal(of)} of ${of}.`
  const me = leaderboard.find((entry) => entry.is_me)
  const sharedTop =
    leaderboard.filter((entry) => entry.rank === rank).length > 1
  const rivalsAreBots = leaderboard.some((e) => !e.is_me && e.kind === 'bot')
  if (rank === 1 && sharedTop) {
    return rivalsAreBots
      ? 'Tied for 1st — a tie isn’t a win against AI'
      : `Tied for 1st of ${of}`
  }
  if (of === 1) return 'Mission complete'
  if (rank === 1) return `You finished 1st of ${of} — you beat every rival!`
  const leader = leaderboard.find((entry) => entry.rank === 1 && !entry.is_me)
  const gap = leader && me ? leader.profit - me.profit : null
  return leader && gap !== null
    ? `${ordinal(rank)} of ${of} — ${leader.name} finished ${formatMoney(gap)} ahead`
    : `${ordinal(rank)} of ${of}`
}

type Placement = Partial<Pick<GameState, 'chapter_id' | 'level_id'>> & {
  scenario: Pick<Scenario, 'id'>
}

/** Chapter id such as "ch1", from the state or the "ch1-…" id prefix. */
export function chapterOf(state: Placement): string | null {
  if (state.chapter_id) return state.chapter_id
  const match = (state.level_id ?? state.scenario.id).match(/^(ch\d+)(-|$)/)
  return match ? match[1] : null
}

/** Level id such as "ch1-l2", from the state or the scenario id prefix. */
export function levelOf(state: Placement): string | null {
  if (state.level_id) return state.level_id
  const match = state.scenario.id.match(/^(ch\d+-l\d+)(-|$)/)
  return match ? match[1] : null
}

/** Total account value after each market day, replayed from fills and closes. */
export function equitySeries(
  startingCash: number,
  fills: Fill[],
  bars: Record<string, Bar[]>,
  lastTick: number,
): { t: number; value: number }[] {
  const closes = new Map<string, Map<number, number>>()
  for (const [symbol, list] of Object.entries(bars)) {
    closes.set(symbol, new Map(list.map((bar) => [bar.t, bar.c])))
  }
  const ordered = [...fills].sort((a, b) => a.t - b.t)
  const holdings = new Map<string, number>()
  const lastClose = new Map<string, number>()
  let cash = startingCash
  let index = 0
  const series: { t: number; value: number }[] = []
  for (let t = 0; t <= lastTick; t++) {
    while (index < ordered.length && ordered[index].t <= t) {
      const fill = ordered[index++]
      const value = fill.qty * fill.price
      const sign = fill.side === 'buy' ? 1 : -1
      cash -= sign * value + fill.fee
      holdings.set(
        fill.symbol,
        (holdings.get(fill.symbol) ?? 0) + sign * fill.qty,
      )
    }
    let value = cash
    for (const [symbol, map] of closes) {
      const close = map.get(t)
      if (close !== undefined) lastClose.set(symbol, close)
    }
    for (const [symbol, qty] of holdings)
      value += qty * (lastClose.get(symbol) ?? 0)
    series.push({ t, value })
  }
  return series
}

/** Notable fills and headlines, oldest first, when the server sends none. */
export function keyMoments(
  fills: Fill[],
  news: NewsItem[],
  limit = 5,
): string[] {
  const moments = [
    ...news.map((item) => ({ t: item.t, text: item.headline, order: 0 })),
    ...fills.map((fill) => ({
      t: fill.t,
      text: `${fill.side === 'buy' ? 'You bought' : 'You sold'} ${fill.qty} ${fill.symbol} at ${formatMoney(fill.price)}`,
      order: 1,
    })),
  ].sort((a, b) => a.t - b.t || a.order - b.order)
  return moments
    .slice(0, limit)
    .map(({ t, text }) => `Day ${dayNumber(t)}: ${text}`)
}
