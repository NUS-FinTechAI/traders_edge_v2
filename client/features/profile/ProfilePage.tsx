import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../../app/PlayerContext.ts'
import RequirePlayer from '../../app/RequirePlayer.tsx'
import useAuth from '../../hooks/useAuth.ts'
import {
  getActivity,
  getCollection,
  updateMe,
  type Collection as CollectionData,
  type Player,
} from '../../services/playerService.ts'
import Avatar from '../../ui/Avatar.tsx'
import { playerAvatarImage } from '../../ui/avatarImage.ts'
import Button from '../../ui/Button.tsx'
import Chip from '../../ui/Chip.tsx'
import Icon from '../../ui/Icon.tsx'
import ProgressBar from '../../ui/ProgressBar.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import { formatCount } from '../../ui/format.ts'
import { useToast } from '../../ui/toastContext.ts'
import useResource, { errorText } from '../../ui/useResource.ts'
import ActivityHeatmap from './ActivityHeatmap.tsx'
import Collection from './Collection.tsx'
import { EarnButton } from './EarnGuide.tsx'
import styles from './Profile.module.css'

function LevelRing({ player }: { player: Player }) {
  const pct = player.xp_into_level / Math.max(1, player.xp_for_next_level)
  const radius = 58
  const length = 2 * Math.PI * radius
  return (
    <div className={styles.ringWrap}>
      <svg className={styles.ring} viewBox="0 0 128 128" aria-hidden="true">
        <circle cx="64" cy="64" r={radius} className={styles.ringTrack} />
        <circle
          cx="64"
          cy="64"
          r={radius}
          className={styles.ringFill}
          strokeDasharray={`${length * pct} ${length}`}
          transform="rotate(-90 64 64)"
        />
      </svg>
      <span className={styles.ringAvatar}>
        <Avatar
          id={player.avatar_id}
          image={playerAvatarImage(player)}
          size={96}
        />
      </span>
      <span className={styles.ringLevel}>Lv {player.level}</span>
    </div>
  )
}

function NameEditor({ player }: { player: Player }) {
  const { refreshPlayer } = usePlayer()
  const notify = useToast()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(player.display_name)
  const [busy, setBusy] = useState(false)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed === player.display_name) {
      setEditing(false)
      return
    }
    setBusy(true)
    try {
      await updateMe({ display_name: trimmed })
      await refreshPlayer()
      notify('Name saved', 'success')
      setEditing(false)
    } catch (error) {
      notify(errorText(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!editing)
    return (
      <div className={styles.nameRow}>
        <h1 className={styles.name}>{player.display_name}</h1>
        <Button
          variant="ghost"
          icon="edit"
          aria-label="Edit name"
          onClick={() => {
            setName(player.display_name)
            setEditing(true)
          }}
        />
      </div>
    )
  return (
    <form className={styles.nameForm} onSubmit={(event) => void save(event)}>
      <label className="visually-hidden" htmlFor="display-name">
        Display name
      </label>
      <input
        id="display-name"
        className={styles.nameInput}
        value={name}
        maxLength={32}
        autoFocus
        disabled={busy}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setEditing(false)
        }}
      />
      <Button type="submit" disabled={busy}>
        Save
      </Button>
      <Button variant="ghost" disabled={busy} onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </form>
  )
}

