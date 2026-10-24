import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePlayer } from '../../app/PlayerContext.ts'
import {
  checkAnswer,
  completeCheck,
  getLevel,
  type CheckAnswer,
  type CheckComplete,
  type Level,
} from '../../services/campaignService.ts'
import Button from '../../ui/Button.tsx'
import Chip, { CurrencyChip } from '../../ui/Chip.tsx'
import { Choices, Feedback } from '../../ui/Choices.tsx'
import Emblem from '../../ui/Emblem.tsx'
import Modal from '../../ui/Modal.tsx'
import ProgressBar from '../../ui/ProgressBar.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import { useToast } from '../../ui/toastContext.ts'
import useResource, { errorText } from '../../ui/useResource.ts'
import useStartGame from '../play/useStartGame.ts'
import { answerQueue, firstTryCount, startQueue } from './checkQueue.ts'
import { singleFlight } from './singleFlight.ts'
import LessonVisual from './visuals/LessonVisual.tsx'
import styles from './Level.module.css'

type Phase = 'choose' | 'cards' | 'check' | 'done' | 'practice'

/** Plain text with **bold** spans; blank lines start new paragraphs. */
function RichText({ text }: { text: string }) {
  return text
    .split(/\n\s*\n/)
    .map((paragraph, index) => (
      <p key={index}>
        {paragraph
          .split(/\*\*(.+?)\*\*/g)
          .map((part, partIndex) =>
            partIndex % 2 ? (
              <strong key={partIndex}>{part}</strong>
            ) : (
              <Fragment key={partIndex}>{part}</Fragment>
            ),
          )}
      </p>
    ))
}

