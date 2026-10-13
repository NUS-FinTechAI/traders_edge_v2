import { useToast } from '../../../../contexts/ToastContext.ts'
import { learningError } from '../../../../services/learningRunService.ts'
import { useEffect, useRef, useState } from 'react'
import {
  openLessonSimulation,
  type LessonSimulation as Session,
} from '../../../../services/lessonSimulationService.ts'
import './LessonSimulation.css'

export default function LessonSimulation({
  owner,
  runId,
  prompt,
}: {
  owner: string
  runId: string
  prompt: string
}) {
  const [session, setSession] = useState<Session | null>(null)
  const showToast = useToast()
  const [busy, setBusy] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(
    () => () => {
      request.current?.abort()
    },
    [],
  )

  async function open() {
    if (request.current && !request.current.signal.aborted) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    try {
      const current = await openLessonSimulation(
        owner,
        runId,
        sessionStorage,
        controller.signal,
      )
      if (!controller.signal.aborted) setSession(current)
    } catch (failure) {
      if (!controller.signal.aborted) showToast(learningError(failure))
    } finally {
      if (!controller.signal.aborted) {
        request.current = null
        setBusy(false)
      }
    }
  }

  return (
    <section className="lesson-simulation" aria-busy={busy}>
      <h2>{prompt}</h2>
      <p>
        Your simulation is saved with this lesson. Opening it again resumes the
        same session.
      </p>
      {session ? (
        <p role="status">
          Saved simulation loaded at observation {session.tick}.{' '}
          {session.finished
            ? 'The simulation has finished. Reload the lesson to view its latest progress.'
            : 'Your lesson remains in progress.'}
        </p>
      ) : (
        <button disabled={busy} onClick={() => void open()}>
          {busy ? 'Opening simulation…' : 'Open saved simulation'}
        </button>
      )}
      <p>
        Trading controls and the completion audit are not available in this
        interface yet.
      </p>
    </section>
  )
}
