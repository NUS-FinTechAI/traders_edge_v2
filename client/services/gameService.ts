import httpService from './httpService.ts'

export type GameMode =
  'level' | 'boss' | 'daily' | 'practice' | 'private' | 'ranked'

export type GameStatus = 'briefing' | 'running' | 'ended' | 'settled'

export type Side = 'buy' | 'sell'
export type OrderType = 'market' | 'limit' | 'stop'
export type Tone = 'positive' | 'negative' | 'neutral'
export type Tool =
  'candles' | 'line' | 'volume' | 'sma' | 'ema' | 'rsi' | 'macd' | 'bollinger'
export type BotTier = 'rookie' | 'pro' | 'elite'
export type StrategyId =
  'trend' | 'dip' | 'breakout' | 'news' | 'hold' | 'cautious'
export type NewsKind = 'earnings' | 'macro' | 'rumor' | 'company' | 'hype'

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

export interface Asset {
  symbol: string
  name: string
  sector: string
  blurb: string
  price: number
  change_pct: number
}

export interface Bar {
  t: number
  o: number
  h: number
  l: number
  c: number
  v: number
}

export interface NewsItem {
  id: string
  t: number
  headline: string
  body: string
  symbols: string[]
  tone: Tone
  kind: NewsKind
}

export interface Position {
  symbol: string
  qty: number
  avg_price: number
  value: number
  unrealized: number
}

export interface Order {
  id: string
  client_order_id: string
  symbol: string
  side: Side
  type: OrderType
  qty: number
  limit_price?: number | null
  stop_price?: number | null
  status: 'open' | 'filled' | 'cancelled'
  tick: number
}

export interface Fill {
  order_id: string
  t: number
  symbol: string
  side: Side
  qty: number
  price: number
  fee: number
}

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

export interface LeaderboardEntry {
  participant_id: string
  name: string
  kind: 'bot' | 'human'
  bot_id: string | null
  avatar: string | null
  profit: number
  rank: number
  is_me: boolean
  forfeited: boolean
  /** Bot's one-line public style, e.g. "Buys strength". */
  style: string | null
  tier: BotTier | null
}

export type MissionState = 'done' | 'pending' | 'on_track' | 'behind' | 'failed'

export interface Mission {
  id: string
  tier: 'basic' | 'bonus'
  text: string
  done: boolean
  /** Milestones finish during play; end-of-match missions stay on track, behind or failed until the end. */
  state: MissionState
  progress: string
}

export interface RewardItem {
  id: string
  kind: string
  name: string
}

export interface DecisionBreakdown {
  missions: number
  plan: number
  risk: number
  overtrading: number
}

export interface GameResult {
  won: boolean
  rank: number
  of: number
  profit: number
  profit_pct: number
  forfeited: boolean
  leaderboard: LeaderboardEntry[]
  missions: Mission[]
  stars: { normal: boolean; special: boolean } | null
  rewards: {
    xp: number
    stocks: number
    gems: number
    items: RewardItem[]
    badges: { id: string; name: string }[]
  }
  plan_review: {
    strategy: StrategyId
    max_loss_pct: number
    worst_drawdown_pct: number
    kept_loss_limit: boolean
  } | null
  stats: {
    trades: number
    fees: number
    biggest_position_pct: number
    max_drawdown_pct: number
    buy_hold_profit: number
  }
  debrief: string
  unlocked: { chapter_id: string } | null
  /** Unvalidated 0–100 process score; it never decides a win. */
  decision_score: number
  decision_breakdown: DecisionBreakdown
  reflection?: string | null
  /** Up to five generated sentences, e.g. "Day 18: … You held 40 LEAF." */
  key_moments: string[]
}

export interface GameState {
  id: string
  mode: GameMode
  status: GameStatus
  tick: number
  ticks: number
  tick_label: string
  tick_ms: number
  speed: number
  paused: boolean
  server_time: number
  next_tick_at: number | null
  /** Not in the current engine response; derived from the scenario id when absent. */
  chapter_id?: string | null
  level_id?: string | null
  boss?: 'preview' | 'gate' | 'final' | null
  scenario: Scenario
  assets: Asset[]
  bars: Record<string, Bar[]>
  news: NewsItem[]
  me: Me
  leaderboard: LeaderboardEntry[]
  missions: Mission[]
  result: GameResult | null
}

export interface CreateGameRequest {
  mode: GameMode
  scenario_id?: string
  level_id?: string
  chapter_id?: string
  boss?: 'preview' | 'gate' | 'final'
  bots?: number
}

export interface OrderRequest {
  symbol: string
  side: Side
  type: OrderType
  qty: number
  limit_price?: number
  stop_price?: number
}

export interface PlacedOrder {
  order: Order
  state: GameState
}

export interface GameSummary {
  id: string
  mode: GameMode
  status: GameStatus
  scenario_id: string
  title: string
  tick: number
  ticks: number
  created_at: string
}

export type ClockAction = 'pause' | 'resume' | 'step' | 'speed'

const base = (id: string) => `/api/games/${encodeURIComponent(id)}`

export function createGame(body: CreateGameRequest): Promise<GameState> {
  return httpService.request<GameState>('/api/games', { method: 'POST', body })
}

export function getGame(
  id: string,
  since?: number,
  signal?: AbortSignal,
): Promise<GameState> {
  return httpService.request<GameState>(base(id), {
    query: { since },
    signal,
  })
}

export function startGame(id: string, plan: Plan): Promise<GameState> {
  return httpService.request<GameState>(`${base(id)}/start`, {
    method: 'POST',
    body: { plan },
  })
}

export function controlClock(
  id: string,
  action: ClockAction,
  speed?: 1 | 2 | 4,
): Promise<GameState> {
  return httpService.request<GameState>(`${base(id)}/clock`, {
    method: 'POST',
    body: speed === undefined ? { action } : { action, speed },
  })
}

export function placeOrder(
  id: string,
  order: OrderRequest,
): Promise<PlacedOrder> {
  return httpService.request<PlacedOrder>(`${base(id)}/orders`, {
    method: 'POST',
    body: { client_order_id: crypto.randomUUID(), ...order },
  })
}

export function cancelOrder(id: string, orderId: string): Promise<GameState> {
  return httpService.request<GameState>(
    `${base(id)}/orders/${encodeURIComponent(orderId)}`,
    { method: 'DELETE' },
  )
}

export function finishGame(
  id: string,
  body: { forfeit?: boolean; reflection?: string } = {},
): Promise<GameResult> {
  return httpService.request<GameResult>(`${base(id)}/finish`, {
    method: 'POST',
    body,
  })
}

export function getResult(id: string): Promise<GameResult> {
  return httpService.request<GameResult>(`${base(id)}/result`)
}

export function listGames(
  signal?: AbortSignal,
): Promise<{ games: GameSummary[] }> {
  return httpService.request<{ games: GameSummary[] }>('/api/games', {
    query: { status: 'active' },
    signal,
  })
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
