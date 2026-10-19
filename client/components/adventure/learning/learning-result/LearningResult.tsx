import { Link } from 'react-router-dom'
import type { LearningRun } from '../../../../services/learningRunService.ts'
import {
  NormalStar,
  SpecialStar,
} from '../../../icons/mission-stars/MissionStars.tsx'
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
          : run.purpose === 'assessment'
            ? result.passed
              ? 'Chapter learning check passed'
              : 'Review and try the chapter check again'
            : run.purpose === 'review'
              ? result.passed
                ? 'Delayed review passed'
                : 'Review saved for another practice session'
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
      {run.purpose === 'assessment' && (
        <p>
          Passing requires at least 80% correct and every critical risk item
          correct. Review the explanations before trying again.
        </p>
      )}
      {run.purpose === 'review' && !result.passed && (
        <p>
          Your next review uses the saved interval. Return to your learning
          journey when it is due.
        </p>
      )}
      {result.standard_star && (
        <p className="learning-earned-star">
          <NormalStar earned={true} /> Normal star earned
        </p>
      )}
      {result.bonus_star && (
        <p className="learning-earned-star">
          <SpecialStar earned={true} /> Special star earned
        </p>
      )}
      <p>XP recorded for this run: {result.xp_awarded}.</p>
      <LearningFeedback feedback={run.feedback} />
      {run.purpose === 'assessment' && !result.passed && (
        <Link
          className="learning-action"
          to={`/adventure/start/assessment/${encodeURIComponent(run.module_id)}`}
        >
          Try chapter check again
        </Link>
      )}
      <Link
        className="learning-action"
        to={`/adventure/chapters/${encodeURIComponent(run.module_id)}`}
      >
        Return to chapter map
      </Link>
    </section>
  )
}
