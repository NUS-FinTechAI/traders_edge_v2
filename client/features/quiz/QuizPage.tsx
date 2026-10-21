import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { usePlayer } from '../../app/PlayerContext.ts'
import {
  answerQuestion,
  getAttempt,
  startAttempt,
  type Confidence,
  type QuizAttempt,
} from '../../services/quizService.ts'
import Button, { ButtonLink } from '../../ui/Button.tsx'
import Chip, { CurrencyChip } from '../../ui/Chip.tsx'
import { Choices, Feedback } from '../../ui/Choices.tsx'
import Icon from '../../ui/Icon.tsx'
import ProgressBar from '../../ui/ProgressBar.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import { useToast } from '../../ui/toastContext.ts'
import useResource, { errorText } from '../../ui/useResource.ts'
import { attemptPath } from './paths.ts'
import styles from './QuizPage.module.css'

const CONFIDENCE: { id: Confidence; label: string }[] = [
  { id: 'sure', label: 'Sure' },
  { id: 'think', label: 'Think so' },
  { id: 'guess', label: 'Guessing' },
]

function streakOf(attempt: QuizAttempt): number {
  let streak = 0
  for (const question of attempt.questions) {
    if (!question.answered) break
    streak = question.answered.correct ? streak + 1 : 0
  }
  return streak
}

function ScoreRing({ score, total }: { score: number; total: number }) {
  const pct = total ? score / total : 0
  const radius = 52
  const length = 2 * Math.PI * radius
  return (
    <div className={styles.ring}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} className={styles.ringTrack} />
        <circle
          cx="60"
          cy="60"
          r={radius}
          className={styles.ringFill}
          strokeDasharray={`${length * pct} ${length}`}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <span className={styles.ringText}>
        <span className="num">
          {score}/{total}
        </span>
        <span className={styles.ringPct}>{Math.round(pct * 100)}%</span>
      </span>
    </div>
  )
}

