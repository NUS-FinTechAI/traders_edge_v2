import { useResource, dateLabel } from '../hooks'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { post } from '../api'
import type { Curriculum } from '../api'
import { Notice, PageTitle, ResourceState } from '../components/ui'

type Plan = {
  reason: string
  risk: string
  exit: string
  size_reason: string
  max_loss: string
}
type Order = {
  id: string
  symbol: string
  side: string
  type: string
  quantity: number
  remaining: number
  filled: number
  price: string | null
  status: string
  plan: Plan
  reason?: string
}
type Simulation = {
  id: string
  mode: string
  tick: number
  total_ticks: number
  scenario: string
  finished: boolean
  cash: string
  available_cash: string
  equity: string
  fees: string
  positions: {
    symbol: string
    quantity: number
    value: string
    weight_percent: string
  }[]
  orders: Order[]
  quotes: {
    symbol: string
    bid: string
    ask: string
    mid: string
    available_units: number
  }[]
  fills: {
    order_id: string
    tick: number
    symbol: string
    side: string
    quantity: number
    price: string
    fee: string
  }[]
  history: Record<string, string[]>
  benchmark_value: string
  max_drawdown_percent: string
  reflection: string | null
  rules: {
    fee_rate: string
    first_fill_fee: string
    spread_percent: string
    settlement: string
    benchmark: string
  }
}
const amount = (value: string) =>
  Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
