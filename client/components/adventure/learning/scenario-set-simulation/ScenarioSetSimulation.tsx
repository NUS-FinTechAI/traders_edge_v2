import { useCallback, useEffect, useRef, useState } from 'react'
import useAuth from '../../../../hooks/useAuth.ts'
import authService from '../../../../services/authService.ts'
import type { LearningRun } from '../../../../services/learningRunService.ts'
import {
  readScenarioSet,
  ScenarioSetCommands,
  scenarioSetError,
  type ScenarioAction,
  type ScenarioSet,
} from '../../../../services/scenarioSetService.ts'
import {
  MarketPanel,
  PortfolioPanel,
} from '../../../trading/TradingWorkspace.tsx'
import { ScenarioAuditForm, ScenarioOrderForm } from './ScenarioSetForms.tsx'
import '../lesson-simulation/LessonSimulation.css'
import './ScenarioSetSimulation.css'

function SavedPaths({ value }: { value: ScenarioSet }) {
  if (!value.completed_cases.length) return null
  return (
    <section className="simulation-section">
      <h3>Reviewed paths</h3>
      <p>
        Generator profiles are disclosed only after their path’s audit passes.
        These synthetic outcomes are context, not a profit or reasoning-quality
        grade.
      </p>
      {value.completed_cases.map((item, index) => (
        <details key={item.case_id}>
          <summary>
            Path {index + 1} · reviewed · {item.generator_profile} generator
          </summary>
          <dl className="scenario-set-summary">
            <div>
              <dt>Recorded cash</dt>
              <dd>{item.cash}</dd>
            </div>
            <div>
              <dt>Portfolio value</dt>
              <dd>{item.equity}</dd>
            </div>
            <div>
              <dt>Fees paid</dt>
              <dd>{item.fees}</dd>
            </div>
            <div>
              <dt>Gross passive basket</dt>
              <dd>{item.benchmark_value}</dd>
            </div>
            <div>
              <dt>Largest observed drawdown</dt>
              <dd>{item.max_drawdown_percent}%</dd>
            </div>
          </dl>
          <p>
            The saved audit describes the observation before open remainders
            were cancelled on closure.
          </p>
        </details>
      ))}
    </section>
  )
}

