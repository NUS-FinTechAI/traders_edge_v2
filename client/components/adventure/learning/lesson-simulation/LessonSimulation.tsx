import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LearningRun } from '../../../../services/learningRunService.ts'
import {
  openLessonSimulation,
  resumeLessonSimulation,
  LessonSimulationCommands,
  lessonSimulationError,
  getLessonAuditFeedback,
  type LessonSimulation as Session,
  type LessonAction,
  type SimulationFeedback,
} from '../../../../services/lessonSimulationService.ts'
import { SimulationAuditForm, SimulationOrderForm } from './SimulationForms.tsx'
import './LessonSimulation.css'

function ObservedMarket({ session }: { session: Session }) {
  const title = useId()
  const prices = session.history.NORTH.map(Number)
  const low = Math.min(...prices)
  const high = Math.max(...prices)
  const range = high - low || 1
  const points = prices
    .map(
      (price, index) =>
        `${12 + (index / Math.max(1, prices.length - 1)) * 576},${158 - ((price - low) / range) * 136}`,
    )
    .join(' ')
  return (
    <section className="simulation-section" aria-labelledby={title}>
      <h3 id={title}>Observed market</h3>
      <p>
        All values use simulated funds. Quotes show the midpoint and the prices
        available to buyers (ask) and sellers (bid). Orders may fill only on a
        later observation.
      </p>
      <p>Scroll the table sideways to see every quote column.</p>
      <div
        className="simulation-table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Current observed quotes"
      >
        <table>
          <caption>Current quotes at observation {session.tick}</caption>
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
            {session.quotes.map((quote) => (
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
      <figure className="simulation-history">
        <figcaption>
          NORTH midpoint history · lowest {low.toFixed(2)}, highest{' '}
          {high.toFixed(2)}
        </figcaption>
        <svg
          viewBox="0 0 600 180"
          role="img"
          aria-label={`NORTH observed midpoint prices from observation 0 through ${session.tick}. Exact values are in the history table below.`}
        >
          <line
            x1="12"
            y1="158"
            x2="588"
            y2="158"
            className="simulation-chart-axis"
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
        <summary>Exact observed price history</summary>
        <div
          className="simulation-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Observed midpoint history"
        >
          <table>
            <caption>
              Midpoints through observation {session.tick}; future observations
              remain hidden
            </caption>
            <thead>
              <tr>
                <th scope="col">Observation</th>
                {session.quotes.map((quote) => (
                  <th key={quote.symbol} scope="col">
                    {quote.symbol}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prices.map((_price, tick) => (
                <tr key={tick}>
                  <th scope="row">{tick}</th>
                  {session.quotes.map((quote) => (
                    <td key={quote.symbol}>
                      {session.history[quote.symbol][tick]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}

export default function LessonSimulation({
  owner,
  runId,
  prompt,
  onComplete,
}: {
  owner: string
  runId: string
  prompt: string
  onComplete?: (run: LearningRun) => void
}) {
  const [session, setSession] = useState<Session | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<SimulationFeedback[]>([])
  const [commands] = useState(() => {
    try {
      return new LessonSimulationCommands(owner, runId, sessionStorage)
    } catch {
      return null
    }
  })
  const inFlight = useRef(false)
  const mounted = useRef(false)
  const feedbackHeading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    void Promise.all([
      openLessonSimulation(owner, runId, sessionStorage, controller.signal),
      getLessonAuditFeedback(runId, controller.signal),
    ])
      .then(([current, savedFeedback]) => {
        if (controller.signal.aborted) return
        setSession(current)
        setFeedback(savedFeedback)
        setPending(!!commands?.pending())
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(lessonSimulationError(failure))
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false)
      })
    return () => {
      mounted.current = false
      controller.abort()
    }
  }, [owner, runId, commands])

  async function reload() {
    if (inFlight.current || busy) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const [current, savedFeedback] = await Promise.all([
        session
          ? resumeLessonSimulation(runId)
          : openLessonSimulation(owner, runId, sessionStorage),
        getLessonAuditFeedback(runId),
      ])
      if (!mounted.current) return
      setSession(current)
      setPending(!!commands?.pending())
      setFeedback(savedFeedback)
    } catch (failure) {
      if (mounted.current) setError(lessonSimulationError(failure))
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }

  async function act(action?: LessonAction) {
    if (inFlight.current || busy || !commands || !session) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const result = action
        ? await commands.submit(session, action)
        : await commands.retry()
      if (!mounted.current) return
      setSession(result.session)
      setFeedback(result.feedback)
      setPending(false)
      if (result.run?.status === 'completed') onComplete?.(result.run)
      else if (result.feedback.length)
        requestAnimationFrame(() => feedbackHeading.current?.focus())
    } catch (failure) {
      if (mounted.current) {
        setError(lessonSimulationError(failure))
        try {
          setPending(!!commands.pending())
        } catch {
          setPending(true)
        }
      }
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }

  const blocked =
    busy || pending || !commands || !!session?.finished || error !== null
  return (
    <section className="lesson-simulation" aria-busy={busy}>
      <h2>Inspect and audit the simulated market</h2>
      <details>
        <summary>Lesson objective and boundaries</summary>
        <p>{prompt}</p>
      </details>
      <p>
        This controlled synthetic case is saved with your lesson. Reloading
        resumes its observed market, orders and holdings. It is not historical
        market data or an investment recommendation.
      </p>
      {busy && (
        <p role="status">
          {session
            ? 'Confirming your saved simulation…'
            : 'Opening your saved simulation…'}
        </p>
      )}
      {!commands && (
        <p role="alert">
          Browser storage is unavailable. Enable it to save commands safely,
          then reload this lesson.
        </p>
      )}
      {error && (
        <div className="simulation-notice" role="alert">
          <p>{error}</p>
          <button disabled={busy} onClick={() => void reload()}>
            Reload saved simulation
          </button>
        </div>
      )}
      {pending && (
        <section
          className="simulation-notice"
          aria-labelledby="simulation-pending-title"
        >
          <h3 id="simulation-pending-title">Confirm your saved command</h3>
          <p>
            An earlier response was not confirmed. Retry the same recorded
            command before placing orders, advancing or submitting another
            audit.
          </p>
          <button
            disabled={busy || !commands || !session}
            onClick={() => void act()}
          >
            Confirm saved command
          </button>
        </section>
      )}
      {session && (
        <>
          <div className="simulation-observation-header">
            <p role="status" aria-atomic="true">
              <strong>
                Observation {session.tick} of {session.policy.max_tick}
              </strong>{' '}
              · {session.finished ? 'Finished and saved' : 'In progress'}
            </p>
            <button disabled={busy} onClick={() => void reload()}>
              Reload current observation
            </button>
          </div>
          <dl className="simulation-balances">
            <div>
              <dt>Cash</dt>
              <dd>{session.cash}</dd>
            </div>
            <div>
              <dt>Unreserved cash</dt>
              <dd>{session.available_cash}</dd>
            </div>
            <div>
              <dt>Portfolio value</dt>
              <dd>{session.equity}</dd>
            </div>
            <div>
              <dt>Total fees</dt>
              <dd>{session.fees}</dd>
            </div>
          </dl>
          <ObservedMarket session={session} />
          <section className="simulation-section">
            <h3>Holdings and orders</h3>
            {session.positions.length ? (
              <ul>
                {session.positions.map((position) => (
                  <li key={position.symbol}>
                    {position.symbol}: {position.quantity} units · value{' '}
                    {position.value} · {position.weight_percent}% of portfolio
                  </li>
                ))}
              </ul>
            ) : (
              <p>No units held.</p>
            )}
            <p>
              NORTH unit-price cap:{' '}
              <strong>{session.policy.unit_price_cap}</strong>, based on its
              opening ask and excluding fees. {session.orders.length} of{' '}
              {session.policy.max_orders} permitted orders recorded.
            </p>
            {session.orders.length ? (
              <div
                className="simulation-table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Recorded order facts"
              >
                <p>
                  Scroll sideways for filled units, remaining units and order
                  status.
                </p>
                <table>
                  <caption>Order facts at observation {session.tick}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Order</th>
                      <th scope="col">Submitted limit</th>
                      <th scope="col">Units</th>
                      <th scope="col">Filled</th>
                      <th scope="col">Remaining</th>
                      <th scope="col">Status</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session.orders.map((order) => (
                      <tr key={order.id}>
                        <th scope="row">
                          {order.id}
                          <br />
                          {order.symbol} buy limit
                        </th>
                        <td>{order.price}</td>
                        <td>{order.quantity}</td>
                        <td>{order.filled}</td>
                        <td>{order.remaining}</td>
                        <td>{order.status}</td>
                        <td>
                          {['open', 'partial'].includes(order.status) ? (
                            <button
                              disabled={blocked}
                              onClick={() =>
                                void act({ kind: 'cancel', orderId: order.id })
                              }
                            >
                              Cancel {order.id} remainder
                            </button>
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
              <p>
                No orders recorded. Observation alone is a valid choice when the
                final audit gives a supported reason.
              </p>
            )}
          </section>
          {!session.finished && (
            <>
              <SimulationOrderForm
                session={session}
                disabled={
                  blocked ||
                  session.orders.length >= session.policy.max_orders ||
                  session.tick >= session.policy.max_tick
                }
                submit={(action) => void act(action)}
              />
              <section className="simulation-section">
                <h3>Observe the next market step</h3>
                <p>
                  Open orders may fill on the next observation, subject to the
                  quote and available units. Observe at least{' '}
                  {session.policy.min_observe} steps before auditing; you may
                  finish without trading.
                </p>
                <div className="simulation-actions">
                  {[1, 2].map((steps) => (
                    <button
                      key={steps}
                      disabled={
                        blocked ||
                        session.tick + steps > session.policy.max_tick
                      }
                      onClick={() => void act({ kind: 'advance', steps })}
                    >
                      Observe {steps} {steps === 1 ? 'step' : 'steps'}
                    </button>
                  ))}
                </div>
                {session.tick === session.policy.max_tick && (
                  <p>Final observation reached. Complete the audit below.</p>
                )}
              </section>
              {!!feedback.length && (
                <section className="simulation-notice" aria-live="polite">
                  <h3 ref={feedbackHeading} tabIndex={-1}>
                    Review your audit
                  </h3>
                  {feedback.map((item) => (
                    <div key={item.step_id}>
                      {item.audited_observation && (
                        <p>
                          Feedback on your audit at observation{' '}
                          {item.audited_observation.tick}. The current
                          observation is {session.tick}.
                        </p>
                      )}
                      <p>{item.explanation}</p>
                      {item.issues?.length ? (
                        <ul>
                          {item.issues.map((issue, index) => (
                            <li key={`${issue.code}-${index}`}>
                              {issue.order_id ? `${issue.order_id}: ` : ''}
                              {issue.message}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                  <p>
                    Your simulation remains open. Correct the audit using the
                    currently displayed facts.
                  </p>
                </section>
              )}
              <SimulationAuditForm
                key={session.observationToken}
                session={session}
                disabled={blocked}
                submit={(action) => void act(action)}
              />
            </>
          )}
          {session.finished && (
            <section className="simulation-notice" role="status">
              <h3>Audit passed and lesson saved</h3>
              <p>
                Your audit describes the observation before finishing cancelled
                open remainders. The finished order table may therefore show a
                different status.
              </p>
              <Link to="/adventure">Return to adventure</Link>
            </section>
          )}
        </>
      )}
    </section>
  )
}
