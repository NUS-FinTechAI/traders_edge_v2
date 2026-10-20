import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { components } from '../../../../api/api-types.ts'
import type {
  ScenarioAudit,
  ScenarioOrder,
  ScenarioSession,
} from '../../../../services/scenarioSetService.ts'

export function ScenarioOrderForm({
  session,
  disabled,
  maxOrders,
  submit,
}: {
  session: ScenarioSession
  disabled: boolean
  maxOrders: number
  submit: (order: ScenarioOrder) => void
}) {
  const prefix = useId()
  const [type, setType] = useState<ScenarioOrder['type']>('market')
  const [symbol, setSymbol] = useState(session.quotes[0].symbol)
  const [side, setSide] = useState<ScenarioOrder['side']>('buy')
  const policy = session.scenario_set_policy
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
  const capped = session.orders.length >= maxOrders
  function order(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const text = (name: string) => String(fields.get(name) ?? '').trim()
    submit({
      symbol: symbol as ScenarioOrder['symbol'],
      side,
      type,
      quantity: Number(fields.get('quantity')),
      ...(type === 'market' ? {} : { price: text('price') }),
      plan: {
        reason: text('reason'),
        risk: text('risk'),
        exit: text('exit'),
        size_reason: text('size_reason'),
        max_loss: text('max_loss'),
      },
    })
  }
  return (
    <details className="simulation-section">
      <summary>Optional order and prior written plan</summary>
      <p>
        This fictional brief supplies no investment thesis. Observing without
        orders is valid. If you choose an order, write its plan before
        submitting.
      </p>
      <p>
        Each order allows at most {policy.max_order_quantity} units and a
        declared loss boundary up to {policy.max_planned_loss}. Each asset
        allows at most {policy.max_asset_units} held units plus pending buys.
        These are this case’s constraints, not investment advice or guaranteed
        loss limits.
      </p>
      <p>
        {session.orders.length} of {maxOrders} permitted orders recorded,
        including cancelled orders.{' '}
        {Math.max(0, maxOrders - session.orders.length)} remain.
      </p>
      {capped && (
        <p>
          The order limit is reached. You can still cancel an open remainder,
          observe and audit this path.
        </p>
      )}
      <form onSubmit={order}>
        <fieldset
          disabled={
            disabled || capped || session.tick === session.total_ticks - 1
          }
        >
          <legend>Order and written plan</legend>
          <label htmlFor={prefix + '-asset'}>Asset</label>
          <select
            id={prefix + '-asset'}
            name="symbol"
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
          >
            {session.quotes.map((quote) => (
              <option key={quote.symbol} value={quote.symbol}>
                {quote.symbol}
              </option>
            ))}
          </select>
          <p>
            {symbol}: {held} held units and {pending} pending buy units, against
            the {policy.max_asset_units}-unit ceiling.
          </p>
          <label htmlFor={prefix + '-side'}>Side</label>
          <select
            id={prefix + '-side'}
            name="side"
            value={side}
            onChange={(event) =>
              setSide(event.target.value as ScenarioOrder['side'])
            }
          >
            <option value="buy">Buy</option>
            <option value="sell">Sell unreserved held units</option>
          </select>
          <label htmlFor={prefix + '-type'}>Order type</label>
          <select
            id={prefix + '-type'}
            name="type"
            value={type}
            onChange={(event) =>
              setType(event.target.value as ScenarioOrder['type'])
            }
          >
            <option value="market">Market</option>
            <option value="limit">Limit</option>
            <option value="stop">Stop</option>
          </select>
          <p>
            {type === 'market'
              ? 'A market order uses a later executable quote. The displayed price is not guaranteed.'
              : type === 'limit'
                ? 'A buy limit caps the unit price before fees; a sell limit sets a minimum. Neither guarantees a complete fill.'
                : 'A stop triggers on an observed midpoint and becomes a market order. A gap can produce a worse fill than the trigger price.'}
          </p>
          <label htmlFor={prefix + '-quantity'}>
            Whole units (1–{policy.max_order_quantity})
          </label>
          <input
            id={prefix + '-quantity'}
            name="quantity"
            type="number"
            min="1"
            max={policy.max_order_quantity}
            step="1"
            required
          />
          {type !== 'market' && (
            <>
              <label htmlFor={prefix + '-price'}>
                {type === 'limit'
                  ? 'Limit price per unit'
                  : 'Stop trigger price per unit'}
              </label>
              <input
                id={prefix + '-price'}
                name="price"
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                inputMode="decimal"
                required
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
              <label htmlFor={prefix + '-' + name}>{label}</label>
              <textarea
                id={prefix + '-' + name}
                name={name}
                minLength={12}
                maxLength={1500}
                rows={3}
                required
              />
            </div>
          ))}
          <label htmlFor={prefix + '-loss'}>
            Declared loss boundary (at most {policy.max_planned_loss})
          </label>
          <input
            id={prefix + '-loss'}
            name="max_loss"
            type="number"
            min="0.01"
            max={policy.max_planned_loss}
            step="0.01"
            inputMode="decimal"
            required
            aria-describedby={prefix + '-loss-help'}
          />
          <p id={prefix + '-loss-help'}>
            This records an intention. It is not an automatic exit or guaranteed
            maximum loss. Each written explanation needs at least 12 characters;
            that check does not grade reasoning quality.
          </p>
          <button type="submit">Submit planned order</button>
        </fieldset>
      </form>
    </details>
  )
}

