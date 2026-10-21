import { usePlayer } from '../../../app/PlayerContext.ts'
import type { LeaderboardEntry } from '../../../services/gameService.ts'
import Avatar from '../../../ui/Avatar.tsx'
import { playerAvatarImage } from '../../../ui/avatarImage.ts'
import { Delta } from '../../../ui/Chip.tsx'
import { ordinal } from '../arenaLogic.ts'
import Panel from './Panel.tsx'
import styles from './panels.module.css'

export function Standings({
  entries,
  podium,
}: {
  entries: LeaderboardEntry[]
  podium?: boolean
}) {
  const { player } = usePlayer()
  const ordered = [...entries].sort((a, b) => a.rank - b.rank)
  return (
    <ol
      className={[styles.rivals, podium && styles.podium]
        .filter(Boolean)
        .join(' ')}
    >
      {ordered.map((entry) => (
        <li
          key={entry.participant_id}
          className={entry.is_me ? styles.rivalMe : undefined}
          data-rank={entry.rank}
        >
          <span
            className={`num ${styles.rank}`}
            aria-label={`${ordinal(entry.rank)} place`}
          >
            {entry.rank}
          </span>
          {entry.is_me && player ? (
            <Avatar
              id={player.avatar_id}
              image={playerAvatarImage(player)}
              size={podium ? 40 : 32}
            />
          ) : (
            <Avatar id={entry.avatar || entry.name} size={podium ? 40 : 32} />
          )}
          <span className={styles.rivalName}>
            <strong>
              {entry.name}
              {entry.is_me && <span className={styles.youTag}>You</span>}
            </strong>
            {entry.style && <small>{entry.style}</small>}
          </span>
          <Delta value={entry.profit} />
        </li>
      ))}
    </ol>
  )
}

export default function RivalsPanel({
  entries,
  bare,
}: {
  entries: LeaderboardEntry[]
  bare?: boolean
}) {
  return (
    <Panel
      title="Rivals"
      bare={bare}
      aside={<span className={styles.panelNote}>Ranked by total profit</span>}
    >
      <Standings entries={entries} />
    </Panel>
  )
}
