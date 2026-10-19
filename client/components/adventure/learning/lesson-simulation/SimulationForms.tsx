import { useId, type FormEvent } from 'react'
import type { components } from '../../../../api/api-types.ts'
import type {
  LessonAction,
  LessonSimulation,
  SimulationAudit,
} from '../../../../services/lessonSimulationService.ts'

type Action = (action: LessonAction) => void

export function SimulationOrderForm({
  session,
  disabled,
  submit,
}: {
  session: LessonSimulation
  disabled: boolean
  submit: Action
}) {
  const prefix = useId()
  const policy = session.policy
  function order(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const text = (name: string) => String(fields.get(name) ?? '').trim()
    submit({
      kind: 'order',
      order: {
        symbol: 'NORTH',
        side: 'buy',
        type: 'limit',
        quantity: Number(fields.get('quantity')),
        price: text('price'),
        plan: {
          reason: text('reason'),
          risk: text('risk'),
          exit: text('exit'),
          size_reason: text('size_reason'),
          max_loss: text('max_loss'),
        },
      },
    })
  }
  return (
    <details className="simulation-section">
      <summary>Optional planned order</summary>
      <p>
        This case supplies no investment thesis. Observing without orders is
        valid. If you choose to test an order, write its plan first.
      </p>
      <p>
        Only NORTH buy limits are available: at most {policy.max_quantity} units
        per order, at most {policy.max_orders} orders including cancelled
        orders. A limit caps the unit price before fees; it does not guarantee a
        fill.
      </p>
      <form onSubmit={order}>
        <fieldset disabled={disabled}>
          <legend>Buy limit and written plan</legend>
          <label htmlFor={`${prefix}-quantity`}>
            Units (1–{policy.max_quantity})
          </label>
          <input
            id={`${prefix}-quantity`}
            name="quantity"
            type="number"
            min="1"
            max={policy.max_quantity}
            step="1"
            required
            defaultValue="1"
          />
          <label htmlFor={`${prefix}-price`}>
            Limit price per unit (at most {policy.unit_price_cap}, before fees)
          </label>
          <input
            id={`${prefix}-price`}
            name="price"
            type="number"
            min="0.01"
            max={policy.unit_price_cap}
            step="0.01"
            required
            inputMode="decimal"
          />
          {(
            [
              ['reason', 'Why would you place this order?'],
              ['risk', 'What could go wrong?'],
              ['exit', 'When would you reconsider?'],
              ['size_reason', 'Why this position size?'],
            ] as const
          ).map(([name, label]) => (
            <div key={name} className="simulation-field">
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
            max={session.equity}
            step="0.01"
            required
            inputMode="decimal"
            aria-describedby={`${prefix}-loss-help`}
          />
          <p id={`${prefix}-loss-help`}>
            This records your intention. It is not an automatic exit or a
            guaranteed maximum loss. Each plan explanation needs at least 12
            characters.
          </p>
          <button type="submit">Submit planned buy limit</button>
        </fieldset>
      </form>
      {session.orders.length >= policy.max_orders && (
        <p>
          Both permitted orders have been recorded. You can still inspect,
          cancel an open remainder, advance or complete the audit.
        </p>
      )}
      {session.tick >= policy.max_tick && (
        <p>
          The final observation does not accept new orders. Review the recorded
          facts below.
        </p>
      )}
    </details>
  )
}

export function SimulationAuditForm({
  session,
  disabled,
  submit,
}: {
  session: LessonSimulation
  disabled: boolean
  submit: Action
}) {
  const prefix = useId()
  function audit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const value: SimulationAudit = {
      tick: session.tick,
      engine_version: session.version,
      observation_token: session.observationToken,
      price_limit_guarantees_fill: fields.get('guarantee') === 'yes',
      session_fees: String(fields.get('fees')),
      no_order_reason: session.orders.length
        ? null
        : (fields.get('no_order_reason') as SimulationAudit['no_order_reason']),
      orders: session.orders.map((order) => ({
        order_id: order.id,
        status: fields.get(
          `${order.id}-status`,
        ) as components['schemas']['OrderStatus'],
        filled_quantity: Number(fields.get(`${order.id}-filled`)),
        limit_price: String(fields.get(`${order.id}-limit`)),
      })),
    }
    submit({ kind: 'review', audit: value })
  }
  return (
    <section className="simulation-section" aria-labelledby={`${prefix}-title`}>
      <h3 id={`${prefix}-title`}>Audit this observation</h3>
      <p>
        Read the quote and order records, then report their facts. Completion
        checks this audit, not profit or how many orders you placed. Finishing
        cancels any open remainder after the audit is checked.
      </p>
      <p>
        The audit refers to observation {session.tick}. Advancing or changing an
        order clears these answers so they cannot describe an older observation.
      </p>
      {session.tick < session.policy.min_observe && (
        <p>
          Observe at least {session.policy.min_observe} market steps before
          submitting. You are at step {session.tick}.
        </p>
      )}
      <form onSubmit={audit}>
        <fieldset
          disabled={disabled || session.tick < session.policy.min_observe}
        >
          <legend>Recorded facts before finishing</legend>
          <label htmlFor={`${prefix}-fees`}>Total session fees recorded</label>
          <input
            id={`${prefix}-fees`}
            name="fees"
            type="number"
            min="0"
            step="0.01"
            required
            inputMode="decimal"
          />
          <label htmlFor={`${prefix}-guarantee`}>
            Does a buy limit guarantee a complete fill?
          </label>
          <select
            id={`${prefix}-guarantee`}
            name="guarantee"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Choose an answer
            </option>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
          {session.orders.map((order) => (
            <fieldset key={order.id} className="simulation-order-audit">
              <legend>{order.id}</legend>
              <label htmlFor={`${prefix}-${order.id}-status`}>
                Recorded status
              </label>
              <select
                id={`${prefix}-${order.id}-status`}
                name={`${order.id}-status`}
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
              <label htmlFor={`${prefix}-${order.id}-filled`}>
                Units actually filled
              </label>
              <input
                id={`${prefix}-${order.id}-filled`}
                name={`${order.id}-filled`}
                type="number"
                min="0"
                max={order.quantity}
                step="1"
                required
              />
              <label htmlFor={`${prefix}-${order.id}-limit`}>
                Submitted limit price (not the current quote)
              </label>
              <input
                id={`${prefix}-${order.id}-limit`}
                name={`${order.id}-limit`}
                type="number"
                min="0.01"
                step="0.01"
                required
                inputMode="decimal"
              />
            </fieldset>
          ))}
          {!session.orders.length && (
            <>
              <label htmlFor={`${prefix}-reason`}>
                Which recorded fact supports observing without an order?
              </label>
              <select
                id={`${prefix}-reason`}
                name="no_order_reason"
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Choose a reason supported by this case
                </option>
                <option value="no_thesis_supplied">
                  This case supplies no investment thesis
                </option>
                <option value="current_ask_above_cap">
                  The current NORTH ask exceeds the opening-ask cap
                </option>
              </select>
              <p>
                For the second reason, compare the current ask with{' '}
                {session.policy.unit_price_cap}. The midpoint or an earlier
                price does not establish that fact.
              </p>
            </>
          )}
          <button type="submit">Check audit and finish lesson</button>
        </fieldset>
      </form>
    </section>
  )
}
