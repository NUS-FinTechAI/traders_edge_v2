import {
  bossStatus,
  type AdventureChapter,
  type ModuleMap,
} from '../../../../services/adventureService.ts'
import { ChapterNode } from '../chapter-node/ChapterNode.tsx'
import './ChapterMap.css'

export default function ChapterMap({
  map,
  chapter,
  bonusLevelIds,
  onSelect,
}: {
  map: ModuleMap
  chapter: AdventureChapter
  bonusLevelIds: string[]
  onSelect: (stop: string) => void
}) {
  const routeNodes = [
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
            isLocked: !map.unlocked,
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
      isLocked: !level.unlocked,
      level,
    })),
    {
      id: 'exit',
      title: 'Chapter boss',
      marker: 'Boss',
      status: bossStatus(chapter.exit_boss, chapter.exit_boss_passed),
      isLocked: !chapter.exit_boss.available,
      level: null,
    },
  ]
  return (
    <section className="adventure-map" aria-label="Chapter adventure map">
      <div className="adventure-map-caption">
        <span>Your learning route</span>
        <span>
          {chapter.completed_required_levels}/{chapter.total_required_levels}{' '}
          levels
        </span>
      </div>
      <ChapterRoute
        nodes={routeNodes.map((node) => ({
          ...node,
          starEarned: node.level?.standard_star,
          bonus:
            !!node.level &&
            (bonusLevelIds.includes(node.level.id) || node.level.bonus_star),
          bonusEarned: node.level?.bonus_star,
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

export type ChapterRouteNode = {
  id: string
  title: string
  marker: string
  status: string
  isLocked: boolean
  starEarned?: boolean
  bonus?: boolean
  bonusEarned?: boolean
}

export function ChapterRoute({
  nodes,
  onSelect,
}: {
  nodes: ChapterRouteNode[]
  onSelect: (id: string) => void
}) {
  return (
    <ol className="adventure-route">
      {nodes.map((node, index) => (
        <ChapterNode
          key={node.id}
          node={node}
          index={index}
          nodes={nodes}
          onSelect={onSelect}
        />
      ))}
    </ol>
  )
}
