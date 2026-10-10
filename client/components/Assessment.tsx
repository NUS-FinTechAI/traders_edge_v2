import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { post } from '../api'
import type { Question, Result } from '../api'
import { Fox, Notice } from './ui'

type Props = {
  questions: Question[]
  endpoint: string
  reflectionPrompt?: string
  predictionPrompt?: string
  decisionPrompt?: string
  onSaved: () => void
  returnHref: string
  returnLabel: string
}
export function Assessment({
  questions,
  endpoint,
  reflectionPrompt,
  predictionPrompt,
  decisionPrompt,
  onSaved,
  returnHref,
  returnLabel,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [confidence, setConfidence] = useState<Record<string, string>>({})
  const [reflection, setReflection] = useState('')
  const [prediction, setPrediction] = useState('')
  const [decision, setDecision] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef({ serialized: '', key: '' })
  const feedbackRef = useRef<HTMLDivElement>(null)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const fullReflection = [
      predictionPrompt ? `Prediction: ${prediction}` : '',
      decisionPrompt ? `Decision: ${decision}` : '',
      `Reflection: ${reflection}`,
    ]
      .filter(Boolean)
      .join('\n\n')
    const payload = {
      answers: questions.map((q) => ({
        question_id: q.id,
        option_id: answers[q.id],
        ...(confidence[q.id] ? { confidence: Number(confidence[q.id]) } : {}),
      })),
      reflection: fullReflection,
    }
    const serialized = JSON.stringify(payload)
    if (request.current.serialized !== serialized)
      request.current = { serialized, key: crypto.randomUUID() }
    try {
      const saved = await post<Result>(endpoint, {
        ...payload,
        idempotency_key: request.current.key,
      })
      setResult(saved)
      onSaved()
      requestAnimationFrame(() => feedbackRef.current?.focus())
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <form onSubmit={submit} className="practice-form">
        {predictionPrompt && (
          <section className="learning-section">
            <h2>Make a prediction</h2>
            <label htmlFor="prediction">{predictionPrompt}</label>
            <textarea
              id="prediction"
              required
              minLength={10}
              maxLength={500}
              value={prediction}
              onChange={(e) => setPrediction(e.target.value)}
              disabled={busy || !!result?.passed}
            />
            <p className="small">
              Explain your expectation before checking the outcome.
            </p>
          </section>
        )}
        {decisionPrompt && (
          <section className="learning-section">
            <h2>Choose and explain</h2>
            <label htmlFor="decision">{decisionPrompt}</label>
            <textarea
              id="decision"
              required
              minLength={10}
              maxLength={500}
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              disabled={busy || !!result?.passed}
            />
          </section>
        )}
        <section className="learning-section">
          <h2>Check your reasoning</h2>
          <p className="small">
            Answer every question. The check considers risk-critical items as
            well as the overall score.
          </p>
          {questions.map((question, index) => (
            <fieldset
              className="choices"
              key={question.id}
              disabled={busy || !!result?.passed}
            >
              <legend>
                <span className="question-number">{index + 1}.</span>{' '}
                {question.prompt}
              </legend>
              {question.options.map((option) => (
                <label className="answer" key={option.id}>
                  <input
                    type="radio"
                    name={question.id}
                    required
                    value={option.id}
                    checked={answers[question.id] === option.id}
                    onChange={() =>
                      setAnswers({ ...answers, [question.id]: option.id })
                    }
                  />
                  <span>{option.text}</span>
                </label>
              ))}
              <details className="confidence">
                <summary>Add confidence (optional)</summary>
                <label
                  className="field-label"
                  htmlFor={`confidence-${question.id}`}
                >
                  How certain are you that your answer is correct?
                </label>
                <select
                  id={`confidence-${question.id}`}
                  value={confidence[question.id] ?? ''}
                  onChange={(e) =>
                    setConfidence({
                      ...confidence,
                      [question.id]: e.target.value,
                    })
                  }
                >
                  <option value="">Not recorded</option>
                  <option value="25">25% · a tentative choice</option>
                  <option value="50">50% · uncertain</option>
                  <option value="75">75% · fairly confident</option>
                  <option value="100">100% · very confident</option>
                </select>
              </details>
            </fieldset>
          ))}
        </section>
        <section className="learning-section">
          <h2>Reflect on your decision</h2>
          <label htmlFor="reflection">
            {reflectionPrompt ||
              'What risk mattered most, and what would you reconsider in another situation?'}
          </label>
          <textarea
            id="reflection"
            minLength={10}
            maxLength={800}
            required
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            disabled={busy || !!result?.passed}
          />
          <p className="small">
            10–800 characters. Avoid personal account numbers or financial
            details. Your written reasoning is recorded; it is not automatically
            assessed.
          </p>
        </section>
        {error && <Notice error>{error}</Notice>}
        {!result?.passed && (
          <button className="button" disabled={busy} type="submit">
            {busy
              ? 'Saving your reasoning…'
              : result
                ? 'Check my revised reasoning'
                : 'Check and save my reasoning'}
          </button>
        )}
      </form>
      {result && (
        <div
          className={`feedback${result.passed ? '' : ' reconsider'}`}
          ref={feedbackRef}
          tabIndex={-1}
        >
          <Fox>
            {result.passed
              ? 'Your learning check is recorded. Keep the explanation, not just the answer.'
              : 'Revisit the explanation, then reconsider the choices that need another look.'}
          </Fox>
          <h2>
            {result.passed
              ? 'Learning check recorded'
              : 'Some reasoning needs another look'}
          </h2>
          <p>
            {result.score_percent}% correct. {result.mastery_rule}
          </p>
          <ul className="feedback-list">
            {result.feedback.map((item) => (
              <li key={item.question_id}>
                <h3>
                  {questions.findIndex((q) => q.id === item.question_id) + 1}.{' '}
                  {item.correct
                    ? 'Correct reasoning'
                    : 'Reconsider this choice'}
                </h3>
                <p>{item.explanation}</p>
                {item.confidence !== null && (
                  <p className="small">
                    Your recorded confidence: {item.confidence}%.
                  </p>
                )}
              </li>
            ))}
          </ul>
          {result.calibration && (
            <details className="definition">
              <summary>Compare confidence with this attempt</summary>
              <p>
                Mean Brier score:{' '}
                {result.calibration.mean_brier_score.toFixed(3)} across{' '}
                {result.calibration.sample_size} recorded{' '}
                {result.calibration.sample_size === 1 ? 'answer' : 'answers'}.
                Lower values mean confidence was closer to observed correctness.
              </p>
              <p className="small">
                {result.calibration.scope} This small sample does not establish
                your overall calibration or financial ability.
              </p>
            </details>
          )}
          <p className="small">
            Reflection saved. Written reflection is not automatically assessed.{' '}
            {result.xp_awarded > 0
              ? `${result.xp_awarded} learning XP recorded.`
              : 'No additional XP was awarded for this attempt.'}
          </p>
          {result.passed ? (
            <a className="button" href={returnHref}>
              {returnLabel} →
            </a>
          ) : (
            <button
              className="button secondary"
              onClick={() => {
                setResult(null)
                document
                  .querySelector<HTMLInputElement>('.practice-form input')
                  ?.focus()
              }}
            >
              Review my answers
            </button>
          )}
        </div>
      )}
    </>
  )
}
