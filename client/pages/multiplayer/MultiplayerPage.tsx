import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLoaderData, useNavigate, useParams } from 'react-router-dom'
import TradingWorkspace from '../../components/trading/TradingWorkspace.tsx'
import type { UserProfile } from '../../services/authService.ts'
import { multiplayerError } from '../../services/multiplayerService.ts'
import useMultiplayer from '../../hooks/useMultiplayer.ts'
import useAuth from '../../hooks/useAuth.ts'
import './Multiplayer.css'

function Match({ owner, lobbyId }: { owner: UserProfile; lobbyId: string }) {
  const { state, controller } = useMultiplayer(owner.id, lobbyId)
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const [pausedPhase, setPausedPhase] = useState<string | null>(null)
  const [showAbandon, setShowAbandon] = useState(false)
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const reflectionHeading = useRef<HTMLHeadingElement>(null)
  const match = state.match
  const matchStatus = match?.status
  const waitingPhase = `${matchStatus}:${match?.player?.tick ?? 'lobby'}`
  const pollingEnded = pausedPhase === waitingPhase
  const own = match?.participants.find(
    (participant) => participant.user_id === owner.id,
  )
  useEffect(() => {
    if (own?.completed) void refreshUser().catch(() => {})
  }, [own?.completed, refreshUser])
  useEffect(() => {
    if (user?.id !== owner.id) return
    if (own?.completed) reflectionHeading.current?.focus()
    else if (matchStatus === 'finished') resultHeading.current?.focus()
  }, [matchStatus, own?.completed, owner.id, user?.id])
  useEffect(() => {
    if (
      !matchStatus ||
      state.pending ||
      (matchStatus !== 'waiting' && !(matchStatus === 'active' && own?.ready))
    )
      return
    let reads = 0
    const timer = window.setInterval(() => {
      if (
        document.hidden ||
        controller.getSnapshot().busy ||
        controller.getSnapshot().pending
      )
        return
      if (++reads > 12) {
        window.clearInterval(timer)
        setPausedPhase(waitingPhase)
        return
      }
      void controller.load(lobbyId).catch(() => {
        window.clearInterval(timer)
        setPausedPhase(waitingPhase)
      })
    }, 5000)
    return () => window.clearInterval(timer)
  }, [
    controller,
    lobbyId,
    matchStatus,
    own?.ready,
    state.pending,
    waitingPhase,
  ])
  if (user?.id !== owner.id)
    return (
      <main className="multiplayer-page">
        <h1>Check your current player</h1>
        <p role="alert">
          This match belongs to the previous signed-in account. Its saved
          actions remain with that player.
        </p>
        <a href="/multiplayer">Open current player’s matches</a>
      </main>
    )
  const disabled = state.busy || state.pending
  const act = (task: Promise<void>) => {
    void task
      .then(async () => {
        const current = controller.getSnapshot().match
        if (current && current.id !== lobbyId)
          await navigate(`/multiplayer/${encodeURIComponent(current.id)}`, {
            replace: true,
          })
      })
      .catch(() => {})
  }
  function reflect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    act(
      controller.complete(
        String(
          new FormData(event.currentTarget).get('reflection') ?? '',
        ).trim(),
      ),
    )
  }
  return (
    <main className="multiplayer-page">
      <Link to="/multiplayer">Multiplayer hub</Link>
      <h1>
        {match?.mode === 'private' ? 'Private match' : 'Public ranked match'}
      </h1>
      <button
        disabled={state.busy}
        onClick={() => act(controller.load(lobbyId))}
      >
        {state.busy ? 'Checking saved match…' : 'Refresh match'}
      </button>
      {state.error !== null && (
        <p role="alert">{multiplayerError(state.error)}</p>
      )}
      {pollingEnded && (
        <p>
          Automatic checks have paused. Refresh the match to see the latest
          saved state.
        </p>
      )}
      {state.pending && (
        <section className="multiplayer-panel">
          <h2>Confirm your saved action</h2>
          <p>
            Your previous action is saved unchanged. Confirm it before another
            decision; refreshing does not resend it.
          </p>
          <button disabled={state.busy} onClick={() => act(controller.retry())}>
            Confirm saved action
          </button>
        </section>
      )}
      {!match ? (
        <p role="status">Loading your saved match…</p>
      ) : (
        <>
          <p>
            <strong>Status:</strong> {match.status}.{' '}
            {match.mode === 'private'
              ? 'Private play grants no XP, currency or rating.'
              : 'Public results affect Elo; game rewards follow a completed reflection.'}
          </p>
          <section className="multiplayer-panel">
            <h2>Players</h2>
            <ul>
              {match.participants.map((participant) => (
                <li key={participant.user_id}>
                  {participant.display_name}
                  {participant.user_id === owner.id ? ' (you)' : ''}
                  {participant.user_id === match.host_id
                    ? ' · host'
                    : ''} ·{' '}
                  {participant.departed
                    ? 'left lobby'
                    : participant.forfeit
                      ? 'forfeited'
                      : participant.completed
                        ? 'reflection complete'
                        : participant.ready
                          ? 'ready for next observation'
                          : match.status === 'active'
                            ? 'making a decision'
                            : match.status === 'finished'
                              ? 'awaiting reflection'
                              : 'joined'}
                </li>
              ))}
            </ul>
          </section>
          {match.status === 'waiting' && !own?.departed && (
            <section className="multiplayer-panel">
              <h2>
                {match.mode === 'private'
                  ? 'Invite players'
                  : 'Waiting for an opponent'}
              </h2>
              {state.joinCode && (
                <p>
                  Join code:{' '}
                  <strong className="multiplayer-code">{state.joinCode}</strong>
                </p>
              )}
              <p>
                {match.mode === 'private'
                  ? 'Share the code outside the app. The host can start after at least two players join.'
                  : 'The shared market begins when another eligible player is paired. You may leave the queue without a time penalty.'}
              </p>
              {match.mode === 'private' && match.host_id === owner.id && (
                <button
                  disabled={
                    disabled ||
                    match.participants.filter(
                      (participant) => !participant.departed,
                    ).length < 2
                  }
                  onClick={() => act(controller.start())}
                >
                  Start private match
                </button>
              )}
            </section>
          )}
          {match.player && (
            <>
              <p role="status">
                Observation {match.player.tick} of{' '}
                {match.player.total_ticks - 1}.{' '}
                {match.status === 'finished'
                  ? 'The market has ended. Review the frozen result and your decisions.'
                  : match.status === 'cancelled'
                    ? 'The market ended without a result.'
                    : own?.ready
                      ? 'Your readiness is saved. Wait for the other players or refresh.'
                      : 'Inspect the current market before making a decision.'}
              </p>
              <p>
                The initial market is observation 0. Each order needs a written
                plan. Choosing to observe without trading is valid. Quotes can
                change, limits may not fill, and stops cannot guarantee a loss
                boundary.
              </p>
              <TradingWorkspace
                observation={match.player}
                busy={disabled || !!own?.ready}
                readOnly={
                  match.status !== 'active' || !!own?.forfeit || !!own?.departed
                }
                onOrder={(order) => act(controller.order(order))}
                onCancel={(orderId) => act(controller.cancel(orderId))}
              />
              {match.status === 'active' && !own?.forfeit && !own?.departed && (
                <section className="multiplayer-panel">
                  <h2>Confirm this observation</h2>
                  <p>
                    Ready pauses your orders until all remaining players
                    confirm. It advances exactly one shared observation; there
                    is no countdown.
                  </p>
                  <button
                    disabled={disabled || own?.ready}
                    onClick={() => act(controller.ready())}
                  >
                    {own?.ready
                      ? 'Ready saved — waiting for players'
                      : 'Ready for next observation'}
                  </button>
                </section>
              )}
            </>
          )}
          {match.result && (
            <section className="multiplayer-panel">
              <h2 ref={resultHeading} tabIndex={-1}>
                Final match result
              </h2>
              <p>
                Frozen at the common final observation. Net profit is cash plus
                remaining holdings after costs, minus the starting portfolio
                value. A profitable result is not proof of learning.
              </p>
              <div
                className="multiplayer-table"
                role="region"
                aria-label="Final match leaderboard; scroll horizontally for all columns"
                tabIndex={0}
              >
                <table>
                  <caption>Net portfolio profit leaderboard</caption>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Player</th>
                      <th>Net profit</th>
                      <th>Result</th>
                      {match.mode === 'public_ranked' && <th>Elo</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {match.result.leaderboard.map((entry) => (
                      <tr key={entry.user_id}>
                        <td>{entry.rank}</td>
                        <th scope="row">
                          {entry.display_name}
                          {entry.user_id === owner.id ? ' (you)' : ''}
                        </th>
                        <td>{entry.profit}</td>
                        <td>
                          {entry.forfeit
                            ? 'Forfeit'
                            : entry.win
                              ? 'Winner'
                              : entry.rank === 1
                                ? 'Tie'
                                : 'Finished'}
                        </td>
                        {match.mode === 'public_ranked' && (
                          <td>
                            {entry.rating_before} → {entry.rating_after} (
                            {(entry.rating_delta ?? 0) >= 0 ? '+' : ''}
                            {entry.rating_delta})
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {match.status === 'finished' &&
            own &&
            !own.completed &&
            !own.forfeit &&
            !own.departed && (
              <section className="multiplayer-panel">
                <h2>Review your decisions</h2>
                <p>
                  Compare your plan with the actions, fees and allocation. This
                  reflection is saved, not automatically graded for reasoning
                  quality.
                </p>
                <form onSubmit={reflect}>
                  <label htmlFor="multiplayer-reflection">
                    What matched your plan, what changed, and what would you
                    reconsider?
                  </label>
                  <textarea
                    id="multiplayer-reflection"
                    name="reflection"
                    required
                    minLength={30}
                    maxLength={1500}
                    rows={5}
                  />
                  <button disabled={disabled}>Save final reflection</button>
                </form>
              </section>
            )}
          {own?.completed && (
            <section className="multiplayer-panel">
              <h2 ref={reflectionHeading} tabIndex={-1}>
                Reflection saved
              </h2>
              {match.awards?.awarded && (
                <p>
                  Game XP: {match.awards.awarded.xp}. Premium currency:{' '}
                  {match.awards.awarded.premium}. These rewards are separate
                  from learning mastery.
                </p>
              )}
              <p>Your match result is unchanged.</p>
            </section>
          )}
          {(own?.forfeit || own?.departed) && (
            <p>
              You have left this match. Your participation can no longer place
              orders or claim completion rewards.
            </p>
          )}
          {match.status === 'cancelled' && (
            <p>This match ended without a rated result.</p>
          )}
          {(match.status === 'waiting' || match.status === 'active') &&
            !own?.forfeit &&
            !own?.departed && (
              <section className="multiplayer-panel">
                <h2>
                  {match.status === 'waiting' ? 'Leave lobby' : 'Abandon match'}
                </h2>
                <p>
                  {match.status === 'waiting'
                    ? match.mode === 'private'
                      ? 'A waiting host leaving closes the private lobby.'
                      : 'Leaving removes your player from this public queue. You can search again later.'
                    : 'Abandoning forfeits your participation and cancels open orders. Disconnection alone keeps the match saved.'}
                </p>
                {showAbandon ? (
                  <>
                    <button
                      disabled={disabled}
                      onClick={() => act(controller.abandon())}
                    >
                      Confirm {match.status === 'waiting' ? 'leave' : 'forfeit'}
                    </button>
                    <button onClick={() => setShowAbandon(false)}>
                      Keep playing
                    </button>
                  </>
                ) : (
                  <button
                    disabled={disabled}
                    onClick={() => setShowAbandon(true)}
                  >
                    {match.status === 'waiting'
                      ? 'Leave lobby'
                      : 'Abandon match'}
                  </button>
                )}
              </section>
            )}
        </>
      )}
    </main>
  )
}

export default function MultiplayerPage() {
  const owner = useLoaderData<UserProfile>()
  const { lobbyId = '' } = useParams()
  return (
    <Match key={`${owner.id}:${lobbyId}`} owner={owner} lobbyId={lobbyId} />
  )
}
