import { Link } from 'react-router-dom'
import { listGames } from '../../services/gameService.ts'
import Icon from '../../ui/Icon.tsx'
import useResource from '../../ui/useResource.ts'
import { modeLabel } from '../arena/labels.ts'
import styles from './Play.module.css'

/** Unfinished matches with a link back into each; hidden when there are none. */
export default function ResumeMatches() {
  const games = useResource(listGames)
  const list = games.data?.games ?? []
  if (!list.length) return null
  return (
    <section className={styles.resume} aria-labelledby="resume-title">
      <h2 id="resume-title" className={styles.resumeTitle}>
        Resume a match
      </h2>
      <ul className={styles.resumeList}>
        {list.map((game) => (
          <li key={game.id}>
            <Link
              to={`/game/${encodeURIComponent(game.id)}`}
              className={styles.resumeLink}
            >
              <Icon name="play" size={18} />
              <span className={styles.resumeText}>
                <strong>{game.title}</strong>
                <span className={styles.muted}>
                  {modeLabel(game.mode)} ·{' '}
                  {game.status === 'briefing'
                    ? 'Not started'
                    : `Day ${game.tick} of ${game.ticks}`}
                </span>
              </span>
              <Icon name="chevron-right" size={18} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
