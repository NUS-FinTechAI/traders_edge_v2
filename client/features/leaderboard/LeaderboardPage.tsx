import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlayer } from '../../app/PlayerContext.ts'
import {
  getLeaderboard,
  type Leaderboard,
} from '../../services/playerService.ts'
import Avatar from '../../ui/Avatar.tsx'
import { itemImage } from '../../ui/avatarImage.ts'
import Chip from '../../ui/Chip.tsx'
import Emblem from '../../ui/Emblem.tsx'
import Icon from '../../ui/Icon.tsx'
import PageHeader from '../../ui/PageHeader.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import { EmptyState } from '../../ui/States.tsx'
import Tabs from '../../ui/Tabs.tsx'
import TierBadge, { TierCrest } from '../../ui/TierBadge.tsx'
import { formatCount } from '../../ui/format.ts'
import useResource from '../../ui/useResource.ts'
import styles from './Leaderboard.module.css'

type Board = 'ranked' | 'xp'

const TABS = [
  { id: 'xp', label: 'XP' },
  { id: 'ranked', label: 'Ranked' },
] as const

const MEDALS = ['gold', 'neutral', 'loss'] as const
const PLACES = ['1st', '2nd', '3rd']

function Value({ board, value }: { board: Board; value: number }) {
  return (
    <span className={`num ${styles.value}`}>
      {formatCount(value)}
      <span className={styles.unit}>{board === 'xp' ? ' XP' : ''}</span>
    </span>
  )
}

function Standings({ board, data }: { board: Board; data: Leaderboard }) {
  const { player } = usePlayer()
  const myTier = data.entries.find((entry) => entry.is_me)?.tier
  return (
    <div className={styles.layout}>
      <section className={styles.me} aria-labelledby="me-title">
        <h2 id="me-title" className={styles.meTitle}>
          Your rank
        </h2>
        {board === 'ranked' && myTier ? (
          <TierCrest tier={myTier} size={96} />
        ) : (
          <Emblem name="podium" size={96} tone="gold" shape="circle" />
        )}
        <p
          className={data.me.rank ? `num ${styles.meRank}` : styles.meRankEmpty}
        >
          {data.me.rank ? `#${formatCount(data.me.rank)}` : 'Unranked'}
        </p>
        <p className={styles.meValue}>
          <Value board={board} value={data.me.value} />
          {board === 'ranked' && <span className={styles.unit}> rating</span>}
        </p>
        {board === 'ranked' && myTier && <TierBadge tier={myTier} />}
        {board === 'xp' && player && (
          <p className={styles.muted}>
            {player.rank_name} · Level {player.level}
          </p>
        )}
        {player && !player.leaderboard_opt_in && (
          <p className={styles.optIn}>
            <Icon name="eye" size={16} />
            <span>
              You’re hidden from public boards.{' '}
              <Link to="/profile#settings">Show me in Profile</Link>
            </span>
          </p>
        )}
      </section>

      <section className={styles.list} aria-labelledby="list-title">
        <h2 id="list-title" className={styles.listTitle}>
          {board === 'ranked' ? 'Top traders by rating' : 'Top learners by XP'}
        </h2>
        {data.entries.length ? (
          <ol className={styles.rows}>
            {data.entries.map((entry, index) => (
              <li
                key={`${entry.rank}-${entry.name}-${index}`}
                className={[styles.row, entry.is_me && styles.rowMe]
                  .filter(Boolean)
                  .join(' ')}
              >
                {entry.rank <= 3 ? (
                  <span className={styles.medal}>
                    <Emblem
                      name="medal"
                      size={36}
                      shape="none"
                      tone={MEDALS[entry.rank - 1]}
                      label={PLACES[entry.rank - 1]}
                    />
                  </span>
                ) : (
                  <span className={`num ${styles.rank}`}>{entry.rank}</span>
                )}
                <Avatar
                  id={entry.avatar_id}
                  image={itemImage(entry)}
                  size={40}
                />
                <span className={styles.who}>
                  <span className={styles.name}>
                    {entry.name}
                    {entry.is_me && (
                      <Chip tone="gold" className={styles.youChip}>
                        You
                      </Chip>
                    )}
                  </span>
                  <span className={styles.muted}>Level {entry.level}</span>
                </span>
                {board === 'ranked' && entry.tier && (
                  <span className={styles.tier}>
                    <TierBadge tier={entry.tier} />
                  </span>
                )}
                <Value board={board} value={entry.value} />
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState icon="podium" title="No one on the board yet">
            {board === 'ranked'
              ? 'Play a ranked match to claim the first spot.'
              : 'Finish lessons to earn XP and climb.'}
          </EmptyState>
        )}
      </section>
    </div>
  )
}

export default function LeaderboardPage() {
  const [board, setBoard] = useState<Board>('xp')
  const resource = useResource(
    (signal) => getLeaderboard(board, signal),
    [board],
  )
  return (
    <div>
      <PageHeader
        title="Leaderboard"
        subtitle="Climb the ranks. Ranked rating comes from matches; XP comes from learning."
      />
      <div className={styles.tabs}>
        <Tabs
          label="Leaderboard"
          tabs={TABS}
          value={board}
          onChange={setBoard}
          idPrefix="board"
        />
      </div>
      <div
        role="tabpanel"
        id={`board-panel-${board}`}
        aria-labelledby={`board-tab-${board}`}
      >
        <ResourceView resource={resource} label="Loading the board…">
          {(data) => <Standings board={board} data={data} />}
        </ResourceView>
      </div>
    </div>
  )
}
