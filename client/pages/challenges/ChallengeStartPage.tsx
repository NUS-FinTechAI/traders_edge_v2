import { useCallback, useState } from 'react'
import {
  Link,
  useLoaderData,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import type { UserProfile } from '../../services/authService.ts'
import useAdventureRead from '../../hooks/useAdventureRead.ts'
import {
  challengeError,
  challengeMode,
  challengeNames,
  challengePath,
  loadChallengeOverview,
  startAvailability,
  type ChallengeMode,
} from '../../services/challengeReadService.ts'
import useChallengeSession from './useChallengeSession.ts'
import './Challenges.css'

function StartChallenge({
  owner,
  mode,
  moduleId,
}: {
  owner: string
  mode: ChallengeMode
  moduleId: string | null
}) {
  const load = useCallback(
    (signal: AbortSignal) => loadChallengeOverview(signal),
    [],
  )
  const read = useAdventureRead(load).state
  const { controller, state, busy } = useChallengeSession(owner)
  const [opponents, setOpponents] = useState(1)
  const navigate = useNavigate()
  const chapter =
    read.status === 'ready'
      ? read.data.chapters.find((item) => item.module_id === moduleId)
      : null
  const reason =
    read.status === 'ready'
      ? startAvailability(read.data, mode, moduleId)
      : null
  const saved = state.challenge
  const savedActive = saved?.status === 'active'
  async function start() {
    try {
      await controller.start({
        mode,
        opponent_count: mode === 'practice' ? opponents : 1,
        ...((mode === 'chapter_entry' || mode === 'chapter_exit') && moduleId
          ? { module_id: moduleId }
          : {}),
      })
      const challenge = controller.getSnapshot().challenge
      if (challenge)
        void navigate(challengePath(challenge.id), { replace: true })
    } catch {
      /* The controller retains the exact request and displays its state. */
    }
  }
  return (
    <main className="challenge-page">
      <Link className="challenge-back" to="/challenges">
        ← Game challenges
      </Link>
      <h1>{challengeNames[mode]} briefing</h1>
      {chapter && (
        <p>
          Chapter {chapter.order}: <strong>{chapter.title}</strong>
        </p>
      )}
      {mode === 'practice' && (
        <p>
          Use a bounded synthetic market to compare a written decision plan with
          one to three opponents. Learning checks in Chapters 1–4 are required.
        </p>
      )}
      {mode === 'daily' && (
        <>
          <p>
            One shared synthetic scenario against one opponent for the current
            UTC day. Retries use the same saved daily form.
          </p>
          <p>
            Only the first victory each UTC day can grant 200 weekly Stocks
            currency. Loss or abandonment starts a two-hour retry cooldown.
            Stocks are game currency, separate from tradable shares and
            simulated funds.
          </p>
        </>
      )}
      {mode === 'chapter_entry' && (
        <>
          <p>
            {chapter?.beginner_recommendation ??
              'New to trading? Learn the chapters in order before trying an early boss fight.'}
          </p>
          <p>
            A unique profit victory opens this chapter early. Earlier module
            checks remain incomplete; this chapter’s introductory assessment and
            required level order still apply.
          </p>
        </>
      )}
      {mode === 'chapter_exit' && (
        <p>
          Complete the chapter’s required learning first. Its boss compares
          planned decisions in a shared market; winning opens the next chapter
          where one exists. The separate chapter learning check records learning
          progress.
        </p>
      )}
      <section className="challenge-section">
        <h2>Before you start</h2>
        <ul>
          <li>
            All funds and assets are fictional. This is a long-only, unleveraged
            foundation simulator.
          </li>
          <li>
            Every order needs a prior written plan. Observing without an order
            is valid.
          </li>
          <li>
            There is no wall-clock deadline. Saved attempts resume their market,
            holdings and orders.
          </li>
          <li>
            Everyone starts with 10,000 simulated funds and reaches the same
            final observation.
          </li>
          <li>
            Net portfolio profit ranks the final leaderboard. Paid fees count;
            remaining holdings use the final midpoint. Ties are not victories
            against AI.
          </li>
          <li>
            Game rewards and boss access are separate from learning evidence.
            Individual orders and trading volume earn no rewards.
          </li>
        </ul>
        <p>
          Your scenario’s pinned objective, difficulty and observed execution
          rules appear after you start.
        </p>
      </section>
      {read.status === 'loading' && (
        <p role="status">
          Checking current eligibility and daily availability…
        </p>
      )}
      {read.status === 'error' && (
        <div className="challenge-notice" role="alert">
          <p>{challengeError(read.error)}</p>
          <button onClick={() => window.location.reload()}>
            Reload availability
          </button>
        </div>
      )}
      {read.status === 'ready' && (
        <>
          {reason && (
            <div className="challenge-notice">
              <h2>Before this attempt</h2>
              <p>{reason}</p>
              <p>
                <Link to={mode === 'daily' ? '/player' : '/adventure'}>
                  {mode === 'daily'
                    ? 'View daily availability and player rewards'
                    : 'Return to your learning chapters'}
                </Link>
              </p>
            </div>
          )}
          {read.data.attempts
            .filter(
              (attempt) =>
                attempt.status === 'active' &&
                attempt.mode === mode &&
                (mode === 'practice' ||
                  mode === 'daily' ||
                  attempt.module_id === moduleId),
            )
            .map((attempt) => (
              <p key={attempt.id}>
                <Link
                  className="challenge-button"
                  to={challengePath(attempt.id)}
                >
                  Resume: {challengeNames[attempt.mode]}
                </Link>
              </p>
            ))}
          {mode === 'practice' && (
            <div className="challenge-field">
              <label htmlFor="practice-opponents">AI opponents</label>
              <select
                id="practice-opponents"
                value={opponents}
                disabled={busy || state.pending || savedActive || !!reason}
                onChange={(event) => setOpponents(Number(event.target.value))}
              >
                {[1, 2, 3].map((count) => (
                  <option key={count} value={count}>
                    {count} {count === 1 ? 'opponent' : 'opponents'}
                  </option>
                ))}
              </select>
            </div>
          )}
          {savedActive && (
            <div className="challenge-notice">
              <p>
                Your most recently opened challenge is still active. Resume it
                or review abandonment before starting a new attempt from this
                browser.
              </p>
              <Link className="challenge-button" to={challengePath(saved.id)}>
                Resume saved attempt
              </Link>
            </div>
          )}
          {!!state.error && (
            <div className="challenge-notice" role="alert">
              <p>{challengeError(state.error)}</p>
              <button
                disabled={busy}
                onClick={() => {
                  void controller.recover().catch(() => {})
                }}
              >
                {state.pending
                  ? 'Confirm saved start or action'
                  : 'Reload saved attempt'}
              </button>
            </div>
          )}
          {busy && (
            <p role="status">
              {state.phase === 'submitting'
                ? 'Confirming your saved start…'
                : 'Checking your saved attempt…'}
            </p>
          )}
          <div className="challenge-actions">
            <button
              disabled={
                !!reason ||
                busy ||
                state.pending ||
                savedActive ||
                state.phase === 'error' ||
                state.phase === 'recovery'
              }
              onClick={() => void start()}
            >
              Start this challenge
            </button>
            <button disabled={busy} onClick={() => window.location.reload()}>
              Reload availability
            </button>
          </div>
          <p>
            Starting saves a new attempt only after this explicit action. A
            retry of an uncertain start recovers its original receipt.
          </p>
        </>
      )}
    </main>
  )
}

export default function ChallengeStartPage() {
  const { mode = '' } = useParams()
  const [search] = useSearchParams()
  const user = useLoaderData<UserProfile>()
  const moduleId = search.get('chapter')
  if (!challengeMode(mode))
    return (
      <main className="challenge-page">
        <h1>Challenge not found</h1>
        <Link to="/challenges">Choose a challenge</Link>
      </main>
    )
  return (
    <StartChallenge
      key={`${user.id}:${mode}:${moduleId ?? ''}`}
      owner={user.id}
      mode={mode}
      moduleId={moduleId}
    />
  )
}
