import { Link } from 'react-router-dom'
import type { LearningRun } from '../../../services/learningRunService.ts'
import { Star } from '../../icons/mission-stars/MissionStars.tsx'
import LearningFeedback from '../learning-feedback/LearningFeedback.tsx'
import './LearningResult.css'

export default function LearningResult({ run }: { run: LearningRun }) {
  const result = run.result
  if (!result) return null
  return (
    <section className="learning-result">
      <h2>
        {run.purpose === 'diagnostic'
          ? 'Starting check complete'
          : result.passed
            ? 'Missions complete'
            : 'Activity complete'}
      </h2>
      {run.purpose === 'diagnostic' && (
        <p>
          Your responses are saved. You can now begin this chapter’s lessons.
        </p>
      )}
      <p>Score: {result.score_percent}%</p>
      {result.standard_star && (
        <p className="learning-earned-star">
          <Star /> Normal star earned
        </p>
      )}
      {result.bonus_star && (
        <p className="learning-earned-star">
          <Star special /> Special star earned
        </p>
      )}
      <p>XP recorded for this run: {result.xp_awarded}.</p>
      <LearningFeedback feedback={run.feedback} />
      <Link
        className="learning-action"
        to={`/adventure/chapters/${encodeURIComponent(run.module_id)}`}
      >
        Return to chapter map
      </Link>
    </section>
  )
}
