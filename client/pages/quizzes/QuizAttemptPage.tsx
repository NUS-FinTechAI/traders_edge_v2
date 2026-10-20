import { useQuizCommands, useQuizRead } from './useQuizState.ts'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLoaderData, useNavigate, useParams } from 'react-router-dom'
import type { UserProfile } from '../../services/authService.ts'
import useAuth from '../../hooks/useAuth.ts'
import {
  getQuizAttempt,
  getQuizRoom,
  type QuizAttempt,
  type QuizCommandResult,
} from '../../services/quizService.ts'
import {
  QuizCommandNotice,
  QuizFeedbackList,
  QuizFrame,
  QuizReadError,
  QuizOwnerGate,
} from './QuizShared.tsx'

function AttemptContent({
  owner,
  attemptId,
}: {
  owner: string
  attemptId: string
}) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const attempt = await getQuizAttempt(attemptId, signal)
      return {
        attempt,
        room: attempt.room_id
          ? await getQuizRoom(attempt.room_id, signal)
          : null,
      }
    },
    [attemptId],
  )
  const { state, reload } = useQuizRead(owner, load)
  const [updated, setUpdated] = useState<QuizAttempt | null>(null)
  const [profileUnavailable, setProfileUnavailable] = useState(false)
  const commands = useQuizCommands(owner)
  const navigate = useNavigate()
  const heading = useRef<HTMLHeadingElement>(null)
  const { refreshUser } = useAuth()
  const attempt =
    updated ?? (state.status === 'ready' ? state.data.attempt : null)
  const room = state.status === 'ready' ? state.data.room : null
  useEffect(() => {
    heading.current?.focus()
  }, [attempt?.current_question?.id, attempt?.status])
  useEffect(() => {
    let current = true
    if (attempt?.status === 'completed')
      void refreshUser().catch(() => {
        if (current) setProfileUnavailable(true)
      })
    return () => {
      current = false
    }
  }, [attempt?.status, refreshUser])
  function accept(result: QuizCommandResult | null) {
    if (!result) return
    if (result.kind === 'room')
      navigate(`/quizzes/rooms/${encodeURIComponent(result.room.id)}`)
    else if (result.attempt.id !== attemptId)
      navigate(`/quizzes/attempts/${encodeURIComponent(result.attempt.id)}`)
    else setUpdated(result.attempt)
  }
  async function answer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!attempt?.current_question) return
    const fields = new FormData(event.currentTarget)
    const confidence = String(fields.get('confidence') ?? '')
    accept(
      await commands.perform({
        kind: 'answer',
        attemptId,
        answer: {
          question_id: attempt.current_question.id,
          option_id: String(fields.get('option')),
          confidence: confidence === '' ? null : Number(confidence),
        },
      }),
    )
  }
  function refresh() {
    setUpdated(null)
    reload()
  }
  return (
    <QuizFrame title={attempt?.title ?? 'Saved quiz attempt'}>
      <QuizCommandNotice
        commands={commands}
        recover={() => {
          void commands.perform().then(accept)
        }}
      />
      {state.status === 'loading' && !attempt && (
        <p role="status">Loading your saved quiz…</p>
      )}
      {state.status === 'error' && (
        <QuizReadError error={state.error} reload={refresh} />
      )}
      {attempt && (
        <>
          <p>
            {attempt.room_id
              ? 'Private classroom quiz'
              : 'Standalone supplementary quiz'}{' '}
            · Attempt {attempt.attempt_number}
          </p>
          <p role="status" aria-atomic="true">
            {attempt.progress.answered} of {attempt.progress.total} answers
            saved
          </p>
          <progress
            aria-label="Quiz progress"
            value={attempt.progress.answered}
            max={attempt.progress.total}
          />
          <div className="quiz-actions">
            <button disabled={commands.busy} onClick={refresh}>
              Reload saved attempt
            </button>
            {attempt.room_id && (
              <Link
                to={`/quizzes/rooms/${encodeURIComponent(attempt.room_id)}`}
              >
                Return to classroom
              </Link>
            )}
          </div>
          {attempt.status === 'completed' && attempt.result ? (
            <section className="quiz-section">
              <h2 ref={heading} tabIndex={-1}>
                {attempt.result.passed
                  ? 'Quiz passed'
                  : 'Quiz completed — review your answers'}
              </h2>
              <p>
                Score: {attempt.result.score}%. Passing requires at least 80%
                correct and every critical risk item correct.
              </p>
              {!attempt.result.critical_passed && (
                <p>
                  A critical risk item needs review, even if the total score is
                  at least 80%.
                </p>
              )}
              <p>
                {attempt.room_id
                  ? 'Private classroom quizzes grant no XP, currency or rating.'
                  : `${attempt.result.xp_earned} player XP awarded for this attempt. Standalone quiz XP is awarded once per passed form and edition; it does not pass adventure levels or module checks.`}
              </p>
              <p>
                First answers remain saved. A quiz result does not establish
                trading competence.
              </p>
              {profileUnavailable && (
                <p role="status">
                  Your quiz result is saved. Profile totals could not be
                  refreshed; reload this page to check them again.
                </p>
              )}
              <QuizFeedbackList
                result={attempt.result}
                questions={attempt.completed_questions ?? []}
              />
              <Link
                to={
                  attempt.room_id
                    ? `/quizzes/rooms/${encodeURIComponent(attempt.room_id)}`
                    : '/quizzes'
                }
              >
                Choose the next activity
              </Link>
            </section>
          ) : attempt.current_question ? (
            <section className="quiz-section">
              <h2 ref={heading} tabIndex={-1}>
                Question {attempt.progress.answered + 1}
              </h2>
              <p>
                Each submitted answer is final for this attempt. Correctness and
                explanations appear after the whole quiz. Confidence is
                optional.
              </p>
              {room?.status === 'closed' && (
                <p className="quiz-notice" role="status">
                  The instructor closed this classroom. Your recorded progress
                  is retained, and new answers are no longer accepted.
                </p>
              )}
              <form
                key={attempt.current_question.id}
                onSubmit={(event) => {
                  void answer(event)
                }}
              >
                <fieldset
                  disabled={commands.disabled || room?.status === 'closed'}
                >
                  <legend>{attempt.current_question.prompt}</legend>
                  <div className="quiz-options">
                    {attempt.current_question.options.map((option) => (
                      <label className="quiz-option" key={option.id}>
                        <input
                          type="radio"
                          name="option"
                          value={option.id}
                          required
                        />
                        <span>{option.text}</span>
                      </label>
                    ))}
                  </div>
                  <label htmlFor="quiz-confidence">
                    Confidence, 0–100% (optional)
                  </label>
                  <input
                    id="quiz-confidence"
                    name="confidence"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                  />
                  <div className="quiz-actions">
                    <button type="submit">
                      {attempt.progress.answered + 1 === attempt.progress.total
                        ? 'Submit final answer and see results'
                        : 'Save answer and continue'}
                    </button>
                  </div>
                </fieldset>
              </form>
            </section>
          ) : null}
        </>
      )}
    </QuizFrame>
  )
}

export default function QuizAttemptPage() {
  const owner = useLoaderData<UserProfile>()
  const { attemptId = '' } = useParams()
  return (
    <QuizOwnerGate owner={owner.id}>
      <AttemptContent
        key={`${owner.id}:${attemptId}`}
        owner={owner.id}
        attemptId={attemptId}
      />
    </QuizOwnerGate>
  )
}