function ScenarioActivity({
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
  const { refreshUser } = useAuth()
  const verify = useCallback(
    async () => (await refreshUser())?.id ?? null,
    [refreshUser],
  )
  const [setup] = useState(() => {
    try {
      const commands = new ScenarioSetCommands(
        owner,
        runId,
        sessionStorage,
        () => authService.getUser()?.id ?? null,
        verify,
      )
      return { commands, pending: !!commands.pending(), error: null as unknown }
    } catch {
      return {
        commands: null,
        pending: false,
        error: new Error(
          'Browser storage is unavailable or contains an unreadable saved action. Keep this tab and reload the lesson before making another decision.',
        ),
      }
    }
  })
  const [value, setValue] = useState<ScenarioSet | null>(null)
  const [pending, setPending] = useState(setup.pending)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<unknown>(setup.error)
  const mounted = useRef(false)
  const inFlight = useRef(false)
  const completed = useRef(false)
  const caseHeading = useRef<HTMLHeadingElement>(null)
  const feedbackHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    void readScenarioSet(owner, runId, controller.signal, undefined, verify)
      .then(
        (next) => {
          if (!controller.signal.aborted) {
            setValue(next)
            if (setup.commands) setError(null)
          }
        },
        (failure) => {
          if (!controller.signal.aborted) setError(failure)
        },
      )
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false)
      })
    return () => {
      mounted.current = false
      controller.abort()
    }
  }, [owner, runId, setup.commands, verify])
  useEffect(() => {
    if (
      value?.run.status === 'completed' &&
      value.completed_cases.length === 4 &&
      !completed.current
    ) {
      completed.current = true
      onComplete?.(value.run)
    }
  }, [value, onComplete])
  useEffect(() => {
    caseHeading.current?.focus()
  }, [value?.current_case_id, value?.session?.id])
  useEffect(() => {
    if (value?.issues.length) feedbackHeading.current?.focus()
  }, [value?.issues])
  async function reload() {
    if (inFlight.current || busy) return
    inFlight.current = true
    setBusy(true)
    try {
      const next = await readScenarioSet(
        owner,
        runId,
        undefined,
        undefined,
        verify,
      )
      if (!mounted.current) return
      setValue(next)
      if (setup.commands) {
        setPending(!!setup.commands.pending())
        setError(null)
      }
    } catch (failure) {
      if (mounted.current) setError(failure)
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function act(action?: ScenarioAction) {
    if (inFlight.current || busy || !setup.commands || (action && !value))
      return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const next = action
        ? await setup.commands.submit(value!, action)
        : await setup.commands.retry()
      if (!mounted.current) return
      setValue(next)
      setPending(false)
    } catch (failure) {
      if (!mounted.current) return
      setError(failure)
      try {
        setPending(!!setup.commands.pending())
      } catch {
        setPending(true)
      }
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const session = value?.session
  const blocked = busy || pending || !setup.commands || error !== null
  const remaining = session ? session.total_ticks - 1 - session.tick : 0
  const advance = value ? Math.min(value.policy.max_advance, remaining) : 0
  return (
    <section className="lesson-simulation scenario-set" aria-busy={busy}>
      <h2>Four saved market paths</h2>
      <details>
        <summary>Lesson objective and case boundaries</summary>
        <p>{prompt}</p>
      </details>
      <p>
        {value?.run.status === 'completed'
          ? 'All four path audits are saved. Review their records or confirm an earlier unconfirmed action below.'
          : 'Work through four separate synthetic paths. Each begins only when you choose to start it. Reloading resumes the current observed market and saved audits.'}
      </p>
      {value && (
        <>
          <p>{value.policy.provenance}</p>
          <p>{value.policy.brief}</p>
          <p>{value.policy.grade_basis}</p>
          <p role="status" aria-atomic="true">
            {value.completed_cases.length} of {value.policy.total_cases} path
            audits passed. The normal star and any once-only lesson XP follow
            all four audits.
          </p>
          <progress
            aria-label="Reviewed market paths"
            value={value.completed_cases.length}
            max={value.policy.total_cases}
          />
        </>
      )}
      {busy && (
        <p role="status">
          Reading the saved path and confirming its current observation…
        </p>
      )}
      {error !== null && (
        <div className="simulation-notice" role="alert">
          <p>{scenarioSetError(error)}</p>
        </div>
      )}
      {pending && (
        <section className="simulation-notice">
          <h3>Confirm your saved path action</h3>
          <p>
            An earlier response is unconfirmed. Its original path, answer or
            written order plan is retained. Confirm that exact action before
            making another decision.
          </p>
          <button disabled={busy || !setup.commands} onClick={() => void act()}>
            Confirm saved action
          </button>
        </section>
      )}
      <button disabled={busy} onClick={() => void reload()}>
        Reload saved paths
      </button>
      {value && <SavedPaths value={value} />}
      {value?.current_case_id && (
        <>
          <h2 tabIndex={-1} ref={caseHeading}>
            Path {value.completed_cases.length + 1} of{' '}
            {value.policy.total_cases}
          </h2>
          {!session ? (
            <>
              <p>
                This path has not started. Its generator profile and future
                observations remain hidden. Starting saves its own market;
                earlier reviewed paths remain closed.
              </p>
              <button
                disabled={blocked}
                onClick={() => void act({ kind: 'bind' })}
              >
                {value.completed_cases.length
                  ? 'Start next saved path'
                  : 'Start first saved path'}
              </button>
            </>
          ) : (
            <>
              <p role="status" aria-atomic="true">
                Observation {session.tick} of {session.total_ticks - 1}.{' '}
                {remaining
                  ? 'The next observations stay hidden until you advance.'
                  : 'This is the final observation; audit the saved record below.'}
              </p>
              <div className="trading-workspace">
                <MarketPanel key={session.id} player={session} />
                <PortfolioPanel
                  player={session}
                  disabled={blocked}
                  cancel={(orderId) => void act({ kind: 'cancel', orderId })}
                />
              </div>
              <div className="simulation-actions">
                <button
                  disabled={blocked || remaining === 0}
                  onClick={() => void act({ kind: 'advance', steps: 1 })}
                >
                  Observe next step
                </button>
                <button
                  disabled={blocked || advance === 0}
                  onClick={() => void act({ kind: 'advance', steps: advance })}
                >
                  Observe next {advance || 1} steps
                </button>
              </div>
              <ScenarioOrderForm
                key={session.id}
                session={session}
                maxOrders={value.policy.max_orders}
                disabled={blocked}
                submit={(order) => void act({ kind: 'order', order })}
              />
              {!!value.issues.length && (
                <section className="simulation-notice" role="alert">
                  <h3 ref={feedbackHeading} tabIndex={-1}>
                    Last audit feedback
                  </h3>
                  <p>
                    This path remains open. Check the recorded facts and correct
                    your answers.
                  </p>
                  <ul>
                    {value.issues.map((issue, index) => (
                      <li key={issue.code + ':' + index}>
                        {issue.message}
                        {issue.order_id ? ' Order ' + issue.order_id + '.' : ''}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <ScenarioAuditForm
                key={session.id + ':' + session.observation_token}
                session={session}
                disabled={blocked}
                submit={(audit) => void act({ kind: 'review', audit })}
              />
            </>
          )}
        </>
      )}
    </section>
  )
}

export default function ScenarioSetSimulation(props: {
  owner: string
  runId: string
  prompt: string
  onComplete?: (run: LearningRun) => void
}) {
  const { user, status, signingOut } = useAuth()
  if (status === 'loading' || signingOut)
    return <p role="status">Checking the account for this saved lesson…</p>
  if (status !== 'signed-in' || user?.id !== props.owner)
    return (
      <section className="lesson-simulation">
        <h2>Open this lesson with its current account</h2>
        <p role="alert">
          The signed-in account changed. Saved path actions remain with their
          original owner.
        </p>
        <a href={'/adventure/runs/' + encodeURIComponent(props.runId)}>
          Reload the current account
        </a>
      </section>
    )
  return <ScenarioActivity key={props.owner + ':' + props.runId} {...props} />
}
