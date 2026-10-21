import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import useAuth from '../../hooks/useAuth.ts'
import {
  getLobby,
  leaveLobby,
  startLobby,
  type Lobby,
} from '../../services/lobbyService.ts'
import Avatar from '../../ui/Avatar.tsx'
import { itemImage } from '../../ui/avatarImage.ts'
import Button, { ButtonLink } from '../../ui/Button.tsx'
import Chip from '../../ui/Chip.tsx'
import CopyButton from '../../ui/CopyButton.tsx'
import Emblem from '../../ui/Emblem.tsx'
import Icon from '../../ui/Icon.tsx'
import PageHeader from '../../ui/PageHeader.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import { EmptyState, InlineError } from '../../ui/States.tsx'
import { usePolling } from '../../ui/hooks.ts'
import { useToast } from '../../ui/toastContext.ts'
import useResource, { errorText } from '../../ui/useResource.ts'
import { rememberLobby } from './lobbyMemory.ts'
import styles from './Lobby.module.css'

function LobbyRoom({
  lobby,
  onUpdate,
}: {
  lobby: Lobby
  onUpdate: (lobby: Lobby) => void
}) {
  const navigate = useNavigate()
  const notify = useToast()
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const humans = lobby.members.length
  const canStart = lobby.is_host && humans >= 2

  async function start() {
    setBusy(true)
    try {
      onUpdate(await startLobby(lobby.id))
    } catch (error) {
      notify(errorText(error), 'error')
      setBusy(false)
    }
  }

  async function leave() {
    setBusy(true)
    try {
      await leaveLobby(lobby.id)
      rememberLobby(null)
      void navigate('/multiplayer')
    } catch (error) {
      notify(errorText(error), 'error')
      setBusy(false)
    }
  }

  return (
    <div className={styles.layout}>
      <section className={styles.codeCard} aria-labelledby="code-label">
        <p id="code-label" className={styles.codeLabel}>
          Join code
        </p>
        <p className={styles.code}>{lobby.code}</p>
        <CopyButton text={lobby.code} />
        <p className={styles.muted}>
          Share this code with your friends or class.
        </p>
      </section>

      <section className={styles.scenario} aria-labelledby="scenario-title">
        <Emblem name="candles" size={56} tone="green" />
        <div>
          <p className={styles.eyebrow}>Market</p>
          <h2 id="scenario-title" className={styles.scenarioTitle}>
            {lobby.scenario.title}
          </h2>
          <p className={styles.muted}>{lobby.scenario.ticks} market days</p>
        </div>
      </section>

      <section className={styles.members} aria-labelledby="members-title">
        <div className={styles.membersHead}>
          <h2 id="members-title" className={styles.sectionTitle}>
            Players
          </h2>
          <span className={`num ${styles.muted}`}>
            {humans} / {lobby.max_members}
          </span>
        </div>
        <ul className={styles.list}>
          {lobby.members.map((member) => (
            <li key={member.user_id} className={styles.member}>
              <Avatar
                id={member.avatar_id}
                image={itemImage(member)}
                size={44}
              />
              <span className={styles.memberName}>
                {member.name}
                {member.user_id === user?.id && (
                  <span className={styles.you}> (you)</span>
                )}
              </span>
              {member.is_host && (
                <Chip tone="gold" icon="crown">
                  Host
                </Chip>
              )}
            </li>
          ))}
          {Array.from({ length: lobby.bots }, (_, index) => (
            <li key={`bot-${index}`} className={styles.member}>
              <span className={styles.botIcon}>
                <Icon name="bot" size={22} />
              </span>
              <span className={styles.memberName}>AI rival {index + 1}</span>
              <Chip>AI</Chip>
            </li>
          ))}
        </ul>
      </section>

      <div className={styles.actions}>
        {lobby.is_host ? (
          <>
            <Button
              size="lg"
              icon="play"
              block
              disabled={!canStart || busy}
              onClick={() => void start()}
            >
              Start match
            </Button>
            {!canStart && (
              <p className={styles.muted} role="status">
                Waiting for at least one more player to join.
              </p>
            )}
          </>
        ) : (
          <p className={styles.waiting} role="status">
            <span className={styles.pulse} aria-hidden="true" />
            Waiting for the host to start…
          </p>
        )}
        <Button
          variant="ghost"
          icon="logout"
          disabled={busy}
          onClick={() => void leave()}
        >
          Leave lobby
        </Button>
      </div>
      <p className={styles.note}>
        <Icon name="info" size={16} />
        Private matches earn no XP or rating.
      </p>
    </div>
  )
}

export default function LobbyPage() {
  const { lobbyId = '' } = useParams()
  const navigate = useNavigate()
  const resource = useResource((signal) => getLobby(lobbyId, signal), [lobbyId])
  const [latest, setLatest] = useState<Lobby | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  const lobby = latest?.id === lobbyId ? latest : (resource.data ?? null)
  const open = lobby?.status === 'open'

  usePolling(
    async () => {
      try {
        setLatest(await getLobby(lobbyId))
        setPollError(null)
      } catch (error) {
        setPollError(errorText(error))
      }
    },
    2000,
    open,
  )

  useEffect(() => {
    if (lobby?.status === 'open') rememberLobby(lobby.id)
    else if (lobby) rememberLobby(null)
  }, [lobby])

  useEffect(() => {
    if (lobby?.game_id)
      void navigate(`/game/${encodeURIComponent(lobby.game_id)}`, {
        replace: true,
      })
  }, [lobby?.game_id, navigate])

  return (
    <div>
      <PageHeader
        back={{ to: '/multiplayer', label: 'Multiplayer' }}
        title="Private lobby"
      />
      {pollError && open && (
        <InlineError message={`Reconnecting to the lobby… ${pollError}`} />
      )}
      <ResourceView resource={resource} label="Opening the lobby…">
        {() =>
          lobby && lobby.status === 'closed' ? (
            <EmptyState
              icon="users"
              title="This lobby has closed"
              action={
                <ButtonLink to="/multiplayer" icon="plus">
                  Make a new lobby
                </ButtonLink>
              }
            />
          ) : lobby ? (
            <LobbyRoom lobby={lobby} onUpdate={setLatest} />
          ) : null
        }
      </ResourceView>
    </div>
  )
}
