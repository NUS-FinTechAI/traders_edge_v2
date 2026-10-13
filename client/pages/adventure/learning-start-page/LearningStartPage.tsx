import { useEffect, useState } from 'react'
import { Link, useLoaderData, useNavigate, useParams } from 'react-router-dom'
import type { UserProfile } from '../../../services/authService.ts'
import {
  isLearningPurpose,
  LearningCommands,
  type LearningPurpose,
} from '../../../services/learningRunService.ts'
import './LearningStartPage.css'

function StartActivity({
  owner,
  purpose,
  target,
}: {
  owner: string
  purpose: LearningPurpose
  target: string
}) {
  const navigate = useNavigate()
  const [error, setError] = useState<unknown>(null)
  const [commands] = useState(() => {
    try {
      return new LearningCommands(owner, sessionStorage)
    } catch {
      return null
    }
  })
  useEffect(() => {
    const controller = new AbortController()
    if (!commands) return
    void commands
      .start(purpose, target, controller.signal)
      .then(async (run) => {
        if (controller.signal.aborted) return
        await navigate(`/adventure/runs/${encodeURIComponent(run.id)}`, {
          replace: true,
        })
        commands.finishStart(purpose, target)
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure)
      })
    return () => controller.abort()
  }, [commands, purpose, target, navigate])
  if (error !== null) throw error
  if (!commands) throw new Error('Browser storage is unavailable')
  return (
    <main className="learning-start-page">
      <h1>
        {purpose === 'diagnostic'
          ? 'Introductory assessment'
          : purpose === 'bonus'
            ? 'Bonus missions'
            : 'Required missions'}
      </h1>
      <p role="status">Opening your saved activity…</p>
      <Link to="/adventure">Return to chapters</Link>
    </main>
  )
}

export default function LearningStartPage() {
  const { purpose = '', target = '' } = useParams()
  const user = useLoaderData<UserProfile>()
  if (!isLearningPurpose(purpose) || !target)
    return (
      <main className="learning-start-page">
        <h1>Activity not found</h1>
        <Link to="/adventure">Return to chapters</Link>
      </main>
    )
  return (
    <StartActivity
      key={`${user.id}:${purpose}:${target}`}
      owner={user.id}
      purpose={purpose}
      target={target}
    />
  )
}
