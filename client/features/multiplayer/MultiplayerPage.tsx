import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth.ts'
import {
  createLobby,
  getLobby,
  getLobbyScenarios,
  getMatchmaking,
  joinLobby,
  joinMatchmaking,
  leaveMatchmaking,
  normalizeCode,
  type Match,
} from '../../services/lobbyService.ts'
import Button, { ButtonLink } from '../../ui/Button.tsx'
import Emblem from '../../ui/Emblem.tsx'
import Icon from '../../ui/Icon.tsx'
import PageHeader from '../../ui/PageHeader.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import TierBadge, { TierCrest } from '../../ui/TierBadge.tsx'
import { formatElapsed } from '../../ui/format.ts'
import { useNow, usePolling } from '../../ui/hooks.ts'
import { useToast } from '../../ui/toastContext.ts'
import useResource, { errorText } from '../../ui/useResource.ts'
import { rememberedLobby } from './lobbyMemory.ts'
import styles from './Multiplayer.module.css'

const BOT_CHOICES = [0, 1, 2, 3]

function PrivateLobby() {
  const navigate = useNavigate()
  const notify = useToast()
  const scenarios = useResource(getLobbyScenarios)
  const [scenarioId, setScenarioId] = useState('')
  const [bots, setBots] = useState(0)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'create' | 'join' | null>(null)

  async function create() {
    setBusy('create')
    try {
      const lobby = await createLobby({
        scenario_id: scenarioId || undefined,
        bots,
      })
      void navigate(`/multiplayer/lobby/${encodeURIComponent(lobby.id)}`)
    } catch (error) {
      notify(errorText(error), 'error')
      setBusy(null)
    }
  }

  async function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (code.length !== 6) return
    setBusy('join')
    try {
      const lobby = await joinLobby(code)
      void navigate(`/multiplayer/lobby/${encodeURIComponent(lobby.id)}`)
    } catch (error) {
      notify(errorText(error), 'error')
      setBusy(null)
    }
  }

  return (
    <section className={styles.option} aria-labelledby="private-title">
      <div className={styles.optionHead}>
        <Emblem name="users" size={64} tone="info" />
        <div>
          <h2 id="private-title" className={styles.optionTitle}>
            Private lobby
          </h2>
          <p className={styles.muted}>
            Play with friends or your class. Share a code to join.
          </p>
        </div>
      </div>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>Create a lobby</h3>
        <label className={styles.field}>
          <span>Market</span>
          <select
            value={scenarioId}
            onChange={(event) => setScenarioId(event.target.value)}
          >
            <option value="">Surprise me</option>
            {(scenarios.data?.scenarios ?? []).map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.title} · {scenario.ticks} days
              </option>
            ))}
          </select>
        </label>
        {scenarios.status === 'error' && (
          <p className={styles.muted}>
            Couldn’t load the market list.{' '}
            <button
              type="button"
              className={styles.inlineLink}
              onClick={scenarios.reload}
            >
              Try again
            </button>
          </p>
        )}
        <fieldset className={styles.segmentField}>
          <legend>AI rivals</legend>
          <div className={styles.segment}>
            {BOT_CHOICES.map((count) => (
              <label key={count} className={styles.segmentItem}>
                <input
                  type="radio"
                  name="bots"
                  value={count}
                  checked={bots === count}
                  onChange={() => setBots(count)}
                />
                <span>{count === 0 ? 'None' : count}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Button
          icon="plus"
          block
          disabled={!!busy}
          onClick={() => void create()}
        >
          {busy === 'create' ? 'Creating…' : 'Create lobby'}
        </Button>
      </div>

      <div className={styles.or}>
        <span>or</span>
      </div>

      <form className={styles.block} onSubmit={(event) => void join(event)}>
        <h3 className={styles.blockTitle}>Join with a code</h3>
        <label className={styles.codeField}>
          <span className="visually-hidden">Six-character join code</span>
          <input
            className={styles.codeInput}
            value={code}
            onChange={(event) => setCode(normalizeCode(event.target.value))}
            placeholder="ABC123"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            maxLength={6}
          />
        </label>
        <Button
          type="submit"
          variant="secondary"
          block
          disabled={code.length !== 6 || !!busy}
        >
          {busy === 'join' ? 'Joining…' : 'Join lobby'}
        </Button>
      </form>
      <p className={styles.note}>
        <Icon name="info" size={16} />
        Private matches earn no XP or rating.
      </p>
    </section>
  )
}

function Ranked() {
  const navigate = useNavigate()
  const notify = useToast()
  const resource = useResource(getMatchmaking)
  const [match, setMatch] = useState<Match | null>(null)
  const [busy, setBusy] = useState(false)
  const [pollError, setPollError] = useState(false)
  // Bumped by every join or cancel so a poll that was already in flight
  // cannot put a cancelled search back on screen.
  const generation = useRef(0)
  const current = match ?? resource.data ?? null
  const searching = current?.status === 'searching'
  const now = useNow(1000, searching)

  /** Open a match found during this visit; replace keeps Back off this page. */
  function follow(next: Match) {
    if (next.status === 'matched' && next.game_id)
      void navigate(`/game/${encodeURIComponent(next.game_id)}`, {
        replace: true,
      })
  }

  usePolling(
    async () => {
      const ticket = generation.current
      try {
        const next = await getMatchmaking()
        if (ticket !== generation.current) return
        setPollError(false)
        setMatch(next)
        follow(next)
      } catch {
        if (ticket === generation.current) setPollError(true)
      }
    },
    2000,
    searching,
  )

  async function find() {
    generation.current += 1
    setBusy(true)
    try {
      const next = await joinMatchmaking()
      setMatch(next)
      follow(next)
    } catch (error) {
      notify(errorText(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    generation.current += 1
    setBusy(true)
    try {
      await leaveMatchmaking()
      if (current) setMatch({ ...current, status: 'idle', waiting_since: null })
      setPollError(false)
    } catch (error) {
      notify(errorText(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className={`${styles.option} ${styles.ranked}`}
      aria-labelledby="ranked-title"
    >
      <div className={styles.optionHead}>
        <Emblem name="trophy" size={64} tone="gem" />
        <div>
          <h2 id="ranked-title" className={styles.optionTitle}>
            Ranked match
          </h2>
          <p className={styles.muted}>
            One rival, one market. Most profit wins rating and Gems.
          </p>
        </div>
      </div>
      <ResourceView resource={resource} label="Checking the queue…">
        {() =>
          current && (
            <>
              <div className={styles.rating}>
                <TierCrest tier={current.tier} size={88} />
                <div>
                  <p className={styles.ratingLabel}>Your rating</p>
                  <p className={`num ${styles.ratingValue}`}>
                    {current.rating}
                  </p>
                  <TierBadge tier={current.tier} />
                </div>
              </div>
              {current.locked_reason ? (
                <div className={styles.locked}>
                  <Icon name="lock" size={18} />
                  <span>{current.locked_reason}</span>
                </div>
              ) : searching ? (
                <div className={styles.searching} role="status">
                  <span className={styles.radar} aria-hidden="true" />
                  <div>
                    <p className={styles.searchTitle}>Looking for a rival…</p>
                    <p className={styles.muted}>
                      Waiting{' '}
                      <span className="num">
                        {formatElapsed(
                          current.waiting_since
                            ? now - new Date(current.waiting_since).getTime()
                            : 0,
                        )}
                      </span>
                    </p>
                    {pollError && (
                      <p className={styles.muted}>
                        Reconnecting to the queue…
                      </p>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void cancel()}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className={styles.rankedActions}>
                  {current.status === 'matched' && current.game_id && (
                    <ButtonLink
                      to={`/game/${encodeURIComponent(current.game_id)}`}
                      size="lg"
                      icon="play"
                      block
                    >
                      Resume match
                    </ButtonLink>
                  )}
                  <Button
                    size="lg"
                    icon="swords"
                    block
                    variant={
                      current.status === 'matched' ? 'secondary' : 'primary'
                    }
                    disabled={busy}
                    onClick={() => void find()}
                  >
                    {current.status === 'matched'
                      ? 'Find a new match'
                      : 'Find match'}
                  </Button>
                </div>
              )}
            </>
          )
        }
      </ResourceView>
    </section>
  )
}

/** "Return to your lobby" while this player is still in an open lobby. */
function LobbyReturn() {
  const { user } = useAuth()
  const lobbyId = rememberedLobby()
  const lobby = useResource(
    (signal) =>
      lobbyId ? getLobby(lobbyId, signal) : Promise.resolve(null),
    [lobbyId],
  )
  const data = lobby.data
  if (!lobbyId || lobby.status === 'error') return null
  if (!data) return null
  const member = data.members.some((item) => item.user_id === user?.id)
  if (data.status !== 'open' || !member) return null
  return (
    <div className={styles.returnBanner} role="status">
      <Icon name="users" size={20} />
      <span>
        You’re still in lobby <span className="num">{data.code}</span>.
      </span>
      <ButtonLink
        to={`/multiplayer/lobby/${encodeURIComponent(data.id)}`}
        variant="secondary"
        iconRight="chevron-right"
      >
        Return to your lobby
      </ButtonLink>
    </div>
  )
}

export default function MultiplayerPage() {
  return (
    <div>
      <PageHeader
        back={{ to: '/play', label: 'Play' }}
        title="Multiplayer"
        subtitle="Trade the same market as real players. Highest profit wins."
      />
      <LobbyReturn />
      <div className={styles.grid}>
        <PrivateLobby />
        <Ranked />
      </div>
    </div>
  )
}
