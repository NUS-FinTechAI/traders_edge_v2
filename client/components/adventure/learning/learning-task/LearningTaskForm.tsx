import { useState, type SubmitEvent } from 'react'
import type {
  LearningTask,
  StepAnswer,
} from '../../../../services/learningRunService.ts'
import './LearningTaskForm.css'

export default function LearningTaskForm({
  task,
  busy,
  withheld = false,
  onSubmit,
}: {
  task: LearningTask
  busy: boolean
  withheld?: boolean
  onSubmit: (answer: StepAnswer) => void
}) {
  const [option, setOption] = useState('')
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [confidence, setConfidence] = useState('')
  if (task.type === 'simulation')
    return (
      <section className="learning-task-form">
        <h2>{task.prompt}</h2>
        <p>
          This step requires the guided trading simulation, which is not yet
          available in this interface. Your completed steps are saved. This
          level stays unfinished until its simulation audit is completed.
        </p>
      </section>
    )
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || task.type === 'simulation') return
    const answer: StepAnswer =
      task.type === 'instruction'
        ? { acknowledged: true }
        : task.type === 'choice'
          ? { option_id: option }
          : { assignments }
    if (task.type !== 'instruction' && confidence !== '')
      answer.confidence = Number(confidence)
    onSubmit(answer)
  }
  return (
    <form className="learning-task-form" onSubmit={submit} aria-busy={busy}>
      <h2>{task.prompt}</h2>
      {task.type === 'instruction' && (
        <p className="learning-instruction">{task.text}</p>
      )}
      {task.type === 'choice' && (
        <fieldset disabled={busy}>
          <legend>Choose one answer</legend>
          {task.options.map((item) => (
            <label className="learning-choice" key={item.id}>
              <input
                type="radio"
                name="answer"
                value={item.id}
                checked={option === item.id}
                onChange={() => setOption(item.id)}
                required
              />
              <span>{item.text}</span>
            </label>
          ))}
        </fieldset>
      )}
      {task.type === 'classification' && (
        <fieldset disabled={busy}>
          <legend>Choose a category for each item</legend>
          {task.items.map((item) => (
            <label className="learning-classification" key={item.id}>
              <span>{item.text}</span>
              <select
                value={assignments[item.id] ?? ''}
                onChange={(event) =>
                  setAssignments({
                    ...assignments,
                    [item.id]: event.target.value,
                  })
                }
                required
              >
                <option value="" disabled>
                  Select a category
                </option>
                {task.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.text}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
      )}
      {task.type !== 'instruction' && (
        <label className="learning-confidence">
          How confident are you? (optional)
          <select
            disabled={busy}
            value={confidence}
            onChange={(event) => setConfidence(event.target.value)}
          >
            <option value="">Prefer not to say</option>
            {[0, 25, 50, 75, 100].map((value) => (
              <option key={value} value={value}>
                {value}%
              </option>
            ))}
          </select>
        </label>
      )}
      <button disabled={busy} type="submit">
        {busy
          ? 'Saving…'
          : task.type === 'instruction'
            ? 'Continue'
            : withheld
              ? 'Submit answer'
              : 'Check answer'}
      </button>
    </form>
  )
}
