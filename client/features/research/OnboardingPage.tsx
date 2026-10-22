import { useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  commandKey,
  getOnboarding,
  skipOnboarding,
  submitOnboarding,
  type PriorKnowledgeInstrument,
} from '../../services/researchService.ts'
import Button from '../../ui/Button.tsx'
import { Choices } from '../../ui/Choices.tsx'
import Emblem from '../../ui/Emblem.tsx'
import Modal from '../../ui/Modal.tsx'
import ProgressBar from '../../ui/ProgressBar.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import { useToast } from '../../ui/toastContext.ts'
import useResource, { errorText } from '../../ui/useResource.ts'
import {
  conceptAnswers,
  elapsedSeconds,
  selfReport,
  steps,
  type Answers,
} from './onboardingFlow.ts'
import styles from './Onboarding.module.css'

const AFTER = '/adventure'

function Flow({ instrument }: { instrument: PriorKnowledgeInstrument }) {
  const navigate = useNavigate()
  const notify = useToast()
  const sequence = steps(instrument)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [busy, setBusy] = useState(false)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const startedAt = useRef<number | null>(null)
  // One key per command, so a retry after a lost response replays it.
  const submitKey = useRef(commandKey())
  const skipKey = useRef(commandKey())

  const step = sequence[index]
  const question =
    step.kind === 'report'
      ? instrument.self_report[step.index]
      : step.kind === 'item'
        ? instrument.items[step.index]
        : null
  const selected = question ? (answers[question.id] ?? null) : null
  const last = index === sequence.length - 1

  async function finish(record: () => Promise<unknown>, message: string) {
    setBusy(true)
    try {
      await record()
      notify(message, 'success')
      void navigate(AFTER, { replace: true })
    } catch (error) {
      notify(errorText(error), 'error')
      setBusy(false)
    }
  }

  function submit(final: Answers) {
    void finish(
      () =>
        submitOnboarding({
          idempotency_key: submitKey.current,
          instrument_version: instrument.version,
          self_report: selfReport(final),
          answers: conceptAnswers(instrument, final),
          elapsed_seconds: elapsedSeconds(
            startedAt.current ?? performance.now(),
            performance.now(),
          ),
        }),
      'Thank you. Your answers were saved for the study.',
    )
  }

  function skip() {
    setConfirmSkip(false)
    void finish(
      () => skipOnboarding(skipKey.current, instrument.version),
      'Skipped. You will not be asked again.',
    )
  }

  function advance(value: string | null) {
    if (!question) return
    const next = { ...answers, [question.id]: value }
    setAnswers(next)
    if (last) submit(next)
    else setIndex(index + 1)
  }

  function begin() {
    startedAt.current = performance.now()
    setIndex(1)
  }

  let body
  let footer
  if (step.kind === 'intro' || !question) {
    body = (
      <div className={styles.intro}>
        <Emblem name="scroll" size={80} tone="gold" shape="circle" />
        <h1 className={styles.title}>A few questions for the study</h1>
        <p className={styles.lead}>
          You joined the research study, so we would like to know where you are
          starting from: {instrument.self_report.length} questions about your
          experience, then {instrument.items.length} short concept questions.
        </p>
        <ul className={styles.facts}>
          <li>There are no marks and no right or wrong feedback.</li>
          <li>It earns no XP and changes nothing in your game.</li>
          <li>
            Answer “Not sure” whenever you don’t know. Please don’t look
            anything up.
          </li>
          <li>Only the study team sees your answers, under a code name.</li>
        </ul>
      </div>
    )
    footer = (
      <div className={styles.actions}>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => setConfirmSkip(true)}
        >
          Skip
        </Button>
        <Button size="lg" iconRight="chevron-right" onClick={begin}>
          Start
        </Button>
      </div>
    )
  } else {
    const report = step.kind === 'report'
    const position = step.index + 1
    const count = report
      ? instrument.self_report.length
      : instrument.items.length
    body = (
      <section className={styles.question} aria-labelledby="study-prompt">
        <p className={styles.eyebrow}>
          {report ? 'About you' : 'Concept question'} · {position} of {count}
        </p>
        <h1 id="study-prompt" className={styles.prompt}>
          {question.prompt}
        </h1>
        <Choices
          key={question.id}
          label={question.prompt}
          options={question.options}
          selected={selected}
          onSelect={(id) => setAnswers({ ...answers, [question.id]: id })}
          trueFalse={'kind' in question && question.kind === 'true_false'}
          disabled={busy}
        />
      </section>
    )
    footer = (
      <div className={styles.actions}>
        <Button
          variant="secondary"
          size="lg"
          icon="chevron-left"
          aria-label="Previous question"
          disabled={busy}
          onClick={() => setIndex(index - 1)}
        />
        <Button
          variant="ghost"
          size="lg"
          disabled={busy}
          onClick={() => advance(null)}
        >
          {report ? 'Prefer not to say' : 'Not sure'}
        </Button>
        <Button
          size="lg"
          iconRight={last ? undefined : 'chevron-right'}
          className={styles.grow}
          disabled={!selected || busy}
          onClick={() => advance(selected)}
        >
          {busy ? 'Saving…' : last ? 'Finish' : 'Next'}
        </Button>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <ProgressBar
          value={index}
          max={sequence.length - 1}
          label="Study questions progress"
          valueText={`${index} of ${sequence.length - 1} questions`}
          className={styles.topBar}
        />
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => setConfirmSkip(true)}
        >
          Skip
        </Button>
      </header>
      <div className={styles.stage}>{body}</div>
      <div className={styles.footer}>{footer}</div>
      <Modal
        open={confirmSkip}
        title="Skip the study questions?"
        onClose={() => setConfirmSkip(false)}
      >
        <p className={styles.muted}>
          Nothing you answered here is saved, and you will not be asked again.
          You stay in the study and can keep playing.
        </p>
        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={() => setConfirmSkip(false)}>
            Keep answering
          </Button>
          <Button onClick={skip}>Skip</Button>
        </div>
      </Modal>
    </div>
  )
}

/** The one-time prior-knowledge questions; only participants with active consent ever see them. */
export default function OnboardingPage() {
  const resource = useResource(getOnboarding)
  return (
    <ResourceView resource={resource} label="Loading the study questions…">
      {(view) =>
        view.due && view.instrument ? (
          <Flow instrument={view.instrument} />
        ) : (
          <Navigate to={AFTER} replace />
        )
      }
    </ResourceView>
  )
}