function Results({
  attempt,
  topicId,
}: {
  attempt: QuizAttempt
  topicId: string | null
}) {
  const navigate = useNavigate()
  const notify = useToast()
  const [busy, setBusy] = useState(false)

  async function retry() {
    if (!topicId) return
    setBusy(true)
    try {
      const next = await startAttempt({ topic_id: topicId })
      void navigate(attemptPath(next.id, topicId), { replace: true })
    } catch (error) {
      notify(errorText(error), 'error')
      setBusy(false)
    }
  }

  const headline =
    attempt.passed === null
      ? 'Quiz complete'
      : attempt.passed
        ? 'Passed!'
        : 'Not passed yet'
  return (
    <div className={styles.results}>
      <ScoreRing score={attempt.score} total={attempt.total} />
      <h1 className={styles.resultTitle}>{headline}</h1>
      <p className={styles.muted}>
        {attempt.title}
        {attempt.passed === false && ' · 80% passes'}
      </p>
      {attempt.room_id ? (
        <p className={styles.muted}>Classroom quizzes give no XP.</p>
      ) : attempt.xp > 0 ? (
        <CurrencyChip kind="xp" amount={attempt.xp} signed />
      ) : null}
      <div className={styles.resultActions}>
        {topicId && (
          <Button
            variant={attempt.passed ? 'secondary' : 'primary'}
            icon="refresh"
            disabled={busy}
            onClick={() => void retry()}
          >
            Retry
          </Button>
        )}
        {attempt.room_id ? (
          <ButtonLink
            to={`/quiz/room/${encodeURIComponent(attempt.room_id)}`}
            variant={topicId ? 'secondary' : 'primary'}
          >
            Back to the room
          </ButtonLink>
        ) : (
          <ButtonLink
            to="/quiz"
            variant={attempt.passed || !topicId ? 'primary' : 'secondary'}
          >
            Back to quizzes
          </ButtonLink>
        )}
      </div>
      <section className={styles.review} aria-labelledby="review-title">
        <h2 id="review-title" className={styles.reviewTitle}>
          Review
        </h2>
        <ol className={styles.reviewList}>
          {attempt.questions.map((question, index) => {
            const answered = question.answered
            const chosen = question.options.find(
              (option) => option.id === answered?.option_id,
            )
            const correct = question.options.find(
              (option) => option.id === answered?.correct_option_id,
            )
            return (
              <li key={question.id} className={styles.reviewItem}>
                <span
                  className={
                    answered?.correct ? styles.markGood : styles.markBad
                  }
                  aria-hidden="true"
                >
                  <Icon
                    name={answered?.correct ? 'check' : 'close'}
                    size={18}
                  />
                </span>
                <div className={styles.reviewBody}>
                  <p className={styles.reviewPrompt}>
                    <span className="visually-hidden">
                      Question {index + 1},{' '}
                      {answered?.correct ? 'correct' : 'incorrect'}:{' '}
                    </span>
                    {question.prompt}
                  </p>
                  <p className={styles.muted}>
                    Your answer: {chosen?.text ?? 'No answer'}
                  </p>
                  {!answered?.correct && correct && (
                    <p className={styles.correctLine}>Answer: {correct.text}</p>
                  )}
                  {answered && (
                    <details className={styles.why}>
                      <summary>Why?</summary>
                      <p>{answered.explanation}</p>
                    </details>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}

function QuizRun({ initial }: { initial: QuizAttempt }) {
  const navigate = useNavigate()
  const notify = useToast()
  const { refreshPlayer } = usePlayer()
  const [search] = useSearchParams()
  const [attempt, setAttempt] = useState(initial)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [confidence, setConfidence] = useState<Confidence | null>(null)
  const [busy, setBusy] = useState(false)

  const index = reviewId
    ? attempt.questions.findIndex((question) => question.id === reviewId)
    : attempt.questions.findIndex((question) => !question.answered)
  const question = index >= 0 ? attempt.questions[index] : null
  const answeredCount = attempt.questions.filter((item) => item.answered).length
  const streak = streakOf(attempt)

  if (!question || (attempt.status === 'complete' && !reviewId))
    return <Results attempt={attempt} topicId={search.get('topic')} />

  const answer = reviewId ? question.answered : null

  async function submit() {
    if (!question || !selected || busy) return
    setBusy(true)
    try {
      const updated = await answerQuestion(attempt.id, {
        question_id: question.id,
        option_id: selected,
        ...(confidence ? { confidence } : {}),
      })
      setAttempt(updated)
      setReviewId(question.id)
      if (updated.status === 'complete') void refreshPlayer()
    } catch (error) {
      // The answer may have been saved even though the reply was lost (the
      // first answer is final), so reload the attempt before asking again.
      const saved = await getAttempt(attempt.id).catch(() => null)
      const answered = saved?.questions.find(
        (item) => item.id === question.id,
      )?.answered
      if (saved && answered) {
        setAttempt(saved)
        setReviewId(question.id)
        if (saved.status === 'complete') void refreshPlayer()
      } else {
        notify(errorText(error), 'error')
      }
    } finally {
      setBusy(false)
    }
  }

  function next() {
    setReviewId(null)
    setSelected(null)
    setConfidence(null)
  }

  const last = attempt.status === 'complete'

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Button
          variant="ghost"
          icon="close"
          aria-label="Leave quiz (answers are saved)"
          onClick={() =>
            void navigate(
              attempt.room_id
                ? `/quiz/room/${encodeURIComponent(attempt.room_id)}`
                : '/quiz',
            )
          }
        />
        <div className={styles.topMid}>
          <p className={styles.counter}>
            {attempt.title} · Question {index + 1} of {attempt.total}
          </p>
          <ProgressBar
            value={answeredCount}
            max={attempt.total}
            label="Quiz progress"
            valueText={`${answeredCount} of ${attempt.total} answered`}
          />
        </div>
        <Chip tone="flame" icon="flame" aria-label={`Streak ${streak}`}>
          <span className="num" aria-hidden="true">
            {streak}
          </span>
        </Chip>
      </header>

      <section className={styles.stage} aria-labelledby="quiz-prompt">
        <h1 id="quiz-prompt" className={styles.prompt}>
          {question.prompt}
        </h1>
        <Choices
          label={question.prompt}
          options={question.options}
          selected={answer ? answer.option_id : selected}
          onSelect={setSelected}
          disabled={busy}
          result={
            answer
              ? { correct: answer.correct_option_id, chosen: answer.option_id }
              : null
          }
        />
        {!answer && (
          <div
            className={styles.confidence}
            role="group"
            aria-labelledby="confidence-label"
          >
            <span id="confidence-label" className={styles.confidenceLabel}>
              How sure are you? <span className={styles.dim}>(optional)</span>
            </span>
            <div className={styles.confidenceButtons}>
              {CONFIDENCE.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={confidence === item.id}
                  className={styles.confidenceButton}
                  onClick={() =>
                    setConfidence(confidence === item.id ? null : item.id)
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className={styles.footer}>
        {answer ? (
          <Feedback
            correct={answer.correct}
            explanation={answer.explanation}
            correctText={
              question.options.find(
                (option) => option.id === answer.correct_option_id,
              )?.text
            }
            reward={
              answer.correct && streak >= 2 ? (
                <Chip tone="flame" icon="flame">
                  {streak} in a row
                </Chip>
              ) : null
            }
            actionLabel={last ? 'See results' : 'Next question'}
            onAction={next}
          />
        ) : (
          <Button
            size="lg"
            block
            disabled={!selected || busy}
            onClick={() => void submit()}
          >
            {busy ? 'Checking…' : 'Check'}
          </Button>
        )}
      </div>
    </div>
  )
}

export default function QuizPage() {
  const { attemptId = '' } = useParams()
  const resource = useResource(
    (signal) => getAttempt(attemptId, signal),
    [attemptId],
  )
  return (
    <ResourceView resource={resource} label="Opening the quiz…">
      {(attempt) => <QuizRun key={attempt.id} initial={attempt} />}
    </ResourceView>
  )
}
