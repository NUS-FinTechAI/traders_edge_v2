import {
  NormalStar,
  SpecialStar,
} from '../../../icons/mission-stars/MissionStars'
import { LockIcon } from '../../../icons/LockIcon'
import type { ChapterRouteNode } from '../chapter-map/ChapterMap'
import './ChapterNode.css'

export function ChapterNode({
  node,
  index,
  nodes,
  onSelect,
}: {
  node: ChapterRouteNode
  index: number
  nodes: ChapterRouteNode[]
  onSelect: (id: string) => void
}) {
  return (
    <li
      key={node.id}
      className={`adventure-map-row${node.status === 'Completed' || node.status === 'Defeated' ? ' is-complete' : ''}${node.isLocked ? ' is-locked' : ''}`}
    >
      {index < nodes.length - 1 && (
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
        className={`adventure-map-stop${node.isLocked ? ' is-locked' : ''}`}
        onClick={() => onSelect(node.id)}
        aria-label={`${node.marker === 'Start' || node.marker === 'Boss' ? '' : `Level ${Number(node.marker)}: `}${node.title}. ${node.status}.${node.bonus ? (node.bonusEarned ? ' Special star earned.' : ' Optional bonus missions.') : ''} View details.`}
      >
        <span className="adventure-node-number">
          {node.marker}
          {node.isLocked && <LockIcon className="adventure-node-lock" />}
        </span>
        <span className="adventure-node-title">{node.title}</span>
        {!node.isLocked && (
          <span className="adventure-node-status">{node.status}</span>
        )}
        {(node.starEarned !== undefined || node.bonus) && (
          <span className="adventure-node-missions">
            {node.starEarned !== undefined && (
              <span className="adventure-node-star">
                <NormalStar earned={node.starEarned} />
              </span>
            )}
            {node.bonus && (
              <span className="adventure-node-star">
                <SpecialStar earned={!!node.bonusEarned} />
              </span>
            )}
          </span>
        )}
      </button>
    </li>
  )
}
