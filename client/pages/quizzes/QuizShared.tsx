import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  quizError,
  type QuizQuestion,
  type QuizResult,
} from '../../services/quizService.ts'
import type { useQuizCommands } from './useQuizState.ts'
import useAuth from '../../hooks/useAuth.ts'
import './quizzes.css'

export function QuizFrame({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <main className="quiz-page">
      <nav aria-label="Quiz navigation">
        <Link to="/quizzes">Quiz home</Link>
        <Link to="/adventure">Adventure</Link>
      </nav>
      <h1>{title}</h1>
      {children}
    </main>
  )
}

export function QuizOwnerGate({
  owner,
  children,
}: {
  owner: string
  children: ReactNode
}) {
  const { user, status, signingOut } = useAuth()
  if (status === 'loading' || signingOut)
    return (
      <QuizFrame title="Quiz account">
        <p role="status">Checking your signed-in account…</p>
      </QuizFrame>
    )
  if (user?.id !== owner)
    return (
      <QuizFrame title="Quiz account changed">
        <p role="alert">
          The signed-in account changed. This account’s previous quiz view has
          been hidden. Sign in again to open your own quizzes.
        </p>
        <Link to="/login?returnTo=%2Fquizzes">Check sign-in</Link>
      </QuizFrame>
    )
  return children
}

export function QuizCommandNotice({
  commands,
  recover,
}: {
  commands: ReturnType<typeof useQuizCommands>
  recover: () => void
}) {
  return (
    <>
      {commands.error !== null && (
        <div className="quiz-notice" role="alert">
          {quizError(commands.error)}
        </div>
      )}
      {commands.pending && (
        <section className="quiz-notice" aria-labelledby="quiz-pending-title">
          <h2 id="quiz-pending-title">Confirm your saved quiz action</h2>
          <p>
            An earlier response has not been confirmed. Its original answer or
            room action is saved in this tab. Confirm it before making another
            choice.
          </p>
          <button
            disabled={commands.busy || !commands.recoverable}
            onClick={recover}
          >
            {commands.busy ? 'Confirming…' : 'Confirm saved action'}
          </button>
        </section>
      )}
      {commands.busy && (
        <p role="status">Saving and reading your current quiz state…</p>
      )}
    </>
  )
}

export function QuizReadError({
  error,
  reload,
}: {
  error: unknown
  reload: () => void
}) {
  return (
    <section className="quiz-notice" role="alert">
      <p>{quizError(error)}</p>
      <button onClick={reload}>Reload saved quiz</button>
    </section>
  )
}

export function QuizFeedbackList({
  result,
  questions = [],
}: {
  result: QuizResult
  questions?: QuizQuestion[]
}) {
  return (
    <ol className="quiz-feedback-list">
      {result.feedback.map((feedback, index) => {
        const question = questions.find(
          (question) => question.id === feedback.question_id,
        )
        const optionText = (id: string) =>
          question?.options.find((option) => option.id === id)?.text ?? id
        return (
          <li key={feedback.question_id}>
            <h3>
              Question {index + 1}:{' '}
              {feedback.correct ? 'Correct' : 'Review this answer'}
            </h3>
            {question && <p>{question.prompt}</p>}
            <p>
              Your recorded answer: {optionText(feedback.selected_option_id)}
            </p>
            {!feedback.correct && (
              <p>Correct answer: {optionText(feedback.correct_option_id)}</p>
            )}
            <p>{feedback.explanation}</p>
            {feedback.confidence !== null && (
              <p>Recorded confidence: {feedback.confidence}%</p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