function useCommand() {
  const pending = useRef({ path: '', serialized: '', key: '' })
  return async function command<T>(path: string, payload: unknown): Promise<T> {
    const serialized = JSON.stringify(payload)
    if (
      pending.current.path !== path ||
      pending.current.serialized !== serialized
    )
      pending.current = { path, serialized, key: crypto.randomUUID() }
    const result = await post<T>(path, {
      ...(payload as object),
      idempotency_key: pending.current.key,
    })
    pending.current = { path: '', serialized: '', key: '' }
    return result
  }
}
export function Simulations({
  curriculum,
  id,
}: {
  curriculum: Curriculum
  id?: string
}) {
  return id ? (
    <SimulationSession key={id} id={id} />
  ) : (
    <SimulationList curriculum={curriculum} />
  )
}
function SimulationList({ curriculum }: { curriculum: Curriculum }) {
  const resource = useResource<{
    sessions: {
      id: string
      mode: string
      tick: number
      finished: boolean
      updated_at: string
    }[]
  }>('/simulations')
  const command = useCommand(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  async function start(mode: 'guided' | 'endless') {
    setBusy(true)
    setError('')
    try {
      const session = await command<Simulation>('/simulations', { mode })
      location.hash = `/simulation/${session.id}`
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="Reason, plan, observe, reflect"
        description="Controlled synthetic scenarios let you inspect uncertainty and execution costs without real money."
      >
        Practice your decisions
      </PageTitle>
      <section className="learning-section">
        <h2>Guided simulation</h2>
        <p>
          Use a written plan before every order. You can also choose to observe
          without trading. Prices advance only when you choose the next
          observation.
        </p>
        {curriculum.practice_eligibility.simulation ? (
          <button
            className="button"
            disabled={busy}
            onClick={() => void start('guided')}
          >
            {busy ? 'Opening practice…' : 'Start guided practice'}
          </button>
        ) : (
          <Notice>
            Locked · pass the first four module mastery checks.{' '}
            <a href="#/path">Review prerequisites →</a>
          </Notice>
        )}
      </section>
      <details className="definition">
        <summary>Endless practice prerequisites</summary>
        <p>
          This mode offers repeatable bounded scenarios after mastery of Modules
          1–9. It does not reward frequent trading.
        </p>
        {curriculum.practice_eligibility.endless ? (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void start('endless')}
          >
            Start another practice scenario
          </button>
        ) : (
          <p>Locked · pass the first nine module mastery checks.</p>
        )}
      </details>
      {error && <Notice error>{error}</Notice>}
      <section className="learning-section">
        <h2>Saved practice</h2>
        <ResourceState {...resource} />
        {resource.data?.sessions.length === 0 && (
          <p>No saved scenarios yet. Complete the prerequisites to begin.</p>
        )}
        <ul className="item-list">
          {resource.data?.sessions.map((session) => (
            <li key={session.id}>
              <div>
                <h3>
                  {session.mode === 'guided' ? 'Guided' : 'Endless'} practice
                </h3>
                <p className="small">
                  Observation {session.tick + 1} ·{' '}
                  {session.finished ? 'Reflection recorded' : 'In progress'} ·{' '}
                  {dateLabel(session.updated_at)}
                </p>
              </div>
              <a
                className="button secondary"
                href={`#/simulation/${session.id}`}
              >
                {session.finished ? 'Review' : 'Resume'} scenario →
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
function SimulationSession({ id }: { id: string }) {
  const resource = useResource<Simulation>(
    `/simulations/${encodeURIComponent(id)}`,
  )
  const [updated, setUpdated] = useState<Simulation | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const [symbol, setSymbol] = useState('NORTH'),
    [side, setSide] = useState('buy'),
    [type, setType] = useState('limit'),
    [quantity, setQuantity] = useState('1'),
    [price, setPrice] = useState(''),
    [reflection, setReflection] = useState('')
  const [plan, setPlan] = useState<Plan>({
    reason: '',
    risk: '',
    exit: '',
    size_reason: '',
    max_loss: '',
  })
  const command = useCommand(),
    state = updated || resource.data
  async function execute(path: string, body: unknown, message: string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const next = await command<Simulation>(`/simulations/${id}${path}`, body)
      setUpdated(next)
      setNotice(message)
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }
  async function submitOrder(event: FormEvent) {
    event.preventDefault()
    const success = await execute(
      '/orders',
      {
        symbol,
        side,
        type,
        quantity: Number(quantity),
        ...(type !== 'market' ? { price } : {}),
        plan,
      },
      'Your planned order is recorded. It can fill on a later observation, subject to price, liquidity and risk limits.',
    )
    if (success)
      setPlan({ reason: '', risk: '', exit: '', size_reason: '', max_loss: '' })
  }
  return (
    <>
      <a className="back" href="#/simulation">
        ← Saved practice
      </a>
      <PageTitle
        eyebrow="Synthetic market · no real money"
        description="Observe uncertainty and compare your decisions with your written plan."
      >
        {state?.finished ? 'Review your scenario' : 'A decision needs a plan'}
      </PageTitle>
      <ResourceState
        loading={!state && resource.loading}
        error={resource.error}
        reload={resource.reload}
      />
      {state && (
        <>
          <p className="small">
            Observation {state.tick + 1} of {state.total_ticks}. Future prices
            remain hidden.
          </p>
          <section className="simulation-overview">
            <dl className="stats">
              <div>
                <dt>Available cash</dt>
                <dd>{amount(state.available_cash)}</dd>
              </div>
              <div>
                <dt>Portfolio value</dt>
                <dd>{amount(state.equity)}</dd>
              </div>
              <div>
                <dt>Execution fees</dt>
                <dd>{amount(state.fees)}</dd>
              </div>
            </dl>
            <p className="small">
              Values use synthetic currency units. Portfolio returns never award
              XP or determine a rank.
            </p>
          </section>
          <section className="learning-section">
            <h2>Current observations</h2>
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Current synthetic asset quotes"
            >
              <table>
                <caption>
                  Bid is the quoted sell price; ask is the quoted buy price.
                </caption>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Bid</th>
                    <th>Ask</th>
                    <th>Units available</th>
                  </tr>
                </thead>
                <tbody>
                  {state.quotes.map((quote) => (
                    <tr key={quote.symbol}>
                      <th>{quote.symbol}</th>
                      <td>{amount(quote.bid)}</td>
                      <td>{amount(quote.ask)}</td>
                      <td>{quote.available_units}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details className="definition">
              <summary>View observed price history</summary>
              <label htmlFor="history-symbol">Example asset</label>
              <select
                id="history-symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              >
                {state.quotes.map((quote) => (
                  <option key={quote.symbol}>{quote.symbol}</option>
                ))}
              </select>
              <PriceHistory
                values={state.history[symbol] || []}
                symbol={symbol}
              />
            </details>
            {!state.finished && state.tick < state.total_ticks - 1 && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void execute(
                    '/advance',
                    { steps: 1 },
                    'The next observation is saved. Review prices, fills and your plan before deciding again.',
                  )
                }
              >
                {busy ? 'Saving observation…' : 'Observe the next step'}
              </button>
            )}
          </section>
          {error && <Notice error>{error}</Notice>}
          {notice && <Notice>{notice}</Notice>}
          {!state.finished && state.tick < state.total_ticks - 1 && (
            <section className="learning-section">
              <h2>Write a plan before an order</h2>
              <p>
                Doing nothing is a valid decision. Each asset is capped at 25%
                of portfolio value; borrowing and short selling are unavailable.
              </p>
              <form onSubmit={submitOrder} className="order-form">
                <div className="form-grid">
                  <label>
                    Example asset
                    <select
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                    >
                      {state.quotes.map((quote) => (
                        <option key={quote.symbol}>{quote.symbol}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Side
                    <select
                      value={side}
                      onChange={(e) => setSide(e.target.value)}
                    >
                      <option value="buy">Buy</option>
                      <option value="sell">Sell units already held</option>
                    </select>
                  </label>
                  <label>
                    Order type
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                    >
                      <option value="limit">Limit</option>
                      <option value="market">Market</option>
                      <option value="stop">Stop</option>
                    </select>
                  </label>
                  <label>
                    Whole units
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      step={1}
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </label>
                  {type !== 'market' && (
                    <label>
                      {type === 'limit' ? 'Limit price' : 'Stop trigger price'}
                      <input
                        type="number"
                        min="0.01"
                        max="1000000"
                        step="0.01"
                        required
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                      />
                    </label>
                  )}
                </div>
                <p className="small">
                  {type === 'limit'
                    ? 'A limit controls the acceptable price; it may not fill.'
                    : type === 'stop'
                      ? 'A triggered stop becomes a market order. Its execution price is not guaranteed.'
                      : 'A market order can execute at a different price when the next observation arrives.'}
                </p>
                {(
                  [
                    {
                      key: 'reason',
                      label: 'Why is this decision appropriate?',
                    },
                    { key: 'risk', label: 'What could go wrong?' },
                    {
                      key: 'exit',
                      label: 'When would you exit or reconsider?',
                    },
                    {
                      key: 'size_reason',
                      label: 'Why is this position size appropriate?',
                    },
                  ] as const
                ).map((field) => (
                  <label className="plan-field" key={field.key}>
                    {field.label}
                    <textarea
                      required
                      minLength={12}
                      maxLength={1500}
                      value={plan[field.key]}
                      onChange={(e) =>
                        setPlan({ ...plan, [field.key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <label>
                  Planned loss boundary, in synthetic currency
                  <input
                    type="number"
                    min="0.01"
                    max={state.equity}
                    step="0.01"
                    required
                    value={plan.max_loss}
                    onChange={(e) =>
                      setPlan({ ...plan, max_loss: e.target.value })
                    }
                  />
                </label>
                <p className="small">
                  This records your boundary; it is not a guaranteed maximum
                  loss or an automatic stop.
                </p>
                <button className="button" disabled={busy}>
                  Record plan and submit simulated order
                </button>
              </form>
            </section>
          )}
          <section className="learning-section">
            <h2>Your orders and plans</h2>
            {state.orders.length === 0 && (
              <p>
                No orders. You can continue observing and later reflect on why
                you chose not to trade.
              </p>
            )}
            <ul className="order-list">
              {state.orders.map((order) => (
                <li key={order.id}>
                  <h3>
                    {order.side === 'buy' ? 'Buy' : 'Sell'} {order.quantity}{' '}
                    {order.symbol} · {order.type}
                  </h3>
                  <p>
                    {order.status} · {order.filled} filled, {order.remaining}{' '}
                    remaining{order.price ? ` · Price ${order.price}` : ''}
                  </p>
                  {order.reason && <p>{order.reason}</p>}
                  <details className="definition">
                    <summary>Read this order's plan</summary>
                    <dl>
                      {Object.entries(order.plan).map(([key, value]) => (
                        <div key={key}>
                          <dt>
                            {
                              (
                                {
                                  reason: 'Reason',
                                  risk: 'Risk',
                                  exit: 'Exit or reconsideration',
                                  size_reason: 'Position size',
                                  max_loss: 'Planned loss boundary',
                                } as Record<string, string>
                              )[key]
                            }
                          </dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                  {['open', 'partial'].includes(order.status) && (
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        void execute(
                          `/orders/${order.id}/cancel`,
                          {},
                          'The remaining order is cancelled. Existing fills are unchanged.',
                        )
                      }
                    >
                      Cancel remaining units
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section className="learning-section">
            <h2>Holdings and execution</h2>
            {state.positions.length === 0 ? (
              <p>No units are held.</p>
            ) : (
              <ul className="item-list">
                {state.positions.map((position) => (
                  <li key={position.symbol}>
                    <strong>{position.symbol}</strong>
                    <span>
                      {position.quantity} units · {position.weight_percent}%
                      exposure · value {amount(position.value)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <details className="definition">
              <summary>Execution details and costs</summary>
              <p>
                Spread: {state.rules.spread_percent}%. Variable fee:{' '}
                {Number(state.rules.fee_rate) * 100}%; first-fill fee:{' '}
                {state.rules.first_fill_fee}. Price impact and available units
                can cause partial fills.
              </p>
              <p>{state.rules.settlement}.</p>
              {state.fills.length > 0 ? (
                <ul className="fill-list">
                  {state.fills.map((fill, index) => (
                    <li key={index}>
                      Observation {fill.tick + 1}: {fill.side} {fill.quantity}{' '}
                      {fill.symbol} at {fill.price}; fee {fill.fee}.
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No fills recorded.</p>
              )}
            </details>
          </section>
          <section className="learning-section">
            <h2>Review the decision process</h2>
            <p>
              Largest observed portfolio drawdown: {state.max_drawdown_percent}
              %. Passive comparison value: {amount(state.benchmark_value)}.
            </p>
            <p className="small">{state.rules.benchmark}</p>
            {state.finished ? (
              <div className="feedback">
                <h3>Your recorded reflection</h3>
                <p className="prose">{state.reflection}</p>
                <p className="small">
                  This is a record of your reasoning, not an automated judgment
                  of its quality.
                </p>
              </div>
            ) : state.tick < 10 ? (
              <Notice>
                Observe at least ten steps before recording your reflection. You
                do not need to place an order.
              </Notice>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void execute(
                    '/debrief',
                    { reflection },
                    'Your reflection is saved and the scenario is closed.',
                  )
                }}
              >
                <label htmlFor="debrief">
                  What risk did you notice, how did you follow or change your
                  plan, and what would you reconsider?
                </label>
                <textarea
                  id="debrief"
                  required
                  minLength={30}
                  maxLength={1500}
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                />
                <p className="small">
                  30–1,500 characters. Finishing cancels open orders and saves
                  this scenario for review.
                </p>
                <button className="button" disabled={busy}>
                  Save reflection and finish scenario
                </button>
              </form>
            )}
          </section>
        </>
      )}
    </>
  )
}
function PriceHistory({
  values,
  symbol,
}: {
  values: string[]
  symbol: string
}) {
  const numbers = values.map(Number),
    low = Math.min(...numbers),
    high = Math.max(...numbers),
    span = high - low || 1
  const points = numbers
    .map(
      (value, index) =>
        `${20 + (index / Math.max(1, numbers.length - 1)) * 460},${160 - ((value - low) / span) * 140}`,
    )
    .join(' ')
  return (
    <>
      <svg
        className="price-history"
        viewBox="0 0 500 190"
        role="img"
        aria-label={`${symbol}, ${numbers.length} observed prices. Exact values follow in a table.`}
      >
        <polyline
          points={points}
          fill="none"
          stroke="#3155cc"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />
        {numbers.length === 1 && (
          <circle cx="20" cy="160" r="4" fill="#3155cc" />
        )}
      </svg>
      <div
        className="table-scroll history-values"
        tabIndex={0}
        role="region"
        aria-label={`${symbol} historical values`}
      >
        <table>
          <caption>Observed {symbol} midpoint prices only</caption>
          <thead>
            <tr>
              <th>Observation</th>
              <th>Midpoint</th>
            </tr>
          </thead>
          <tbody>
            {values.map((value, index) => (
              <tr key={index}>
                <th>{index + 1}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
