import {
  bossStatus,
  type AdventureChapter,
  type ModuleMap,
} from '../../../services/adventureService.ts'
import { Star } from '../mission-stars/MissionStars.tsx'
import './ChapterMap.css'

export default function ChapterMap({
  map,
  chapter,
  onSelect,
}: {
  map: ModuleMap
  chapter: AdventureChapter
  onSelect: (stop: string) => void
}) {
  const routeStops = [
    ...(map.diagnostic.required
      ? [
          {
            id: 'diagnostic',
            title: 'Introductory assessment',
            marker: 'Start',
            status: map.diagnostic.completed
              ? 'Completed'
              : !map.unlocked
                ? 'Locked'
                : map.diagnostic.run_id
                  ? 'In progress'
                  : 'Available',
            level: null,
          },
        ]
      : []),
    ...map.levels.map((level, index) => ({
      id: level.id,
      title: level.title,
      marker: String(index + 1).padStart(2, '0'),
      status: level.standard_star
        ? 'Completed'
        : level.active_run_id
          ? 'In progress'
          : level.unlocked
            ? 'Available'
            : 'Locked',
      level,
    })),
    {
      id: 'exit',
      title: 'Chapter boss',
      marker: 'Boss',
      status: bossStatus(chapter.exit_boss, chapter.exit_boss_passed),
      level: null,
    },
  ]
  return (
    <section className="adventure-map" aria-label="Chapter adventure map">
      <div className="adventure-map-caption">
        <span>Your learning route</span>
        <span>
          {chapter.completed_required_levels}/{chapter.total_required_levels}{' '}
          levels completed
        </span>
      </div>
      <ChapterRoute
        stops={routeStops.map((stop) => ({
          ...stop,
          starEarned: stop.level?.standard_star,
          bonus: !!(stop.level?.bonus_available || stop.level?.bonus_star),
          bonusEarned: stop.level?.bonus_star,
        }))}
        onSelect={onSelect}
      />
      {map.levels.length === 0 && (
        <p className="adventure-notice">
          No levels have been published in this chapter.
        </p>
      )}
      <div className="adventure-learning-check">
        <div>
          <h2>Chapter learning check</h2>
          <p>
            {map.mastered
              ? 'Module check passed'
              : map.assessment_available
                ? 'Available after your required missions'
                : 'Complete the introductory assessment and required levels first.'}
          </p>
          <p className="adventure-muted">
            Separate from the boss result. Bonus missions are not required.
          </p>
        </div>
        <button
          className="adventure-button adventure-button-secondary"
          onClick={() => onSelect('assessment')}
        >
          View learning check
        </button>
      </div>
    </section>
  )
}

export type ChapterRouteStop = {
  id: string
  title: string
  marker: string
  status: string
  starEarned?: boolean
  bonus?: boolean
  bonusEarned?: boolean
}

export function ChapterRoute({
  stops,
  onSelect,
}: {
  stops: ChapterRouteStop[]
  onSelect: (id: string) => void
}) {
  return (
    <ol className="adventure-route">
      {stops.map((stop, index) => (
        <li
          key={stop.id}
          className={`adventure-map-row${stop.status === 'Completed' || stop.status === 'Defeated' ? ' is-complete' : ''}`}
        >
          {index < stops.length - 1 && (
            <svg
              className="adventure-connector"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M30 0 C30 55 70 45 70 100" />
            </svg>
          )}
          <button
            className="adventure-map-stop"
            onClick={() => onSelect(stop.id)}
            aria-label={`${stop.marker === 'Start' || stop.marker === 'Boss' ? '' : `Level ${Number(stop.marker)}: `}${stop.title}. ${stop.status}. View details.`}
          >
            <span className="adventure-node-number">{stop.marker}</span>
            <span className="adventure-node-title">{stop.title}</span>
            <span className="adventure-node-status">{stop.status}</span>
            {stop.starEarned !== undefined && (
              <span className="adventure-node-star">
                <Star earned={stop.starEarned} />
                {stop.starEarned ? 'Normal star earned' : 'Required missions'}
              </span>
            )}
          </button>
          {stop.bonus && (
            <button
              className="adventure-bonus-branch"
              onClick={() => onSelect(stop.id)}
              aria-label={`View optional bonus for ${stop.title}`}
            >
              <Star special />
              <span>Bonus</span>
              <small>{stop.bonusEarned ? 'Star earned' : 'Optional'}</small>
            </button>
          )}
        </li>
      ))}
    </ol>
  )
}
