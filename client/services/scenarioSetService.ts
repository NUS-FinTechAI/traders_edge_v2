import { api } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import type { components } from '../api/api-types.ts'
import authService from './authService.ts'
import { HttpError } from './httpService.ts'
import { parseLearningRun, type LearningRun } from './learningRunService.ts'

export type ScenarioSession = components['schemas']['ScenarioSessionResponse']
export type ScenarioAudit = components['schemas']['ScenarioAudit']
export type ScenarioOrder = components['schemas']['OrderInput']
export type ScenarioSet = Omit<
  components['schemas']['ScenarioSetResponse'],
  'run'
> & { run: LearningRun }
export type ScenarioAction =
  | { kind: 'bind' }
  | { kind: 'order'; order: ScenarioOrder }
  | { kind: 'advance'; steps: number }
  | { kind: 'cancel'; orderId: string }
  | { kind: 'review'; audit: ScenarioAudit }
export type ScenarioCommand = {
  owner: string
  runId: string
  caseId: string
  sessionId: string | null
  key: string
  action: ScenarioAction
}
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
const cases = ['path-1', 'path-2', 'path-3', 'path-4']
const symbols = ['NORTH', 'HARBOR', 'PLAIN', 'COVE']
const profiles = ['rising', 'falling', 'sideways', 'volatile']
const keyPattern = /^[A-Za-z0-9_-]{8,100}$/
const money = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d+(?:\.\d{1,2})?$/.test(value) &&
  Number.isFinite(Number(value))