function Stats({ stats }: { stats: CollectionData['stats'] }) {
  const items = [
    ['Levels', stats.levels_done],
    ['Stars', stats.stars],
    ['Bosses', stats.bosses_won],
    ['Quizzes', stats.quizzes_passed],
    ['Matches', stats.matches_played],
  ] as const
  return (
    <dl className={styles.stats}>
      {items.map(([label, value]) => (
        <div key={label} className={styles.stat}>
          <dt>{label}</dt>
          <dd className="num">{formatCount(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

function Settings({ player }: { player: Player }) {
  const { refreshPlayer } = usePlayer()
  const { logout, signingOut } = useAuth()
  const navigate = useNavigate()
  const notify = useToast()
  const [busy, setBusy] = useState(false)

  async function toggle() {
    setBusy(true)
    try {
      await updateMe({ leaderboard_opt_in: !player.leaderboard_opt_in })
      await refreshPlayer()
    } catch (error) {
      notify(errorText(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    try {
      await logout()
      void navigate('/')
    } catch (error) {
      notify(errorText(error), 'error')
    }
  }

  return (
    <section
      id="settings"
      className={styles.panel}
      aria-labelledby="settings-title"
    >
      <h2 id="settings-title" className={styles.panelTitle}>
        Settings
      </h2>
      <div className={styles.setting}>
        <span className={styles.settingText}>
          <strong id="optin-label">Show me on leaderboards</strong>
          <span className={styles.muted}>
            Other players see your name, avatar and level.
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={player.leaderboard_opt_in}
          aria-labelledby="optin-label"
          className={styles.switch}
          disabled={busy}
          onClick={() => void toggle()}
        >
          <span className={styles.switchKnob} />
          <span className={styles.switchText}>
            {player.leaderboard_opt_in ? 'On' : 'Off'}
          </span>
        </button>
      </div>
      <div className={styles.links}>
        <Button
          variant="danger"
          icon="logout"
          disabled={signingOut}
          onClick={() => void signOut()}
        >
          Sign out
        </Button>
      </div>
    </section>
  )
}

export default function ProfilePage() {
  return (
    <RequirePlayer label="Loading your profile…">
      {(player) => <Profile player={player} />}
    </RequirePlayer>
  )
}

function Profile({ player }: { player: Player }) {
  const collection = useResource(getCollection)
  const activity = useResource(getActivity)
  const pct = Math.round(
    (player.xp_into_level / Math.max(1, player.xp_for_next_level)) * 100,
  )

  return (
    <div className={styles.page}>
      <section className={styles.header} aria-label="Player">
        <LevelRing player={player} />
        <div className={styles.headerText}>
          <NameEditor player={player} />
          <p className={styles.rank}>
            {player.rank_name} · Level {player.level}
          </p>
          {player.title && player.title !== player.rank_name && (
            <Chip tone="gem" icon="scroll">
              {player.title}
            </Chip>
          )}
          <div className={styles.xp}>
            <ProgressBar
              value={player.xp_into_level}
              max={player.xp_for_next_level}
              label={`Progress to level ${player.level + 1}`}
              valueText={`${player.xp_into_level} of ${player.xp_for_next_level} XP`}
            />
            <span className={styles.xpRow}>
              <span className={`num ${styles.muted}`}>
                {formatCount(player.xp_into_level)} /{' '}
                {formatCount(player.xp_for_next_level)} XP · {pct}%
              </span>
              <EarnButton
                topic="xp"
                label={`${formatCount(player.xp)} XP in total`}
              >
                <Chip tone="info" icon="info">
                  How to earn XP
                </Chip>
              </EarnButton>
            </span>
          </div>
        </div>
        <div className={styles.wallet}>
          <EarnButton topic="streak" label={`${player.streak.days}-day streak`}>
            <Chip tone="flame" icon="flame">
              {player.streak.days}-day streak
            </Chip>
          </EarnButton>
          <EarnButton
            topic="doubloons"
            label={`${formatCount(player.wallet.doubloons)} Doubloons`}
          >
            <Chip tone="gold" icon="coin">
              {formatCount(player.wallet.doubloons)} Doubloons
            </Chip>
          </EarnButton>
          <EarnButton
            topic="gems"
            label={`${formatCount(player.wallet.gems)} Gems`}
          >
            <Chip tone="gem" icon="gem">
              {formatCount(player.wallet.gems)} Gems
            </Chip>
          </EarnButton>
        </div>
      </section>

      <ResourceView resource={collection} label="Loading your collection…">
        {(data) => (
          <>
            <Stats stats={data.stats} />
            <ResourceView resource={activity} label="Loading activity…">
              {(days) => <ActivityHeatmap activity={days} />}
            </ResourceView>
            <Collection data={data} onChange={collection.reload} />
          </>
        )}
      </ResourceView>
      <Settings player={player} />
      <p className={styles.footnote}>
        <Icon name="info" size={14} /> Simulated money · fictional companies
      </p>
    </div>
  )
}
