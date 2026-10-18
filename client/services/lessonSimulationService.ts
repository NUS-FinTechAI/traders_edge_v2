import { api } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import type { components } from '../api/api-types.ts'
import { HttpError } from './httpService.ts'
import { amount, list } from '../utilities/typeUtils.ts'

export type OrderSymbol = components['schemas']['OrderSymbol']
export type OrderSide = components['schemas']['OrderSide']
export type OrderType = components['schemas']['OrderType']
export type OrderStatus = components['schemas']['OrderStatus']
export type Quote = components['schemas']['SimulationQuote']
export type Position = Pick<
  components['schemas']['SimulationPosition'],
  'symbol' | 'quantity' | 'value' | 'weight_percent'
>
export type Order = Pick<
  components['schemas']['Order'],
  | 'id'
  | 'symbol'
  | 'side'
  | 'type'
  | 'status'
  | 'quantity'
  | 'filled'
  | 'remaining'
  | 'price'
>
export type SimulationObservation = Pick<
  components['schemas']['BoundSimulationResponse'],
  'cash' | 'available_cash' | 'equity' | 'fees' | 'quotes' | 'history'
> & {
  positions: Position[]
  orders: Order[]
}

type BoundSimulationResponse = components['schemas']['BoundSimulationResponse']
export type LessonSimulation = SimulationObservation &
  Pick<BoundSimulationResponse, 'id' | 'tick' | 'finished'> & {
    runId: BoundSimulationResponse['bound_policy']['run_id']
  }

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>

function invalid(): never {
  throw new HttpError(
    'Something went wrong while processing the simulation.',
    'invalid-response',
  )
}

function parseSession(
  session: BoundSimulationResponse,
  runId: string,
): LessonSimulation {
  const policy = session.bound_policy
  if (
    typeof session.id !== 'string' ||
    !session.id ||
    policy.run_id !== runId ||
    policy.session_id !== session.id ||
    session.mode !== 'guided' ||
    typeof session.tick !== 'number' ||
    !Number.isInteger(session.tick) ||
    session.tick < 0 ||
    typeof session.finished !== 'boolean'
  )
    return invalid()
  return {
    id: session.id,
    runId,
    tick: session.tick,
    finished: session.finished,
    ...parseSimulationObservation(session, session.tick),
  }
}

export async function resumeLessonSimulation(
  runId: string,
  signal?: AbortSignal,
) {
  return parseSession(
    await api.call(apiEndpoints.resumeLearningSimulation, {
      path: { run_id: runId },
      signal,
    }),
    runId,
  )
}

export async function openLessonSimulation(
  owner: string,
  runId: string,
  storage: Storage,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted()
  const storageKey = `adventure-simulation:${encodeURIComponent(owner)}:${encodeURIComponent(runId)}:bind`
  const key = storage.getItem(storageKey) ?? crypto.randomUUID()
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(key)) return invalid()
  // Retain the key for this run so interrupted starts always recover the same binding.
  storage.setItem(storageKey, key)
  const bound = parseSession(
    await api.call(apiEndpoints.bindLearningSimulation, {
      path: { run_id: runId },
      body: { idempotency_key: key },
      signal,
    }),
    runId,
  )
  // A committed bind response can be old; resume supplies the current observation.
  const current = await resumeLessonSimulation(runId, signal)
  if (current.id !== bound.id) return invalid()
  return current
}

export function parseSimulationObservation(
  session: Pick<
    BoundSimulationResponse,
    | 'cash'
    | 'available_cash'
    | 'equity'
    | 'fees'
    | 'quotes'
    | 'history'
    | 'positions'
    | 'orders'
  >,
  tick: number,
): SimulationObservation {
  const quotes = session.quotes
  if (
    !quotes.length ||
    new Set(quotes.map((item) => item.symbol)).size !== quotes.length
  ) {
    return invalid()
  }

  const history = session.history
  const observedHistory: Record<string, string[]> = Object.create(null)
  for (const quote of quotes) {
    const prices = list(history[quote.symbol], amount)
    if (prices.length !== tick + 1) return invalid()
    observedHistory[quote.symbol] = prices
  }

  const positions: Position[] = session.positions
  const orders: Order[] = session.orders
  if (
    new Set(orders.map((order) => order.id)).size !== orders.length ||
    new Set(positions.map((position) => position.symbol)).size !==
      positions.length ||
    orders.some((order) => order.filled + order.remaining !== order.quantity)
  ) {
    return invalid()
  }

  if (
    [...positions, ...orders].some(
      (item) => !quotes.some((quote) => quote.symbol === item.symbol),
    )
  ) {
    return invalid()
  }

  return {
    cash: amount(session.cash),
    available_cash: amount(session.available_cash),
    equity: amount(session.equity),
    fees: amount(session.fees),
    quotes,
    positions,
    orders,
    history: observedHistory,
  }
}
