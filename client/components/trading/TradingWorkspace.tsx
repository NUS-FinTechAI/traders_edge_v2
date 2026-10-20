import { useId, useState, type FormEvent } from 'react'
import type { components } from '../../api/api-types.ts'
import './TradingWorkspace.css'

export type TradingObservation = components['schemas']['SimulationObservation']
export type TradingOrder = components['schemas']['OrderInput']

type Player = TradingObservation

export function MarketPanel({ player }: { player: Player }) {
  const prefix = useId()
  const [symbol, setSymbol] = useState(player.quotes[0].symbol)
  const prices = player.history[symbol].map(Number)
  const low = Math.min(...prices),
    high = Math.max(...prices)
  const points = prices
    .map(
      (price, index) =>
        `${12 + (index / Math.max(1, prices.length - 1)) * 576},${158 - ((price - low) / (high - low || 1)) * 136}`,
    )
    .join(' ')
  return (
    <section className="trading-section" aria-labelledby={`${prefix}-title`}>
      <h2 id={`${prefix}-title`}>Observed market</h2>
      <p>
        Quotes and history stop at your current observation. The midpoint values
        holdings; buys use the ask and sells use the bid on a later observation,
        with execution costs.
      </p>
      <p>Scroll tables sideways to see every column.</p>
      <div
        className="trading-table"
        role="region"
        aria-label="Current market quotes"
        tabIndex={0}
      >
        <table>
          <caption>Quotes at observation {player.tick}</caption>
          <thead>
            <tr>
              <th scope="col">Asset</th>
              <th scope="col">Midpoint</th>
              <th scope="col">Bid</th>
              <th scope="col">Ask</th>
              <th scope="col">Available units</th>
            </tr>
          </thead>
          <tbody>
            {player.quotes.map((quote) => (
              <tr key={quote.symbol}>
                <th scope="row">{quote.symbol}</th>
                <td>{quote.mid}</td>
                <td>{quote.bid}</td>
                <td>{quote.ask}</td>
                <td>{quote.available_units}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label htmlFor={`${prefix}-asset`}>Asset history</label>
      <select
        id={`${prefix}-asset`}
        value={symbol}
        onChange={(event) => setSymbol(event.target.value as typeof symbol)}
      >
        {player.quotes.map((quote) => (
          <option key={quote.symbol} value={quote.symbol}>
            {quote.symbol}
          </option>
        ))}
      </select>
      <figure className="trading-chart">
        <figcaption>
          {symbol} midpoint · lowest {low.toFixed(2)}, highest {high.toFixed(2)}
        </figcaption>
        <svg
          viewBox="0 0 600 180"
          role="img"
          aria-label={`${symbol} midpoint history through observation ${player.tick}; exact values follow in the table.`}
        >
          <line
            x1="12"
            y1="158"
            x2="588"
            y2="158"
            className="trading-chart-axis"
          />
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          {prices.length === 1 && (
            <circle cx="12" cy="158" r="4" fill="currentColor" />
          )}
        </svg>
      </figure>
      <details>
        <summary>Exact observed {symbol} prices</summary>
        <div
          className="trading-table"
          role="region"
          aria-label={`${symbol} observed history`}
          tabIndex={0}
        >
          <table>
            <caption>Observed midpoints only</caption>
            <thead>
              <tr>
                <th scope="col">Observation</th>
                <th scope="col">Midpoint</th>
              </tr>
            </thead>
            <tbody>
              {player.history[symbol].map((price, tick) => (
                <tr key={tick}>
                  <th scope="row">{tick}</th>
                  <td>{price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}

export function PortfolioPanel({
  player,
  disabled,
  cancel,
}: {
  player: Player
  disabled: boolean
  cancel?: (id: string) => void
}) {
  return (
    <section className="trading-section">
      <h2>Your portfolio and execution record</h2>
      <dl className="trading-balances">
        <div>
          <dt>Cash</dt>
          <dd>{player.cash}</dd>
        </div>
        <div>
          <dt>Unreserved cash</dt>
          <dd>{player.available_cash}</dd>
        </div>
        <div>
          <dt>Portfolio value</dt>
          <dd>{player.equity}</dd>
        </div>
        <div>
          <dt>Fees paid</dt>
          <dd>{player.fees}</dd>
        </div>
        <div>
          <dt>Largest observed drawdown</dt>
          <dd>{player.max_drawdown_percent}%</dd>
        </div>
        <div>
          <dt>Passive basket value</dt>
          <dd>{player.benchmark_value}</dd>
        </div>
      </dl>
      <details>
        <summary>What does this comparison mean?</summary>
        <p>{player.rules.benchmark}</p>
        <p>
          Drawdown is the largest observed fall from an earlier portfolio peak.
          Portfolio outcomes and the passive comparison are context, not a
          learning score.
        </p>
      </details>
      {player.positions.length ? (
        <div
          className="trading-table"
          role="region"
          aria-label="Current holdings"
          tabIndex={0}
        >
          <table>
            <caption>Holdings at observation {player.tick}</caption>
            <thead>
              <tr>
                <th scope="col">Asset</th>
                <th scope="col">Units</th>
                <th scope="col">Recorded cost</th>
                <th scope="col">Current value</th>
                <th scope="col">Portfolio weight</th>
                <th scope="col">Realized profit</th>
              </tr>
            </thead>
            <tbody>
              {player.positions.map((position) => (
                <tr key={position.symbol}>
                  <th scope="row">{position.symbol}</th>
                  <td>{position.quantity}</td>
                  <td>{position.cost}</td>
                  <td>{position.value}</td>
                  <td>{position.weight_percent}%</td>
                  <td>{position.realized}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No units held. Remaining in cash is a valid game decision.</p>
      )}
      <h3>Recorded orders</h3>
      {player.orders.length ? (
        <div
          className="trading-table"
          role="region"
          aria-label="Recorded orders"
          tabIndex={0}
        >
          <table>
            <caption>
              Scroll sideways for status, fills and cancellation
            </caption>
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Asset / side</th>
                <th scope="col">Type / price</th>
                <th scope="col">Units</th>
                <th scope="col">Filled</th>
                <th scope="col">Remaining</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {player.orders.map((order) => (
                <tr key={order.id}>
                  <th scope="row">{order.id}</th>
                  <td>
                    {order.symbol} / {order.side}
                  </td>
                  <td>
                    {order.type} {order.price ?? 'next executable quote'}
                  </td>
                  <td>{order.quantity}</td>
                  <td>{order.filled}</td>
                  <td>{order.remaining}</td>
                  <td>
                    {order.status}
                    {order.triggered ? ' · triggered' : ''}
                  </td>
                  <td>
                    {['open', 'partial'].includes(order.status) &&
                    !player.finished &&
                    cancel ? (
                      <button
                        disabled={disabled}
                        onClick={() => cancel(order.id)}
                      >
                        Cancel {order.id} remainder
                      </button>
                    ) : ['open', 'partial'].includes(order.status) ? (
                      'Read only'
                    ) : (
                      'No open remainder'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No orders recorded.</p>
      )}
      {!!player.orders.length && (
        <details>
          <summary>Read your saved order plans</summary>
          {player.orders.map((order) => (
            <article className="trading-saved-plan" key={order.id}>
              <h4>
                {order.id} · {order.symbol}
              </h4>
              <dl>
                <dt>Reason</dt>
                <dd>{order.plan.reason}</dd>
                <dt>Risk</dt>
                <dd>{order.plan.risk}</dd>
                <dt>Reconsideration</dt>
                <dd>{order.plan.exit}</dd>
                <dt>Size reasoning</dt>
                <dd>{order.plan.size_reason}</dd>
                <dt>Planned loss boundary</dt>
                <dd>{order.plan.max_loss} · an intention, not a guarantee</dd>
              </dl>
            </article>
          ))}
        </details>
      )}
      {!!player.fills.length && (
        <details>
          <summary>Executed fills and fees</summary>
          <div
            className="trading-table"
            role="region"
            aria-label="Executed fills"
            tabIndex={0}
          >
            <table>
              <caption>Actual executions, including partial fills</caption>
              <thead>
                <tr>
                  <th scope="col">Observation</th>
                  <th scope="col">Order</th>
                  <th scope="col">Asset / side</th>
                  <th scope="col">Units</th>
                  <th scope="col">Fill price</th>
                  <th scope="col">Fee</th>
                </tr>
              </thead>
              <tbody>
                {player.fills.map((fill, index) => (
                  <tr key={`${fill.order_id}-${index}`}>
                    <th scope="row">{fill.tick}</th>
                    <td>{fill.order_id}</td>
                    <td>
                      {fill.symbol} / {fill.side}
                    </td>
                    <td>{fill.quantity}</td>
                    <td>{fill.price}</td>
                    <td>{fill.fee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  )
}

export function TradingOrderForm({
  player,
  disabled,
  submit,
}: {
  player: Player
  disabled: boolean
  submit: (order: TradingOrder) => void
}) {
  const prefix = useId()
  const [orderType, setOrderType] = useState<TradingOrder['type']>('market')
  function place(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const value = (key: string) => String(data.get(key) ?? '').trim()
    submit({
      symbol: value('symbol') as TradingOrder['symbol'],
      side: value('side') as TradingOrder['side'],
      type: orderType,
      quantity: Number(data.get('quantity')),
      ...(orderType === 'market' ? {} : { price: value('price') }),
      plan: {
        reason: value('reason'),
        risk: value('risk'),
        exit: value('exit'),
        size_reason: value('size_reason'),
        max_loss: value('max_loss'),
      },
    })
  }
  return (
    <details className="trading-section">
      <summary>Plan an optional order</summary>
      <p>
        Write the plan before submitting any order. You can observe and finish
        without placing orders. No reward depends on trading frequency or order
        size.
      </p>
      <p>
        Each asset is capped at {player.rules.max_asset_weight_percent}% of
        portfolio value when buying. Sell only units you hold and have not
        reserved. This simulator is long-only, without leverage.
      </p>
      <form onSubmit={place}>
        <fieldset disabled={disabled}>
          <legend>Order and prior written plan</legend>
          <label htmlFor={`${prefix}-symbol`}>Asset</label>
          <select id={`${prefix}-symbol`} name="symbol">
            {player.quotes.map((quote) => (
              <option key={quote.symbol} value={quote.symbol}>
                {quote.symbol}
              </option>
            ))}
          </select>
          <label htmlFor={`${prefix}-side`}>Side</label>
          <select id={`${prefix}-side`} name="side">
            <option value="buy">Buy</option>
            <option value="sell">Sell held units</option>
          </select>
          <label htmlFor={`${prefix}-type`}>Order type</label>
          <select
            id={`${prefix}-type`}
            name="type"
            value={orderType}
            onChange={(event) =>
              setOrderType(event.target.value as TradingOrder['type'])
            }
          >
            <option value="market">Market</option>
            <option value="limit">Limit</option>
            <option value="stop">Stop</option>
          </select>
          <p>
            {orderType === 'market'
              ? 'Market orders use a later executable quote; the displayed price is not guaranteed.'
              : orderType === 'limit'
                ? 'A buy limit caps the unit price before fees; a sell limit sets a minimum. Neither guarantees execution or a complete fill.'
                : 'A stop triggers on the observed midpoint and becomes a market order. A gap may produce a worse fill than the trigger price.'}
          </p>
          <label htmlFor={`${prefix}-quantity`}>
            Whole units (1–1,000, within available funds or holdings)
          </label>
          <input
            id={`${prefix}-quantity`}
            name="quantity"
            type="number"
            min="1"
            max="1000"
            step="1"
            required
          />
          {orderType !== 'market' && (
            <>
              <label htmlFor={`${prefix}-price`}>
                {orderType === 'limit'
                  ? 'Limit price per unit'
                  : 'Stop trigger price per unit'}
              </label>
              <input
                id={`${prefix}-price`}
                name="price"
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                required
                inputMode="decimal"
              />
            </>
          )}
          {(
            [
              ['reason', 'What observed evidence supports this order?'],
              ['risk', 'What could go wrong?'],
              ['exit', 'When would you reconsider or exit?'],
              ['size_reason', 'Why this position size?'],
            ] as const
          ).map(([name, label]) => (
            <div key={name}>
              <label htmlFor={`${prefix}-${name}`}>{label}</label>
              <textarea
                id={`${prefix}-${name}`}
                name={name}
                minLength={12}
                maxLength={1500}
                rows={3}
                required
              />
            </div>
          ))}
          <label htmlFor={`${prefix}-loss`}>
            Planned loss boundary (simulated funds)
          </label>
          <input
            id={`${prefix}-loss`}
            name="max_loss"
            type="number"
            min="0.01"
            max={player.equity}
            step="0.01"
            inputMode="decimal"
            required
            aria-describedby={`${prefix}-loss-help`}
          />
          <p id={`${prefix}-loss-help`}>
            This records an intention; it is not an automatic exit or guaranteed
            maximum loss. Each plan explanation needs at least 12 characters.
          </p>
          <button type="submit">Submit planned order</button>
        </fieldset>
      </form>
    </details>
  )
}

export default function TradingWorkspace({
  observation,
  onOrder,
  onCancel,
  busy = false,
  readOnly = false,
}: {
  observation: TradingObservation
  onOrder?: (order: TradingOrder) => void
  onCancel?: (orderId: string) => void
  busy?: boolean
  readOnly?: boolean
}) {
  return (
    <div className="trading-workspace">
      <MarketPanel player={observation} />
      <PortfolioPanel
        player={observation}
        disabled={busy || readOnly}
        cancel={readOnly ? undefined : onCancel}
      />
      {!readOnly && !observation.finished && onOrder && (
        <TradingOrderForm
          player={observation}
          disabled={busy}
          submit={onOrder}
        />
      )}
    </div>
  )
}