export function ScenarioAuditForm({
  session,
  disabled,
  submit,
}: {
  session: ScenarioSession
  disabled: boolean
  submit: (audit: ScenarioAudit) => void
}) {
  const prefix = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const final = session.tick === session.total_ticks - 1
  useEffect(() => {
    if (final) heading.current?.focus()
  }, [final])
  function audit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    submit({
      case_id: session.scenario_set_policy.case_id,
      tick: session.tick,
      engine_version: session.version,
      observation_token: session.observation_token,
      cash: String(fields.get('cash')),
      session_fees: String(fields.get('fees')),
      benchmark_value: String(fields.get('benchmark')),
      benchmark_is_gross: fields.get('benchmark_basis') === 'gross',
      profit_proves_process: fields.get('process') === 'yes',
      planned_loss_is_guaranteed: fields.get('guarantee') === 'yes',
      no_order_reason: session.orders.length
        ? null
        : (fields.get('no_order_reason') as ScenarioAudit['no_order_reason']),
      positions: session.positions.map((position) => ({
        symbol: position.symbol,
        quantity: Number(fields.get('position-' + position.symbol)),
      })),
      orders: session.orders.map((order) => ({
        order_id: order.id,
        status: fields.get(
          order.id + '-status',
        ) as components['schemas']['OrderStatus'],
        requested_quantity: Number(fields.get(order.id + '-requested')),
        filled_quantity: Number(fields.get(order.id + '-filled')),
        remaining_quantity: Number(fields.get(order.id + '-remaining')),
      })),
    })
  }
  return (
    <section className="simulation-section" aria-labelledby={prefix + '-audit'}>
      <h3 id={prefix + '-audit'} ref={heading} tabIndex={-1}>
        Audit this path’s observed record
      </h3>
      <p>
        Read the saved records and enter their facts yourself. Audit fields
        start empty. They reset if this observation changes. Completion checks
        reconciliation and the stated case constraints; profit and order count
        do not earn the normal star.
      </p>
      {!final && (
        <p>
          Observe through step {session.total_ticks - 1} before auditing. You
          are at step {session.tick}.
        </p>
      )}
      <form onSubmit={audit}>
        <fieldset disabled={disabled || !final}>
          <legend>Recorded facts at observation {session.tick}</legend>
          {(
            [
              ['cash', 'Recorded cash'],
              ['fees', 'Total fees paid'],
              ['benchmark', 'Same-period passive basket value'],
            ] as const
          ).map(([name, label]) => (
            <div key={name}>
              <label htmlFor={prefix + '-' + name}>{label}</label>
              <input
                id={prefix + '-' + name}
                name={name}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                required
              />
            </div>
          ))}
          <label htmlFor={prefix + '-benchmark-basis'}>
            Is the passive comparison gross or net of trading fees?
          </label>
          <select
            id={prefix + '-benchmark-basis'}
            name="benchmark_basis"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Choose the comparison basis
            </option>
            <option value="gross">Gross: leaves out trading fees</option>
            <option value="net">Net: deducts paid trading fees</option>
          </select>
          <label htmlFor={prefix + '-process'}>
            Does profit alone establish that the decision and prior plan were
            sound?
          </label>
          <select
            id={prefix + '-process'}
            name="process"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Choose an answer
            </option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
          <label htmlFor={prefix + '-guarantee'}>
            Does the written loss boundary guarantee the maximum possible loss?
          </label>
          <select
            id={prefix + '-guarantee'}
            name="guarantee"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Choose an answer
            </option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
          <h4>Actual holdings</h4>
          {session.positions.length ? (
            session.positions.map((position) => (
              <div key={position.symbol}>
                <label htmlFor={prefix + '-position-' + position.symbol}>
                  Recorded {position.symbol} units held
                </label>
                <input
                  id={prefix + '-position-' + position.symbol}
                  name={'position-' + position.symbol}
                  type="number"
                  min="1"
                  step="1"
                  required
                />
              </div>
            ))
          ) : (
            <p>
              The observed record contains no holdings. This audit reports an
              empty holdings list.
            </p>
          )}
          <h4>Every recorded order, including cancelled orders</h4>
          {session.orders.map((order) => (
            <fieldset key={order.id} className="simulation-order-audit">
              <legend>
                {order.id} · {order.symbol} / {order.side}
              </legend>
              <label htmlFor={prefix + '-' + order.id + '-status'}>
                Recorded status
              </label>
              <select
                id={prefix + '-' + order.id + '-status'}
                name={order.id + '-status'}
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Choose the recorded status
                </option>
                {(
                  [
                    'open',
                    'partial',
                    'filled',
                    'cancelled',
                    'expired',
                    'rejected',
                  ] as const
                ).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              {(
                [
                  ['requested', 'Requested units', 1],
                  ['filled', 'Filled units', 0],
                  ['remaining', 'Remaining units', 0],
                ] as const
              ).map(([name, label, min]) => (
                <div key={name}>
                  <label htmlFor={prefix + '-' + order.id + '-' + name}>
                    {label}
                  </label>
                  <input
                    id={prefix + '-' + order.id + '-' + name}
                    name={order.id + '-' + name}
                    type="number"
                    min={min}
                    step="1"
                    required
                  />
                </div>
              ))}
            </fieldset>
          ))}
          {!session.orders.length && (
            <>
              <p>
                The observed record contains no orders. No trading is required
                to complete this case.
              </p>
              <label htmlFor={prefix + '-no-order'}>
                Which supplied case fact supports observing without an order?
              </label>
              <select
                id={prefix + '-no-order'}
                name="no_order_reason"
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Identify the case fact
                </option>
                <option value="no_thesis_supplied">
                  The fictional brief supplies no executable investment thesis
                </option>
              </select>
            </>
          )}
          <p>
            A correct audit closes this path and cancels any open remainder
            afterwards. It preserves your audit of the record before that
            cancellation.
          </p>
          <button type="submit">Review this path</button>
        </fieldset>
      </form>
    </section>
  )
}
