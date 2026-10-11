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
        stops={routeStops.map((stop) => ({
          ...stop,
          starEarned: stop.level?.standard_star,
          bonus:
            !!stop.level &&
            (bonusLevelIds.includes(stop.level.id) || stop.level.bonus_star),
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
  isLocked: boolean
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
        <ChapterNode
          key={stop.id}
          stop={stop}
          index={index}
          stops={stops}
          onSelect={onSelect}
        />
      ))}
    </ol>
  )
}