const integer = (value: unknown, minimum = 0): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= minimum
function invalid(): never {
  throw new HttpError(
    'The saved four-path lesson could not be read consistently.',
    'invalid-response',
  )
}
function ownerCheck(owner: string, current: () => string | null) {
  if (current() !== owner)
    throw new Error(
      'The signed-in player changed. Reload this activity with the account that owns its saved actions.',
    )
}
const verifiedOwner = async () => (await authService.getProfile()).id
async function verifyOwner(
  owner: string,
  current: () => string | null,
  verify: () => Promise<string | null>,
) {
  ownerCheck(owner, current)
  const actual = await verify()
  ownerCheck(owner, () => actual)
  ownerCheck(owner, current)
}
function policyValid(policy: ScenarioSet['policy']) {
  return (
    !!policy &&
    policy.id === 'm09-l03-four-path-review-v1' &&
    policy.engine_version === 1 &&
    policy.total_cases === 4 &&
    policy.total_ticks === 20 &&
    policy.max_advance === 5 &&
    policy.max_order_quantity === 5 &&
    policy.max_asset_units === 10 &&
    policy.max_orders === 8 &&
    money(policy.max_planned_loss) &&
    Number(policy.max_planned_loss) === 100 &&
    policy.investment_thesis_supplied === false
  )
}
export function parseScenarioSession(
  value: unknown,
  runId: string,
  caseId: string,
): ScenarioSession {
  try {
    return sessionData(value, runId, caseId)
  } catch {
    return invalid()
  }
}
function sessionData(
  value: unknown,
  runId: string,
  caseId: string,
): ScenarioSession {
  const session = value as ScenarioSession
  const policy = session?.scenario_set_policy
  if (
    !policyValid(policy) ||
    policy.run_id !== runId ||
    policy.case_id !== caseId ||
    policy.session_id !== session.id ||
    !session.id ||
    session.mode !== 'guided' ||
    session.version !== policy.engine_version ||
    session.total_ticks !== policy.total_ticks ||
    !integer(session.tick) ||
    session.tick >= session.total_ticks ||
    session.finished ||
    !/^[a-f0-9]{64}$/.test(session.observation_token) ||
    !Array.isArray(session.quotes) ||
    session.quotes.length !== 4 ||
    new Set(session.quotes.map((quote) => quote.symbol)).size !== 4 ||
    !session.history ||
    typeof session.history !== 'object' ||
    !Array.isArray(session.positions) ||
    !Array.isArray(session.orders) ||
    !Array.isArray(session.fills) ||
    ![
      session.cash,
      session.available_cash,
      session.equity,
      session.fees,
      session.benchmark_value,
      session.max_drawdown_percent,
    ].every(money)
  )
    return invalid()
  const history: Record<string, string[]> = Object.create(null)
  for (const quote of session.quotes) {
    const prices = session.history[quote.symbol]
    if (
      !symbols.includes(quote.symbol) ||
      ![quote.mid, quote.bid, quote.ask].every(money) ||
      !integer(quote.available_units) ||
      !Array.isArray(prices) ||
      prices.length !== session.tick + 1 ||
      !prices.every(money)
    )
      return invalid()
    history[quote.symbol] = [...prices]
  }
  if (
    new Set(session.orders.map((order) => order.id)).size !==
      session.orders.length ||
    new Set(session.positions.map((position) => position.symbol)).size !==
      session.positions.length ||
    session.orders.some(
      (order) =>
        !order.id ||
        !symbols.includes(order.symbol) ||
        !integer(order.quantity, 1) ||
        !integer(order.filled) ||
        !integer(order.remaining) ||
        order.filled + order.remaining !== order.quantity ||
        !order.plan,
    ) ||
    session.positions.some(
      (position) =>
        !symbols.includes(position.symbol) || !integer(position.quantity, 1),
    ) ||
    session.fills.some(
      (fill) =>
        !integer(fill.tick) ||
        fill.tick > session.tick ||
        !symbols.includes(fill.symbol),
    )
  )
    return invalid()
  return {
    id: session.id,
    mode: session.mode,
    updated_at: session.updated_at,
    version: session.version,
    tick: session.tick,
    total_ticks: session.total_ticks,
    scenario: 'Controlled synthetic practice',
    finished: session.finished,
    cash: session.cash,
    available_cash: session.available_cash,
    equity: session.equity,
    fees: session.fees,
    quotes: session.quotes.map(
      ({ symbol, mid, bid, ask, available_units }) => ({
        symbol,
        mid,
        bid,
        ask,
        available_units,
      }),
    ),
    positions: session.positions.map(
      ({ symbol, quantity, cost, realized, value, weight_percent }) => ({
        symbol,
        quantity,
        cost,
        realized,
        value,
        weight_percent,
      }),
    ),
    orders: session.orders.map(
      ({
        id,
        symbol,
        side,
        type,
        status,
        quantity,
        filled,
        remaining,
        price,
        triggered,
        submitted_tick,
        plan,
      }) => ({
        id,
        symbol,
        side,
        type,
        status,
        quantity,
        filled,
        remaining,
        price,
        triggered,
        submitted_tick,
        plan: structuredClone(plan),
      }),
    ),
    fills: session.fills.map(
      ({ order_id, tick, symbol, side, quantity, price, fee }) => ({
        order_id,
        tick,
        symbol,
        side,
        quantity,
        price,
        fee,
      }),
    ),
    history,
    benchmark_value: session.benchmark_value,
    max_drawdown_percent: session.max_drawdown_percent,
    reflection: session.reflection,
    rules: structuredClone(session.rules),
    scenario_set_policy: structuredClone(policy),
    observation_token: session.observation_token,
    audited_observation: session.audited_observation,
  }
}
export function parseScenarioSet(value: unknown, runId: string): ScenarioSet {
  try {
    return setData(value, runId)
  } catch {
    return invalid()
  }
}
function setData(value: unknown, runId: string): ScenarioSet {
  const response = value as components['schemas']['ScenarioSetResponse']
  if (
    !response ||
    !policyValid(response.policy) ||
    response.run?.id !== runId ||
    response.run.purpose !== 'practice' ||
    response.run.level_id !== 'm09-l03' ||
    !response.run.scenario_set ||
    !Array.isArray(response.completed_cases) ||
    !Array.isArray(response.issues)
  )
    return invalid()
  const link = response.run.scenario_set
  const completed = response.completed_cases
  const ids = completed.map((item) => item.case_id)
  const current = cases[completed.length] ?? null
  if (
    completed.length > 4 ||
    ids.some((id, index) => id !== cases[index]) ||
    new Set(completed.map((item) => item.session_id)).size !==
      completed.length ||
    new Set(completed.map((item) => item.generator_profile)).size !==
      completed.length ||
    completed.some((item) => !profiles.includes(item.generator_profile)) ||
    link.binding_id !== response.policy.id ||
    link.total_cases !== 4 ||
    link.current_case_id !== current ||
    response.current_case_id !== current ||
    JSON.stringify(link.completed_case_ids) !== JSON.stringify(ids) ||
    (current === null
      ? response.run.status !== 'completed' || response.session !== null
      : response.run.status !== 'active' ||
        response.run.current_step?.type !== 'simulation')
  )
    return invalid()
  const session =
    response.session === null
      ? null
      : parseScenarioSession(response.session, runId, current!)
  if (
    session &&
    (session.scenario_set_policy.content_version !==
      response.run.content_version ||
      session.scenario_set_policy.id !== response.policy.id ||
      session.scenario_set_policy.rubric_version !== 'interactive-3')
  )
    return invalid()
  return {
    run: parseLearningRun(response.run),
    policy: structuredClone(response.policy),
    current_case_id: current,
    session,
    completed_cases: structuredClone(completed),
    issues: structuredClone(response.issues),
  }
}
export async function readScenarioSet(
  owner: string,
  runId: string,
  signal?: AbortSignal,
  getOwnerId: () => string | null = () => authService.getUser()?.id ?? null,
  verify: () => Promise<string | null> = verifiedOwner,
): Promise<ScenarioSet> {
  await verifyOwner(owner, getOwnerId, verify)
  try {
    const result = parseScenarioSet(
      await api.call(apiEndpoints.resumeLearningScenarioSet, {
        path: { run_id: runId },
        signal,
      }),
      runId,
    )
    signal?.throwIfAborted()
    await verifyOwner(owner, getOwnerId, verify)
    return result
  } catch (error) {
    ownerCheck(owner, getOwnerId)
    throw error
  }
}
function validAction(action: ScenarioAction): boolean {
  if (!action || typeof action !== 'object') return false
  switch (action.kind) {
    case 'bind':
      return true
    case 'advance':
      return integer(action.steps, 1) && action.steps <= 5
    case 'cancel':
      return typeof action.orderId === 'string' && !!action.orderId
    case 'order': {
      const order = action.order
      return (
        !!order &&
        symbols.includes(order.symbol) &&
        ['buy', 'sell'].includes(order.side) &&
        ['market', 'limit', 'stop'].includes(order.type) &&
        integer(order.quantity, 1) &&
        order.quantity <= 5 &&
        (order.type === 'market' ||
          (money(order.price) && Number(order.price) > 0)) &&
        !!order.plan &&
        ['reason', 'risk', 'exit', 'size_reason'].every((field) => {
          const text = order.plan[field as 'reason']
          return (
            typeof text === 'string' &&
            text.trim().length >= 12 &&
            text.length <= 1500
          )
        }) &&
        money(order.plan.max_loss) &&
        Number(order.plan.max_loss) > 0 &&
        Number(order.plan.max_loss) <= 100
      )
    }
    case 'review': {
      const audit = action.audit
      return (
        !!audit &&
        cases.includes(audit.case_id) &&
        integer(audit.tick) &&
        integer(audit.engine_version, 1) &&
        typeof audit.observation_token === 'string' &&
        /^[a-f0-9]{64}$/.test(audit.observation_token) &&
        Array.isArray(audit.orders) &&
        audit.orders.length <= 8 &&
        audit.orders.every(
          (order) =>
            !!order &&
            typeof order.order_id === 'string' &&
            !!order.order_id &&
            [
              'open',
              'partial',
              'filled',
              'cancelled',
              'expired',
              'rejected',
            ].includes(order.status) &&
            integer(order.requested_quantity, 1) &&
            integer(order.filled_quantity) &&
            integer(order.remaining_quantity),
        ) &&
        Array.isArray(audit.positions) &&
        audit.positions.length <= 4 &&
        audit.positions.every(
          (position) =>
            !!position &&
            symbols.includes(position.symbol) &&
            integer(position.quantity, 1),
        ) &&
        [audit.cash, audit.session_fees, audit.benchmark_value].every(money) &&
        [
          'benchmark_is_gross',
          'profit_proves_process',
          'planned_loss_is_guaranteed',
        ].every(
          (field) => typeof audit[field as 'benchmark_is_gross'] === 'boolean',
        ) &&
        (audit.no_order_reason === null ||
          audit.no_order_reason === 'no_thesis_supplied')
      )
    }
    default:
      return false
  }
}
export class ScenarioSetCommands {
  private readonly owner: string
  private readonly runId: string
  private readonly storage: Storage
  private readonly getOwnerId: () => string | null
  private readonly verify: () => Promise<string | null>
  private readonly storageKey: string
  constructor(
    owner: string,
    runId: string,
    storage: Storage,
    getOwnerId: () => string | null = () => authService.getUser()?.id ?? null,
    verify: () => Promise<string | null> = verifiedOwner,
  ) {
    this.owner = owner
    this.runId = runId
    this.storage = storage
    this.getOwnerId = getOwnerId
    this.verify = verify
    this.storageKey =
      'scenario-set:1:' +
      encodeURIComponent(owner) +
      ':' +
      encodeURIComponent(runId) +
      ':pending'
  }
  pending(): ScenarioCommand | null {
    const raw = this.storage.getItem(this.storageKey)
    if (!raw) return null
    try {
      const saved = JSON.parse(raw) as ScenarioCommand
      if (
        saved.owner !== this.owner ||
        saved.runId !== this.runId ||
        !cases.includes(saved.caseId) ||
        typeof saved.key !== 'string' ||
        !keyPattern.test(saved.key) ||
        !validAction(saved.action) ||
        (saved.action.kind === 'review' &&
          saved.action.audit.case_id !== saved.caseId) ||
        (saved.action.kind === 'bind'
          ? saved.sessionId !== null
          : typeof saved.sessionId !== 'string' || !saved.sessionId)
      )
        throw Error()
      return saved
    } catch {
      throw Error(
        'The saved path action could not be read. Keep this tab and reload the activity; do not replace its recovery record.',
      )
    }
  }
  async submit(
    current: ScenarioSet,
    action: ScenarioAction,
  ): Promise<ScenarioSet> {
    ownerCheck(this.owner, this.getOwnerId)
    if (this.pending())
      throw Error(
        'Confirm the saved path action before making another decision.',
      )
    if (
      current.run.id !== this.runId ||
      !current.current_case_id ||
      current.run.status !== 'active' ||
      !validAction(action)
    )
      throw Error('Reload this path and choose a valid action.')
    const session = current.session
    if (action.kind === 'bind' ? session !== null : !session)
      throw Error('Reload the current path before this action.')
    if (
      session &&
      action.kind === 'advance' &&
      session.tick + action.steps >= session.total_ticks
    )
      throw Error('Advance only as far as this path’s final observation.')
    if (
      session &&
      action.kind === 'order' &&
      session.tick === session.total_ticks - 1
    )
      throw Error('The final observation does not accept new orders.')
    if (
      session &&
      action.kind === 'order' &&
      session.orders.length >= current.policy.max_orders
    )
      throw Error(
        'All eight permitted orders are recorded. Observe, cancel an open remainder or audit this path instead.',
      )
    if (session && action.kind === 'order' && action.order.side === 'buy') {
      const symbol = action.order.symbol
      const held =
        session.positions.find((position) => position.symbol === symbol)
          ?.quantity ?? 0
      const pending = session.orders
        .filter(
          (order) =>
            order.symbol === symbol &&
            order.side === 'buy' &&
            ['open', 'partial'].includes(order.status),
        )
        .reduce((sum, order) => sum + order.remaining, 0)
      if (
        held + pending + action.order.quantity >
        current.policy.max_asset_units
      )
        throw Error(
          'This path permits at most ten held units plus pending buys per asset.',
        )
    }
    if (
      session &&
      action.kind === 'review' &&
      (action.audit.case_id !== current.current_case_id ||
        action.audit.tick !== session.tick ||
        action.audit.engine_version !== session.version ||
        action.audit.observation_token !== session.observation_token ||
        session.tick !== session.total_ticks - 1)
    )
      throw Error(
        'Inspect the final current observation before auditing this path.',
      )
    const saved: ScenarioCommand = {
      owner: this.owner,
      runId: this.runId,
      caseId: current.current_case_id,
      sessionId: session?.id ?? null,
      key: crypto.randomUUID(),
      action: structuredClone(action),
    }
    this.storage.setItem(this.storageKey, JSON.stringify(saved))
    return this.send(saved)
  }
  async retry(): Promise<ScenarioSet> {
    ownerCheck(this.owner, this.getOwnerId)
    const saved = this.pending()
    if (!saved) throw Error('There is no saved path action to confirm.')
    return this.send(saved)
  }
  private async send(saved: ScenarioCommand): Promise<ScenarioSet> {
    let confirmed = false
    try {
      await verifyOwner(this.owner, this.getOwnerId, this.verify)
      const body = { idempotency_key: saved.key }
      let minimumCompleted = 0
      if (saved.action.kind === 'bind' || saved.action.kind === 'review') {
        const receipt = parseScenarioSet(
          saved.action.kind === 'bind'
            ? await api.call(apiEndpoints.bindLearningScenarioSet, {
                path: { run_id: this.runId },
                body: {
                  ...body,
                  case_id:
                    saved.caseId as components['schemas']['BindScenarioCase']['case_id'],
                },
              })
            : await api.call(apiEndpoints.reviewLearningScenarioCase, {
                path: { run_id: this.runId },
                body: { ...body, audit: saved.action.audit },
              }),
          this.runId,
        )
        confirmed = true
        if (
          saved.action.kind === 'bind'
            ? receipt.current_case_id !== saved.caseId || !receipt.session
            : receipt.current_case_id !== saved.caseId &&
              !receipt.completed_cases.some(
                (item) =>
                  item.case_id === saved.caseId &&
                  item.session_id === saved.sessionId,
              )
        )
          return invalid()
        minimumCompleted = receipt.completed_cases.length
      } else {
        const path = { session_id: saved.sessionId! }
        const value =
          saved.action.kind === 'order'
            ? await api.call(apiEndpoints.submitSimulationOrder, {
                path,
                body: { ...body, order: saved.action.order },
              })
            : saved.action.kind === 'advance'
              ? await api.call(apiEndpoints.advanceSimulation, {
                  path,
                  body: { ...body, steps: saved.action.steps },
                })
              : await api.call(apiEndpoints.cancelSimulationOrder, {
                  path: { ...path, order_id: saved.action.orderId },
                  body,
                })
        confirmed = true
        if (
          parseScenarioSession(value, this.runId, saved.caseId).id !==
          saved.sessionId
        )
          return invalid()
      }
      ownerCheck(this.owner, this.getOwnerId)
      const current = await readScenarioSet(
        this.owner,
        this.runId,
        undefined,
        this.getOwnerId,
        this.verify,
      )
      if (current.completed_cases.length < minimumCompleted) return invalid()
      ownerCheck(this.owner, this.getOwnerId)
      this.storage.removeItem(this.storageKey)
      return current
    } catch (error) {
      ownerCheck(this.owner, this.getOwnerId)
      if (
        !confirmed &&
        error instanceof HttpError &&
        error.kind === 'http' &&
        error.status !== null &&
        [400, 403, 404, 409, 422].includes(error.status)
      ) {
        await verifyOwner(this.owner, this.getOwnerId, this.verify)
        this.storage.removeItem(this.storageKey)
      }
      throw error
    }
  }
}
export function scenarioSetError(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.status === 401)
      return 'Your session expired. Sign in with the same account before confirming saved actions.'
    if (error.status === 403)
      return 'Complete the first eight chapter checks before starting this integrated practice.'
    if (error.status === 503)
      return 'This lesson is awaiting publication review. Saved actions are retained.'
    if (typeof error.details === 'string') return error.details
    if (
      error.details &&
      typeof error.details === 'object' &&
      'message' in error.details &&
      typeof error.details.message === 'string'
    )
      return error.details.message
    if (error.status === 422)
      return 'Check the path constraints and required fields, then try a corrected action.'
    if (error.status === 409)
      return 'The saved observation changed. Reload its current facts before trying again.'
    if (error.status === 404)
      return 'This saved activity is unavailable for the signed-in account.'
  }
  return error instanceof Error && !(error instanceof HttpError)
    ? error.message
    : 'The response could not be confirmed. Confirm the saved action before making another decision.'
}
