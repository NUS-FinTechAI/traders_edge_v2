import { api } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import type { components } from '../api/api-types.ts'

type Schemas = components['schemas']

export type GameMode =
  'level' | 'boss' | 'daily' | 'practice' | 'private' | 'ranked'

export type Side = 'buy' | 'sell'
export type OrderType = 'market' | 'limit' | 'stop'
export type Tone = 'positive' | 'negative' | 'neutral'
export type Tool =
  'candles' | 'line' | 'volume' | 'sma' | 'ema' | 'rsi' | 'macd' | 'bollinger'
export type BotTier = 'rookie' | 'pro' | 'elite'
export type StrategyId =
  'trend' | 'dip' | 'breakout' | 'news' | 'hold' | 'cautious'

export interface Plan {
  strategy: StrategyId
  max_loss_pct: number
}

export interface Scenario {
  id: string
  title: string
  briefing: string
  objective: string
  difficulty: number
  starting_cash: number
  tools: (Tool | string)[]
  allow: { limit: boolean; stop: boolean }
  max_position_pct: number | null
  fee: { rate: number; min: number }
  spread: number
}

export type Asset = Schemas['Asset']

export type Bar = Schemas['Bar']

export type NewsItem = Schemas['NewsItem']

export type Position = Schemas['Position']

export type Order = Schemas['Order']

export type Fill = Schemas['Fill']

export interface Me {
  participant_id: string
  cash: number
  /** Cash minus cash reserved by open buy orders. */
  available_cash: number
  equity: number
  profit: number
  profit_pct: number
  positions: Position[]
  orders: Order[]
  fills: Fill[]
  max_drawdown_pct: number
  plan: Plan | null
}

export type LeaderboardEntry = Schemas['Standing']

export type MissionState = 'done' | 'pending' | 'on_track' | 'behind' | 'failed'

export type Mission = Schemas['Mission']

export type RewardItem = Schemas['RewardItem']

export type DecisionBreakdown = Schemas['DecisionBreakdown']

export type GameResult = Schemas['GameResult']

export type GameState = Schemas['GameState']

export type CreateGameRequest = Schemas['CreateGame']

export interface OrderRequest {
  /** Idempotency key; a retry with the same key returns the original order. */
  client_order_id?: string
  symbol: string
  side: Side
  type: OrderType
  qty: number
  limit_price?: number
  stop_price?: number
}

export type PlacedOrder = Schemas['PlacedOrder']

export type GameSummary = Schemas['GameSummary']

export type ClockAction = 'pause' | 'resume' | 'step' | 'speed'

export function createGame(body: CreateGameRequest): Promise<GameState> {
  return api.call(apiEndpoints.createGame, { body })
}

export function getGame(
  id: string,
  since?: number,
  signal?: AbortSignal,
): Promise<GameState> {
  return api.call(apiEndpoints.getGame, {
    path: { game_id: id },
    query: { since },
    signal,
  })
}

export function startGame(id: string, plan: Plan): Promise<GameState> {
  return api.call(apiEndpoints.startGame, {
    path: { game_id: id },
    body: { plan },
  })
}

export function controlClock(
  id: string,
  action: ClockAction,
  speed?: 1 | 2 | 4,
): Promise<GameState> {
  return api.call(apiEndpoints.controlGameClock, {
    path: { game_id: id },
    body: speed === undefined ? { action } : { action, speed },
  })
}

export function placeOrder(
  id: string,
  order: OrderRequest,
): Promise<PlacedOrder> {
  return api.call(apiEndpoints.placeGameOrder, {
    path: { game_id: id },
    body: { ...order, client_order_id: order.client_order_id ?? newOrderKey() },
  })
}

/** A fresh idempotency key in the server's allowed alphabet. */
export function newOrderKey(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export function cancelOrder(id: string, orderId: string): Promise<GameState> {
  return api.call(apiEndpoints.cancelGameOrder, {
    path: { game_id: id, order_id: orderId },
  })
}

export function finishGame(
  id: string,
  body: { forfeit?: boolean; reflection?: string } = {},
): Promise<GameResult> {
  return api.call(apiEndpoints.finishGame, { path: { game_id: id }, body })
}

export function getResult(id: string): Promise<GameResult> {
  return api.call(apiEndpoints.getGameResult, { path: { game_id: id } })
}

export function listGames(
  signal?: AbortSignal,
): Promise<{ games: GameSummary[] }> {
  return api.call(apiEndpoints.listGames, {
    query: { status: 'active' },
    signal,
  })
}

/**
 * An unstarted briefing for the same kind of match, so "Start" or "Try again"
 * reopens it instead of creating a duplicate. `scenarioId` narrows the match
 * when the caller knows which market it will get.
 */
export function findBriefing(
  games: GameSummary[],
  mode: GameMode,
  scenarioId?: string | null,
  exceptId?: string,
): GameSummary | null {
  return (
    games.find(
      (game) =>
        game.status === 'briefing' &&
        game.mode === mode &&
        game.id !== exceptId &&
        (!scenarioId || game.scenario_id === scenarioId),
    ) ?? null
  )
}

/**
 * Whether `incoming` may replace `current`: a response generated before the
 * state already shown (for example a slow command reply after a newer poll)
 * would roll the market back.
 */
export function isNewer(current: GameState | null, incoming: GameState) {
  if (!current || current.id !== incoming.id) return true
  if (incoming.server_time < current.server_time) return false
  return incoming.tick >= current.tick
}

function mergeBy<T>(
  previous: T[],
  incoming: T[],
  key: (item: T) => string | number,
) {
  if (!incoming.length) return previous
  const byKey = new Map(previous.map((item) => [key(item), item]))
  for (const item of incoming) byKey.set(key(item), item)
  return [...byKey.values()]
}

/**
 * Combine a `since` response with the state already held. Bars and news are
 * appended (a repeated tick or id replaces the older copy); everything else
 * comes from the newer response.
 */
export function mergeGameState(
  previous: GameState | null,
  incoming: GameState,
): GameState {
  if (!previous || previous.id !== incoming.id) return incoming
  const bars: Record<string, Bar[]> = { ...previous.bars }
  for (const [symbol, list] of Object.entries(incoming.bars ?? {})) {
    bars[symbol] = mergeBy(bars[symbol] ?? [], list, (bar) => bar.t).sort(
      (a, b) => a.t - b.t,
    )
  }
  const news = mergeBy(
    previous.news,
    incoming.news ?? [],
    (item) => item.id,
  ).sort((a, b) => a.t - b.t)
  return { ...incoming, bars, news }
}

/** The highest bar tick held, used as the next `since` value. */
export function lastBarTick(state: GameState | null): number | undefined {
  if (!state) return undefined
  let last: number | undefined
  for (const list of Object.values(state.bars)) {
    const tail = list[list.length - 1]
    if (tail && (last === undefined || tail.t > last)) last = tail.t
  }
  return last
}
