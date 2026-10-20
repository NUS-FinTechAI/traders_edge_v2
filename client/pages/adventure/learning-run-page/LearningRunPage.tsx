import { useToast } from '../../../contexts/ToastContext.ts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLoaderData, useParams } from 'react-router-dom'
import useAuth from '../../../hooks/useAuth.ts'
import useAdventureRead from '../../../hooks/useAdventureRead.ts'
import type { UserProfile } from '../../../services/authService.ts'
import LearningTaskForm from '../../../components/adventure/learning/learning-task/LearningTaskForm.tsx'
import LearningFeedback from '../../../components/adventure/learning/learning-feedback/LearningFeedback.tsx'
import LearningResult from '../../../components/adventure/learning/learning-result/LearningResult.tsx'
import LessonSimulation from '../../../components/adventure/learning/lesson-simulation/LessonSimulation.tsx'
import ScenarioSetSimulation from '../../../components/adventure/learning/scenario-set-simulation/ScenarioSetSimulation.tsx'
import {
  getLearningRun,
  LearningCommands,
  learningError,
  type LearningRun,
  type StepAnswer,
} from '../../../services/learningRunService.ts'
import ReadError from '../../../components/adventure/read-error/ReadError.tsx'
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
  const showToast = useToast()
  const [pending, setPending] = useState(setup.pending)
  const [showFeedback, setShowFeedback] = useState(
    initial.status === 'active' && initial.feedback.length > 0,
  )
  const [formVersion, setFormVersion] = useState(0)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const heading = useRef<HTMLHeadingElement>(null)
  const { refreshUser } = useAuth()
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
  useEffect(() => {
    if (run.status !== 'completed') return
    void refreshUser().catch(() => {
      if (mounted.current)
        showToast(
          'Your activity is saved, but your profile totals could not be refreshed.',
        )
    })
  }, [run.status, refreshUser, showToast])

  async function submit(answer?: StepAnswer) {
    if (inFlight.current || !commands.current) return
    inFlight.current = true
    setBusy(true)
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
        showToast(learningError(failure))
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
  if (setup.error !== null) throw setup.error
  const title =
    run.purpose === 'diagnostic'
      ? 'Introductory assessment'
      : run.purpose === 'bonus'
        ? 'Bonus missions'
        : run.purpose === 'assessment'
          ? 'Chapter learning check'
          : run.purpose === 'review'
            ? 'Delayed review'
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
        {(run.purpose === 'assessment' || run.purpose === 'review') &&
          run.status === 'active' && (
            <p>
              Answers are final for this check. Feedback appears after the last
              question.
            </p>
          )}
      </header>
      {pending && (
        <section className="learning-pending">
          <h2>Confirm your saved answer</h2>
          <p>
            A previous submission has not been confirmed here. Retry the same
            saved answer before making another choice.
          </p>
          <button disabled={busy} onClick={() => void submit()}>
            {busy ? 'Checking…' : 'Confirm saved answer'}
          </button>
        </section>
      )}
      {run.status === 'completed' ? (
        <>
          <LearningResult run={run} />
          {run.scenario_set && (
            <ScenarioSetSimulation
              owner={owner}
              runId={run.id}
              prompt="Review the saved observations and audits from the four completed paths."
            />
          )}
        </>
      ) : showFeedback ? (
        <>
          <LearningFeedback feedback={run.feedback} />
          <button onClick={() => setShowFeedback(false)}>
            {run.feedback.some((item) => !item.correct)
              ? 'Try again'
              : 'Continue'}
          </button>
        </>
      ) : run.current_step?.type === 'simulation' ? (
        run.scenario_set ? (
          <ScenarioSetSimulation
            key={`${owner}:${run.id}`}
            owner={owner}
            runId={run.id}
            prompt={run.current_step.prompt}
            onComplete={(updated) => {
              setRun(updated)
              setShowFeedback(false)
            }}
          />
        ) : (
          <LessonSimulation
            key={`${owner}:${run.id}`}
            owner={owner}
            runId={run.id}
            prompt={run.current_step.prompt}
            onComplete={(updated) => {
              setRun(updated)
              setShowFeedback(false)
            }}
          />
        )
      ) : (
        run.current_step && (
          <LearningTaskForm
            key={`${run.current_step.id}:${formVersion}`}
            task={run.current_step}
            busy={busy || pending || !setup.commands}
            withheld={
              run.purpose === 'diagnostic' ||
              run.purpose === 'assessment' ||
              run.purpose === 'review'
            }
            onSubmit={(answer) => void submit(answer)}
          />
        )
      )}
    </main>
  )
}

function LoadRun({ runId, owner }: { runId: string; owner: string }) {
  const load = useCallback(
    (signal: AbortSignal) => getLearningRun(runId, signal),
    [runId],
  )
  const { state } = useAdventureRead(load)
  if (state.status === 'ready')
    return <RunContent initial={state.data} owner={owner} />
  return (
    <main className="learning-run-page">
      <h1>Learning activity</h1>
      {state.status === 'loading' ? (
        <p role="status">Loading saved activity…</p>
      ) : (
        <ReadError fatal error={state.error} />
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