function LevelFlow({ level }: { level: Level }) {
  const navigate = useNavigate()
  const notify = useToast()
  const { refreshPlayer } = usePlayer()
  const { start, busy: starting } = useStartGame()
  const [phase, setPhase] = useState<Phase>(() =>
    level.progress.check_done
      ? 'choose'
      : level.cards.length
        ? 'cards'
        : 'check',
  )
  const [cardIndex, setCardIndex] = useState(0)
  const [queue, setQueue] = useState(() =>
    startQueue(level.check.map(({ id }) => id)),
  )
  const [selected, setSelected] = useState<string | null>(null)
  const [answer, setAnswer] = useState<CheckAnswer | null>(null)
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<CheckComplete | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [glossary, setGlossary] = useState(false)
  const autoFinished = useRef(false)

  const mapPath = `/adventure/${encodeURIComponent(level.chapter_id)}`
  const cards = level.cards
  const questions = level.check
  const total = cards.length + questions.length
  const solved = questions.length - queue.queue.length
  const progress =
    phase === 'cards'
      ? cardIndex + 1
      : phase === 'check'
        ? cards.length + solved + (answer?.correct ? 1 : 0)
        : phase === 'choose'
          ? 0
          : total
  const midLesson = (phase === 'cards' && cardIndex > 0) || phase === 'check'
  const question = questions.find(({ id }) => id === queue.queue[0])

  function restart() {
    setCardIndex(0)
    setQueue(startQueue(questions.map(({ id }) => id)))
    setSelected(null)
    setAnswer(null)
    setSummary(null)
    autoFinished.current = false
    setPhase(cards.length ? 'cards' : 'check')
  }

  async function check() {
    if (!question || !selected || busy) return
    setBusy(true)
    try {
      setAnswer(await checkAnswer(level.id, question.id, selected))
    } catch (error) {
      notify(errorText(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  // The last answer and the auto-finish effect below both ask to finish; the
  // server closes the run on the first request and answers a second one with
  // a 409, so concurrent requests must share a single call.
  const finishing = useRef<Promise<void> | null>(null)
  function finishCheck() {
    return singleFlight(finishing, runFinish)
  }
  async function runFinish() {
    setBusy(true)
    try {
      setSummary(await completeCheck(level.id))
      setPhase('done')
      void refreshPlayer()
    } catch (error) {
      notify(errorText(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  // A level whose check has no questions (or whose last answer was saved
  // before a reload) still closes the check once, so practice unlocks.
  useEffect(() => {
    if (phase !== 'check' || question || summary || autoFinished.current) return
    autoFinished.current = true
    queueMicrotask(() => void finishCheck())
  })

  function next() {
    if (!question || !answer) return
    const updated = answerQueue(queue, question.id, answer.correct)
    setQueue(updated)
    setSelected(null)
    setAnswer(null)
    if (!updated.queue.length) void finishCheck()
  }

  let body: ReactNode
  let footer: ReactNode = null

  if (phase === 'choose') {
    body = (
      <div className={styles.choose}>
        <Emblem name="trophy" size={80} tone="gold" />
        <p className={styles.eyebrow}>Level {level.number}</p>
        <h1 className={styles.title}>{level.title}</h1>
        <p className={styles.muted}>You’ve already passed this check.</p>
        <div className={styles.chooseGrid}>
          <button type="button" className={styles.option} onClick={restart}>
            <Emblem name="book" size={56} tone="gem" />
            <span className={styles.optionTitle}>Replay lesson</span>
            <span className={styles.muted}>Cards and check again</span>
          </button>
          <button
            type="button"
            className={styles.option}
            onClick={() => setPhase('practice')}
          >
            <Emblem name="candles" size={56} tone="green" />
            <span className={styles.optionTitle}>Go to trading mission</span>
            <span className={styles.muted}>Earn this level’s stars</span>
          </button>
        </div>
      </div>
    )
  } else if (phase === 'cards' && cards[cardIndex]) {
    const card = cards[cardIndex]
    const last = cardIndex === cards.length - 1
    body = (
      <article key={cardIndex} className={styles.card}>
        <p className={styles.eyebrow}>
          Card {cardIndex + 1} of {cards.length}
        </p>
        <h1 className={styles.cardTitle}>{card.title}</h1>
        <div className={styles.cardBody}>
          <RichText text={card.body} />
        </div>
        <div className={styles.visual}>
          <LessonVisual name={card.visual} />
        </div>
      </article>
    )
    footer = (
      <div className={styles.cardNav}>
        <Button
          variant="secondary"
          size="lg"
          icon="chevron-left"
          disabled={cardIndex === 0}
          onClick={() => setCardIndex(cardIndex - 1)}
          aria-label="Previous card"
        />
        <ol className={styles.dots} aria-hidden="true">
          {cards.map((item, index) => (
            <li
              key={item.title}
              className={index === cardIndex ? styles.dotOn : undefined}
            />
          ))}
        </ol>
        <Button
          size="lg"
          iconRight="chevron-right"
          className={styles.grow}
          onClick={() =>
            last
              ? setPhase(questions.length ? 'check' : 'practice')
              : setCardIndex(cardIndex + 1)
          }
        >
          {last ? 'Start check' : 'Next'}
        </Button>
      </div>
    )
  } else if (phase === 'check' && question) {
    const retry = question.id in queue.firstTry
    body = (
      <section className={styles.question} aria-labelledby="question-prompt">
        <p className={styles.eyebrow}>
          {retry ? 'Try this one again' : 'Quick check'} · {queue.queue.length}{' '}
          to go
        </p>
        <h1 id="question-prompt" className={styles.prompt}>
          {question.prompt}
        </h1>
        <Choices
          label={question.prompt}
          options={question.options}
          selected={selected}
          onSelect={setSelected}
          trueFalse={question.kind === 'true_false'}
          disabled={busy}
          result={
            answer && selected
              ? { correct: answer.correct_option_id, chosen: selected }
              : null
          }
        />
      </section>
    )
    footer = answer ? (
      <Feedback
        correct={answer.correct}
        explanation={answer.explanation}
        correctText={
          question.options.find(({ id }) => id === answer.correct_option_id)
            ?.text
        }
        reward={
          answer.correct && queue.streak + 1 >= 2 ? (
            <Chip tone="flame" icon="flame">
              {queue.streak + 1} in a row
            </Chip>
          ) : null
        }
        actionLabel={
          queue.queue.length === 1 && answer.correct ? 'Finish' : 'Continue'
        }
        onAction={next}
      />
    ) : (
      <Button
        size="lg"
        block
        disabled={!selected || busy}
        onClick={() => void check()}
      >
        {busy ? 'Checking…' : 'Check'}
      </Button>
    )
  } else if (phase === 'check') {
    body = (
      <div className={styles.choose}>
        <Emblem name="scroll" size={72} tone="gold" />
        <h1 className={styles.title}>Saving your check…</h1>
        <Button disabled={busy} onClick={() => void finishCheck()}>
          Try again
        </Button>
      </div>
    )
  } else if (phase === 'done') {
    // The server counts first tries in this run of the check.
    const runScore = summary?.first_try_correct ?? firstTryCount(queue)
    const runTotal = summary?.total ?? questions.length
    const strong = runTotal > 0 && runScore * 2 >= runTotal
    body = (
      <div className={styles.choose}>
        <Emblem
          name={strong ? 'trophy' : 'book'}
          size={96}
          tone={strong ? 'gold' : 'gem'}
          shape="circle"
        />
        <h1 className={styles.title}>
          {strong ? 'Check complete!' : 'Check complete — keep practising'}
        </h1>
        <p className={styles.score}>
          <span className="num">
            {runScore}/{runTotal}
          </span>{' '}
          right first try
        </p>
        {summary && summary.xp > 0 ? (
          <CurrencyChip kind="xp" amount={summary.xp} signed />
        ) : (
          <p className={styles.muted}>XP for this check is already yours.</p>
        )}
      </div>
    )
    footer = (
      <Button
        size="lg"
        block
        iconRight="chevron-right"
        onClick={() => setPhase('practice')}
      >
        Next: trading mission
      </Button>
    )
  } else {
    body = (
      <section className={styles.briefing} aria-labelledby="mission-title">
        <div className={styles.briefingHead}>
          <Emblem name="candles" size={72} tone="green" />
          <div>
            <p className={styles.eyebrow}>Trading mission</p>
            <h1 id="mission-title" className={styles.title}>
              {level.practice.title}
            </h1>
          </div>
        </div>
        <p className={styles.briefingText}>{level.practice.briefing}</p>
      </section>
    )
    footer = (
      <div className={styles.practiceActions}>
        <Button
          size="lg"
          icon="play"
          className={styles.grow}
          disabled={!!starting}
          onClick={() =>
            void start(
              { mode: 'level', level_id: level.id },
              { scenarioId: level.practice.scenario_id },
            )
          }
        >
          {starting ? 'Starting…' : 'Start trading mission'}
        </Button>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Button
          variant="ghost"
          icon="close"
          aria-label="Close lesson"
          onClick={() =>
            midLesson ? setLeaving(true) : void navigate(mapPath)
          }
        />
        <ProgressBar
          value={progress}
          max={total}
          label="Lesson progress"
          className={styles.topBar}
        />
        {phase === 'check' && queue.streak >= 2 && (
          <Chip
            tone="flame"
            icon="flame"
            aria-label={`${queue.streak} correct in a row`}
          >
            <span className="num" aria-hidden="true">
              {queue.streak}
            </span>
          </Chip>
        )}
        {level.terms.length > 0 && (
          <Button
            variant="ghost"
            icon="book"
            aria-label="Key terms"
            onClick={() => setGlossary(true)}
          />
        )}
      </header>
      <div className={styles.stage}>{body}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
      <p className={styles.safety}>
        Simulated money, fictional companies. Practice only — not financial
        advice.
      </p>
      <Modal
        open={leaving}
        title="Leave this lesson?"
        onClose={() => setLeaving(false)}
      >
        <p className={styles.muted}>
          You’ll start this lesson from the beginning next time.
        </p>
        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={() => setLeaving(false)}>
            Keep learning
          </Button>
          <Button variant="danger" onClick={() => void navigate(mapPath)}>
            Leave
          </Button>
        </div>
      </Modal>
      <Modal
        open={glossary}
        title="Key terms"
        onClose={() => setGlossary(false)}
      >
        <dl className={styles.terms}>
          {level.terms.map((term) => (
            <div key={term.term}>
              <dt>{term.term}</dt>
              <dd>{term.definition}</dd>
            </div>
          ))}
        </dl>
      </Modal>
    </div>
  )
}

export default function LevelPage() {
  const { levelId = '' } = useParams()
  const resource = useResource((signal) => getLevel(levelId, signal), [levelId])
  return (
    <ResourceView resource={resource} label="Opening the lesson…">
      {(level) => <LevelFlow key={level.id} level={level} />}
    </ResourceView>
  )
}
