import type { LearningRun } from '../../../../services/learningRunService.ts'
import './LearningFeedback.css'

export default function LearningFeedback({
  feedback,
}: {
  feedback: LearningRun['feedback']
}) {
  return (
    <section
      className="learning-feedback"
      aria-label="Answer feedback"
      aria-live="polite"
    >
      {feedback.map((item, index) => (
        <div key={`${item.step_id}:${index}`}>
          <h2>
            {feedback.length > 1 && `Question ${index + 1} · `}
            {item.correct ? 'Correct!' : 'Incorrect'}
          </h2>
          <p>{item.explanation}</p>
        </div>
      ))}
    </section>
  )
}
