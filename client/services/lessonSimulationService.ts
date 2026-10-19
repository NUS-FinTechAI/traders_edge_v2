import { api } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import type { components } from '../api/api-types.ts'
import { HttpError } from './httpService.ts'
import { parseLearningRun, type LearningRun } from './learningRunService.ts'

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
  Pick<
    BoundSimulationResponse,
    | 'id'
    | 'tick'
    | 'finished'
    | 'version'
    | 'total_ticks'
    | 'audited_observation'
  > & {
    runId: BoundSimulationResponse['bound_policy']['run_id']
    policy: BoundSimulationResponse['bound_policy']
    observationToken: string
  }

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>

function invalid(): never {
  throw new HttpError(
    'Something went wrong while processing the simulation.',
    'invalid-response',
  )
}

export function parseLessonSimulation(
  value: unknown,
  runId: string,
): LessonSimulation {
  const session = value as BoundSimulationResponse
  if (!session || typeof session !== 'object' || !session.bound_policy)
    return invalid()
  const policy = session.bound_policy
  if (
    policy.run_id !== runId ||
    policy.session_id !== session.id ||
    session.mode !== 'guided' ||
    !Number.isInteger(session.tick) ||
    session.tick < 0 ||
    session.total_ticks !== policy.max_tick + 1 ||
    session.tick > policy.max_tick ||
    session.version !== policy.engine_version ||
    policy.symbol !== 'NORTH' ||
    policy.side !== 'buy' ||
    policy.order_type !== 'limit' ||
    policy.max_orders !== 2 ||
    policy.max_quantity !== 5 ||
    policy.max_advance !== 2 ||
    policy.min_observe !== 10 ||
    policy.max_tick !== 29 ||
    policy.investment_thesis_supplied !== false ||
    !/^\d+\.\d{2}$/.test(policy.unit_price_cap) ||
    Number(policy.unit_price_cap) <= 0 ||
    typeof session.observation_token !== 'string' ||
    !/^[a-f0-9]{64}$/.test(session.observation_token)
  )
    return invalid()
  return {
    id: session.id,
    runId,
    tick: session.tick,
    finished: session.finished,
    version: session.version,
    total_ticks: session.total_ticks,
    policy: structuredClone(policy),
    observationToken: session.observation_token,
    audited_observation: session.audited_observation ?? null,
    ...parseSimulationObservation(session, session.tick),
  }
}

