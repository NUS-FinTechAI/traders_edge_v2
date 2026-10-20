import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import useAuth from '../../../hooks/useAuth.ts'
import { loadJourney } from '../../../services/journeyService.ts'
import useAdventureRead from '../../../hooks/useAdventureRead.ts'
import { learningError } from '../../../services/learningRunService.ts'
import './NextJourney.css'

function JourneyContent({ owner }: { owner: string }) {
  const [revision, setRevision] = useState(0)
  const load = useCallback(
    (signal: AbortSignal) => {
      void revision
      return loadJourney(owner, signal)
    },
    [owner, revision],
  )
  const { state } = useAdventureRead(load)
  if (state.status === 'loading')
    return <p role="status">Finding your next saved step…</p>
  if (state.status === 'error')
    return (
      <section className="next-journey" role="alert">
        <h2>Continue your journey</h2>
        <p>{learningError(state.error)}</p>
        <button onClick={() => setRevision((value) => value + 1)}>
          Reload next step
        </button>
      </section>
    )
  const action = state.data.game_next_action
  const module = action
    ? state.data.modules.find((item) => item.module_id === action.module_id)
    : null
  const level =
    action && 'level_id' in action
      ? module?.levels.find((item) => item.id === action.level_id)
      : null
  let destination = '/adventure'
  let label = 'Explore chapter maps'
  let detail =
    'The required learning checks and chapter bosses are complete. Optional bonuses and saved reviews remain available.'
  if (action) {
    switch (action.kind) {
      case 'resume_learning':
        destination = `/adventure/runs/${encodeURIComponent(action.run_id)}`
        label =
          action.purpose === 'assessment'
            ? 'Resume chapter learning check'
            : action.purpose === 'diagnostic'
              ? 'Resume introductory assessment'
              : 'Resume required missions'
        detail = 'Continue the same saved activity with its recorded answers.'
        break
      case 'diagnostic':
        destination = `/adventure/start/diagnostic/${encodeURIComponent(action.module_id)}`
        label = 'Start introductory assessment'
        detail =
          'Record your starting understanding. Incorrect answers do not block lessons.'
        break
      case 'level':
        destination = `/adventure/start/practice/${encodeURIComponent(action.level_id ?? '')}`
        label = 'Start required missions'
        detail =
          'Complete each required task in order to earn the normal star. Bonuses remain optional.'
        break
      case 'assessment':
        destination = `/adventure/start/assessment/${encodeURIComponent(action.module_id)}`
        label = 'Start chapter learning check'
        detail =
          'Pass at least 80% of the questions and every critical risk item before continuing the learning journey.'
        break
      case 'chapter_exit_boss':
        destination = action.attempt_id
          ? `/challenges/play/${encodeURIComponent(action.attempt_id)}`
          : `/challenges/start/chapter_exit?chapter=${encodeURIComponent(action.module_id)}`
        label =
          action.action === 'resume'
            ? 'Resume chapter boss'
            : action.action === 'retry'
              ? 'Review another boss attempt'
              : 'Read chapter boss briefing'
        detail =
          'Your chapter check is passed. Compare planned decisions against AI in a shared synthetic market; net profit decides the game result.'
        break
      default:
        destination = `/adventure/chapters/${encodeURIComponent(action.module_id)}`
        label = 'Open chapter map'
        detail =
          'Review the chapter’s required learning activity and saved progress.'
    }
  }
  const blocked = action?.kind === 'chapter_exit_boss' && !action.available
  return (
    <section className="next-journey" aria-labelledby="next-journey-title">
      <p className="next-journey-kicker">Your next step</p>
      <h2 id="next-journey-title">
        {level?.title ?? module?.title ?? 'Explore your completed journey'}
      </h2>
      <p>{detail}</p>
      {blocked ? (
        <>
          <p>
            Three challenges are already open. Resume one or review abandonment
            before starting this boss.
          </p>
          <ul>
            {action.blocking_attempt_ids.map((id, index) => (
              <li key={id}>
                <Link to={`/challenges/play/${encodeURIComponent(id)}`}>
                  Open saved challenge {index + 1}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Link className="next-journey-action" to={destination}>
          {label}
        </Link>
      )}
      {state.data.profile.due_review_count > 0 && (
        <p>
          <Link to="/player#reviews">
            {state.data.profile.due_review_count} learning{' '}
            {state.data.profile.due_review_count === 1
              ? 'review is'
              : 'reviews are'}{' '}
            ready
          </Link>
          . You can return to them separately from the chapter route.
        </p>
      )}
    </section>
  )
}

export default function NextJourney({ owner }: { owner: string }) {
  const { status, user, signingOut } = useAuth()
  if (status !== 'signed-in' || signingOut || user?.id !== owner) return null
  return <JourneyContent key={owner} owner={owner} />
}
