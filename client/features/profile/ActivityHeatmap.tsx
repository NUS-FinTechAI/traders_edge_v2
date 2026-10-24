import type { Activity } from '../../services/playerService.ts'
import Chip from '../../ui/Chip.tsx'
import { utcDate } from '../../ui/format.ts'
import { useMediaQuery } from '../../ui/hooks.ts'
import { buildHeatmap, heatCellLabel } from './heatmap.ts'
import styles from './Profile.module.css'

const CELL = 12
const GAP = 3
const LEFT = 30
const TOP = 18
const ROW_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', '']

export default function ActivityHeatmap({ activity }: { activity: Activity }) {
  const wide = useMediaQuery('(min-width: 720px)')
  const weeks = wide ? 52 : 22
  const today = utcDate()
  const map = buildHeatmap(activity.days, weeks, today)
  const width = LEFT + weeks * (CELL + GAP)
  const height = TOP + 7 * (CELL + GAP)
  const days = (count: number) =>
    `${count} active ${count === 1 ? 'day' : 'days'}`
  // Drop month labels that would crowd the previous one.
  const months = map.months.reduce<typeof map.months>(
    (kept, month) =>
      kept.length && month.column - kept[kept.length - 1].column < 3
        ? kept
        : [...kept, month],
    [],
  )

  return (
    <section className={styles.panel} aria-labelledby="activity-title">
      <div className={styles.panelHead}>
        <h2 id="activity-title" className={styles.panelTitle}>
          Activity
        </h2>
        <Chip tone="flame" icon="flame">
          {activity.streak_days}-day streak
        </Chip>
      </div>
      <p className={styles.muted}>
        {days(map.activeDays)} in the past {wide ? 'year' : `${weeks} weeks`}
      </p>
      <svg
        className={styles.heatmap}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label={`Activity heatmap, one square per day: ${days(map.activeDays)} in the past ${weeks} weeks`}
      >
        {months.map((month) => (
          <text
            key={month.column}
            x={LEFT + month.column * (CELL + GAP)}
            y={11}
            className={styles.heatLabel}
          >
            {month.label}
          </text>
        ))}
        {ROW_LABELS.map((label, row) =>
          label ? (
            <text
              key={label}
              x={0}
              y={TOP + row * (CELL + GAP) + CELL - 2}
              className={styles.heatLabel}
            >
              {label}
            </text>
          ) : null,
        )}
        {map.columns.map((cells, column) =>
          cells.map((cell, row) =>
            cell ? (
              <rect
                key={cell.date}
                x={LEFT + column * (CELL + GAP)}
                y={TOP + row * (CELL + GAP)}
                width={CELL}
                height={CELL}
                rx={3}
                className={styles[`heat${cell.level}`]}
                role="img"
                aria-label={heatCellLabel(cell, today)}
              >
                <title>{heatCellLabel(cell, today)}</title>
              </rect>
            ) : null,
          ),
        )}
      </svg>
      <div className={styles.heatFooter}>
        <p className={styles.heatCaption}>
          A filled square is a day (UTC) you finished a match, completed a quiz
          or claimed your daily login. Darker squares mean more activity that
          day.
        </p>
        <div className={styles.legend} aria-hidden="true">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <svg key={level} width={CELL} height={CELL}>
              <rect
                width={CELL}
                height={CELL}
                rx={3}
                className={styles[`heat${level}`]}
              />
            </svg>
          ))}
          <span>More</span>
        </div>
      </div>
    </section>
  )
}