export async function resumeLessonSimulation(
  runId: string,
  signal?: AbortSignal,
) {
  return parseLessonSimulation(
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
  const bound = parseLessonSimulation(
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
  if (new Set(quotes.map((item) => item.symbol)).size !== quotes.length) {
    return invalid()
  }

  const history = session.history
  const observedHistory: Record<string, string[]> = Object.create(null)
  for (const quote of quotes) {
    const prices = history[quote.symbol]
    if (prices?.length !== tick + 1) return invalid()
    observedHistory[quote.symbol] = [...prices]
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
    cash: session.cash,
    available_cash: session.available_cash,
    equity: session.equity,
    fees: session.fees,
    quotes,
    positions,
    orders,
    history: observedHistory,
  }
}

export type SimulationAudit = components['schemas']['SimulationAudit']
export type SimulationFeedback = components['schemas']['LearningFeedback']
export async function getLessonAuditFeedback(
  runId: string,
  signal?: AbortSignal,
): Promise<SimulationFeedback[]> {
  const run = await api.call(apiEndpoints.getLearningRun, {
    path: { run_id: runId },
    signal,
  })
  if (run.id !== runId) return invalid()
  return run.feedback.filter(
    (item) => item.observation_phase === 'before_finish_cancellation',
  )
}
export type LessonAction =
  | { kind: 'order'; order: components['schemas']['OrderInput'] }
  | { kind: 'advance'; steps: number }
  | { kind: 'cancel'; orderId: string }
  | { kind: 'review'; audit: SimulationAudit }
export type SavedLessonCommand = {
  runId: string
  sessionId: string
  key: string
  action: LessonAction
}
export type LessonCommandResult = {
  session: LessonSimulation
  run: LearningRun | null
  feedback: SimulationFeedback[]
}

/** Keep an uncertain command unchanged until its server receipt is confirmed. */
export class LessonSimulationCommands {
  private readonly storage: Storage & Pick<globalThis.Storage, 'removeItem'>
  private readonly storageKey: string
  private readonly runId: string

  constructor(
    owner: string,
    runId: string,
    storage: Storage & Pick<globalThis.Storage, 'removeItem'>,
  ) {
    this.storage = storage
    this.runId = runId
    this.storageKey = `adventure-simulation:${encodeURIComponent(owner)}:${encodeURIComponent(runId)}:pending`
  }

  pending(): SavedLessonCommand | null {
    const value = this.storage.getItem(this.storageKey)
    if (!value) return null
    try {
      const saved: SavedLessonCommand = JSON.parse(value)
      if (
        saved.runId !== this.runId ||
        typeof saved.sessionId !== 'string' ||
        typeof saved.key !== 'string' ||
        !/^[A-Za-z0-9_-]{8,100}$/.test(saved.key) ||
        !saved.action ||
        !['order', 'advance', 'cancel', 'review'].includes(saved.action.kind)
      )
        return invalid()
      return saved
    } catch {
      throw new Error(
        'The saved simulation command could not be read. Return to the chapter map to inspect your saved activity.',
      )
    }
  }

  async submit(
    session: LessonSimulation,
    action: LessonAction,
  ): Promise<LessonCommandResult> {
    if (this.pending())
      throw new Error(
        'Confirm the saved simulation command before making another decision.',
      )
    if (session.runId !== this.runId || session.finished)
      throw new Error('Reload this lesson before making another decision.')
    const saved: SavedLessonCommand = {
      runId: this.runId,
      sessionId: session.id,
      key: crypto.randomUUID(),
      action: structuredClone(action),
    }
    // Storage must succeed before a mutation can reach the server.
    this.storage.setItem(this.storageKey, JSON.stringify(saved))
    return this.send(saved)
  }

  async retry(): Promise<LessonCommandResult> {
    const saved = this.pending()
    if (!saved) throw new Error('There is no saved command to confirm.')
    return this.send(saved)
  }

  private async send(saved: SavedLessonCommand): Promise<LessonCommandResult> {
    const body = { idempotency_key: saved.key }
    const path = { session_id: saved.sessionId }
    let run: LearningRun | null = null
    let feedback: SimulationFeedback[] = []
    let receiptConfirmed = false
    try {
      if (saved.action.kind === 'review') {
        const response = await api.call(apiEndpoints.reviewLearningSimulation, {
          path: { run_id: saved.runId },
          body: { ...body, audit: saved.action.audit },
        })
        receiptConfirmed = true
        run = parseLearningRun(response)
        if (run.id !== saved.runId) return invalid()
        feedback = response.feedback
      } else {
        let response: unknown
        if (saved.action.kind === 'order') {
          response = await api.call(apiEndpoints.submitSimulationOrder, {
            path,
            body: { ...body, order: saved.action.order },
          })
        } else if (saved.action.kind === 'advance') {
          response = await api.call(apiEndpoints.advanceSimulation, {
            path,
            body: { ...body, steps: saved.action.steps },
          })
        } else {
          response = await api.call(apiEndpoints.cancelSimulationOrder, {
            path: { ...path, order_id: saved.action.orderId },
            body,
          })
        }
        receiptConfirmed = true
        if (parseLessonSimulation(response, saved.runId).id !== saved.sessionId)
          return invalid()
      }
      // Receipts can describe an older observation after a reload or retry.
      const session = await resumeLessonSimulation(saved.runId)
      if (
        session.id !== saved.sessionId ||
        (run?.status === 'completed' && !session.finished)
      )
        return invalid()
      this.storage.removeItem(this.storageKey)
      return { session, run, feedback }
    } catch (error) {
      if (
        !receiptConfirmed &&
        error instanceof HttpError &&
        error.status !== null &&
        [400, 403, 404, 409, 422].includes(error.status)
      ) {
        this.storage.removeItem(this.storageKey)
      }
      throw error
    }
  }
}

export function lessonSimulationError(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.status === 409)
      return 'The saved observation changed. Reload the simulation and review its current facts before trying again.'
    if (error.status === 422 && typeof error.details === 'string')
      return error.details
    if (error.status === 401)
      return 'Your session expired. Sign in again, then confirm the saved command.'
    if (error.status === 403)
      return 'This lesson is locked for this profile. Check its chapter prerequisites.'
    if (error.status === 503)
      return 'This lesson is awaiting publication review.'
  }
  return error instanceof Error && !(error instanceof HttpError)
    ? error.message
    : 'The request could not be confirmed. Confirm the saved command before continuing.'
}
