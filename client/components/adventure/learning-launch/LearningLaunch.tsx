import { Link } from 'react-router-dom'
import type { LearningPurpose } from '../../../services/learningRunService.ts'
import './LearningLaunch.css'

export default function LearningLaunch({
  purpose,
  target,
  available,
  runId,
  label,
  resumeLabel = 'Resume saved activity',
}: {
  purpose: LearningPurpose
  target: string
  available: boolean
  runId?: string | null
  label: string
  resumeLabel?: string
}) {
  if (!available && !runId) return null
  const destination = runId
    ? `/adventure/runs/${encodeURIComponent(runId)}`
    : `/adventure/start/${purpose}/${encodeURIComponent(target)}`
  return (
    <Link className="learning-launch" to={destination}>
      {runId ? resumeLabel : label}
    </Link>
  )
}
