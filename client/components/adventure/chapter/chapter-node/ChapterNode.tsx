import { NormalStar, SpecialStar } from '../../../icons/mission-stars/MissionStars'
import { LockIcon } from '../../../icons/lock-icon/LockIcon'
import type { ChapterRouteStop } from '../chapter-map/ChapterMap'
import './ChapterNode.css'

export function ChapterNode({
  stop,
  index,
  stops,
  onSelect,
}: {
  stop: ChapterRouteStop
  index: number
  stops: ChapterRouteStop[]
  onSelect: (id: string) => void
}) {
  return (
    <li
      key={stop.id}
      className={`adventure-map-row${stop.status === 'Completed' || stop.status === 'Defeated' ? ' is-complete' : ''}${stop.isLocked ? ' is-locked' : ''}`}
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
        className={`adventure-map-stop${stop.isLocked ? ' is-locked' : ''}`}
        onClick={() => onSelect(stop.id)}
        aria-label={`${stop.marker === 'Start' || stop.marker === 'Boss' ? '' : `Level ${Number(stop.marker)}: `}${stop.title}. ${stop.status}.${stop.bonus ? (stop.bonusEarned ? ' Special star earned.' : ' Optional bonus missions.') : ''} View details.`}
      >
        <span className="adventure-node-number">
          {stop.marker}
          {stop.isLocked && <LockIcon className="adventure-node-lock" />}
        </span>
        <span className="adventure-node-title">{stop.title}</span>
        {!stop.isLocked && (
          <span className="adventure-node-status">{stop.status}</span>
        )}
        {(stop.starEarned !== undefined || stop.bonus) && (
          <span className="adventure-node-missions">
            {stop.starEarned !== undefined && (
              <span className="adventure-node-star">
                <NormalStar earned={stop.starEarned} />
              </span>
            )}
            {stop.bonus && (
              <span className="adventure-node-star">
                <SpecialStar earned={!!stop.bonusEarned} />
              </span>
            )}
          </span>
        )}
      </button>
    </li>
  )
}
