import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLoaderData, useLocation, useParams } from 'react-router-dom'
import useAuth from '../../../hooks/useAuth.ts'
import useAdventureRead from '../../../hooks/useAdventureRead.ts'
import type { UserProfile } from '../../../services/authService.ts'
import LearningTaskForm from '../../../components/adventure/learning/learning-task/LearningTaskForm.tsx'
import LearningFeedback from '../../../components/adventure/learning/learning-feedback/LearningFeedback.tsx'
import LearningResult from '../../../components/adventure/learning/learning-result/LearningResult.tsx'
import {
  getLearningRun,
  LearningCommands,
  learningError,
  type LearningRun,
  type StepAnswer,
} from '../../../services/learningRunService.ts'
import { HttpError } from '../../../services/httpService.ts'
import './LearningRunPage.css'

function RunContent({
  initial,
  owner,
}: {
  initial: LearningRun
  owner: string
}) {
  const [setup] = useState(() => {
    try {
      const commands = new LearningCommands(owner, sessionStorage)
      return { commands, pending: !!commands.pending(initial.id), error: null }
    } catch (error) {
      return { commands: null, pending: false, error }
    }
  })
  const [run, setRun] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(setup.error)
  const [pending, setPending] = useState(setup.pending)
  const [showFeedback, setShowFeedback] = useState(
    initial.status === 'active' && initial.feedback.length > 0,
  )
  const [formVersion, setFormVersion] = useState(0)
  const [profileError, setProfileError] = useState(false)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const heading = useRef<HTMLHeadingElement>(null)
  const { refreshUser } = useAuth()
  const location = useLocation()
  const commands = useRef<LearningCommands | null>(setup.commands)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [owner, initial.id])
  useEffect(() => {
    heading.current?.focus()
  }, [run.current_step?.id, run.status, showFeedback])
  const refresh = useCallback(async () => {
    try {
      await refreshUser()
      if (mounted.current) setProfileError(false)
    } catch {
      if (mounted.current) setProfileError(true)
    }
  }, [refreshUser])
  useEffect(() => {
    if (run.status !== 'completed') return
    void refreshUser().then(
      () => {
        if (mounted.current) setProfileError(false)
      },
      () => {
        if (mounted.current) setProfileError(true)
      },
    )
  }, [run.status, refreshUser])

  async function submit(answer?: StepAnswer) {
    if (inFlight.current || !commands.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const updated = await commands.current.submit(run, answer)
      if (!mounted.current) return
      setRun(updated)
      setPending(false)
      setShowFeedback(
        updated.status === 'active' && updated.feedback.length > 0,
      )
      setFormVersion((value) => value + 1)
    } catch (failure) {
      if (mounted.current) {
        setError(failure)
        try {
          setPending(!!commands.current.pending(run.id))
        } catch {
          setPending(true)
        }
      }
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function reloadRejected() {
    if (inFlight.current || !commands.current) return
    inFlight.current = true
    setBusy(true)
    try {
      const current = await getLearningRun(run.id)
      if (!mounted.current) return
      commands.current.clearAnswer(run.id)
      setRun(current)
      setPending(false)
      setError(null)
      setShowFeedback(
        current.status === 'active' && current.feedback.length > 0,
      )
      setFormVersion((value) => value + 1)
    } catch (failure) {
      if (mounted.current) setError(failure)
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const rejected =
    error instanceof HttpError && (error.status === 409 || error.status === 422)
  const title =
    run.purpose === 'diagnostic'
      ? 'Introductory assessment'
      : run.purpose === 'bonus'
        ? 'Bonus missions'
        : 'Required missions'
  return (
    <main className="learning-run-page">
      <Link
        className="learning-back"
        to={`/adventure/chapters/${encodeURIComponent(run.module_id)}`}
      >
        ← Chapter map
      </Link>
      <header>
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
        <p>
          {run.progress.completed_steps} of {run.progress.total_steps} steps
          completed
        </p>
        <progress
          aria-label="Activity progress"
          value={run.progress.completed_steps}
          max={run.progress.total_steps}
        />
        {run.purpose === 'diagnostic' && run.status === 'active' && (
          <p>
            This checks your starting knowledge. Answers are final for this
            check; feedback appears after the last question. Incorrect answers
            do not block lessons.
          </p>
        )}
      </header>
      {error !== null && (
        <div className="learning-error" role="alert">
          <p>
            {setup.error
              ? 'Saved commands could not be accessed. Enable browser storage and reload this page before continuing.'
              : learningError(error)}
          </p>
          {error instanceof HttpError && error.status === 401 && (
            <Link
              className="learning-action"
              to={`/login?returnTo=${encodeURIComponent(location.pathname)}`}
            >
              Sign in again
            </Link>
          )}
          {rejected && (
            <button disabled={busy} onClick={() => void reloadRejected()}>
              Reload saved activity
            </button>
          )}
        </div>
      )}
      {pending ? (
        <section className="learning-pending">
          <h2>Confirm your saved answer</h2>
          <p>
            A previous submission has not been confirmed here. Retry the same
            saved answer before making another choice.
          </p>
          <button disabled={busy} onClick={() => void submit()}>
            {busy ? 'Checking…' : 'Retry saved answer'}
          </button>
        </section>
      ) : run.status === 'completed' ? (
        <LearningResult run={run} />
      ) : showFeedback ? (
        <>
          <LearningFeedback feedback={run.feedback} />
          <button onClick={() => setShowFeedback(false)}>
            {run.feedback.some((item) => !item.correct)
              ? 'Try again'
              : 'Continue'}
          </button>
        </>
      ) : (
        run.current_step && (
          <LearningTaskForm
            key={`${run.current_step.id}:${formVersion}`}
            task={run.current_step}
            busy={busy || !setup.commands}
            withheld={
              run.purpose === 'diagnostic' ||
              run.purpose === 'assessment' ||
              run.purpose === 'review'
            }
            onSubmit={(answer) => void submit(answer)}
          />
        )
      )}
      {profileError && (
        <div role="alert">
          <p>
            Your activity is saved, but your profile totals could not be
            refreshed.
          </p>
          <button onClick={() => void refresh()}>Refresh profile</button>
        </div>
      )}
    </main>
  )
}

function LoadRun({ runId, owner }: { runId: string; owner: string }) {
  const load = useCallback(
    (signal: AbortSignal) => getLearningRun(runId, signal),
    [runId],
  )
  const { state, retry } = useAdventureRead(load)
  if (state.status === 'ready')
    return <RunContent initial={state.data} owner={owner} />
  return (
    <main className="learning-run-page">
      <h1>Learning activity</h1>
      {state.status === 'loading' ? (
        <p role="status">Loading saved activity…</p>
      ) : (
        <div role="alert">
          <p>{learningError(state.error)}</p>
          <button onClick={retry}>Try again</button>
        </div>
      )}
      <Link className="learning-back" to="/adventure">
        Return to chapters
      </Link>
    </main>
  )
}

export default function LearningRunPage() {
  const { runId = '' } = useParams()
  const user = useLoaderData<UserProfile>()
  return <LoadRun key={`${user.id}:${runId}`} runId={runId} owner={user.id} />
}
