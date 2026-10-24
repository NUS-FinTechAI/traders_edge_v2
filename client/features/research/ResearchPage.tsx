import { useState, type ReactNode } from 'react'
import {
  exportCsv,
  getCheckAccuracy,
  getDecisionTrends,
  getPrePost,
  getQuizPerformance,
  getResearchSummary,
  type Cohort,
  type CsvKind,
  type MetricSummary,
  type ResearchSummary,
} from '../../services/researchService.ts'
import Button from '../../ui/Button.tsx'
import PageHeader from '../../ui/PageHeader.tsx'
import ResourceView from '../../ui/ResourceView.tsx'
import { useToast } from '../../ui/toastContext.ts'
import useResource, { errorText } from '../../ui/useResource.ts'
import {
  barPercent,
  COHORTS,
  csvFilename,
  EXPORTS,
  formatMoney,
  formatScore,
  formatShare,
  prePostRows,
  type PrePostRow,
} from './researchLogic.ts'
import styles from './Research.module.css'

type ChartMetric = 'decision' | 'missions' | 'wins'

const METRICS: {
  id: ChartMetric
  label: string
  value: (summary: MetricSummary) => number | null
  text: (summary: MetricSummary) => string
}[] = [
  {
    id: 'decision',
    label: 'Mean decision score',
    value: (summary) => summary.mean_decision_score,
    text: (summary) => formatScore(summary.mean_decision_score),
  },
  {
    id: 'missions',
    label: 'Mission completion',
    value: (summary) =>
      summary.mission_completion === null
        ? null
        : summary.mission_completion * 100,
    text: (summary) => formatShare(summary.mission_completion),
  },
  {
    id: 'wins',
    label: 'Win rate',
    value: (summary) =>
      summary.win_rate === null ? null : summary.win_rate * 100,
    text: (summary) => formatShare(summary.win_rate),
  },
]

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string
  title: string
  note?: string
  children: ReactNode
}) {
  return (
    <section className={styles.panel} aria-labelledby={id}>
      <h2 id={id} className={styles.panelTitle}>
        {title}
      </h2>
      {note && <p className={styles.muted}>{note}</p>}
      {children}
    </section>
  )
}

function Overview({ summary }: { summary: ResearchSummary }) {
  const cards: [string, number][] = [
    ['Participants', summary.participants],
    ['Answered study questions', summary.onboarding.completed],
    ['Skipped study questions', summary.onboarding.skipped],
    ['Not yet answered', summary.onboarding.pending],
    ['Finished matches', summary.total_matches],
    ...summary.groups.map(
      (group) =>
        [
          COHORTS.find((cohort) => cohort.id === group.group)?.label ??
            group.group,
          group.participants,
        ] as [string, number],
    ),
  ]
  return (
    <dl className={styles.cards}>
      {cards.map(([label, value]) => (
        <div key={label} className={styles.card}>
          <dt>{label}</dt>
          <dd className="num">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Bar({
  series,
  summary,
  metric,
}: {
  series: 'Preview' | 'Boss'
  summary: MetricSummary
  metric: (typeof METRICS)[number]
}) {
  const value = metric.value(summary)
  const width = barPercent(value, 100)
  return (
    <div className={styles.barRow}>
      <span className={styles.series}>{series}</span>
      <svg className={styles.barTrack} aria-hidden="true">
        {value !== null && (
          <rect
            className={series === 'Preview' ? styles.preview : styles.boss}
            x="0"
            y="2"
            width={`${Math.max(width, 0.5)}%`}
            height="16"
            rx="4"
          >
            <title>{`${series}: ${metric.text(summary)}`}</title>
          </rect>
        )}
      </svg>
      <span className={styles.value}>
        <span className="num">{metric.text(summary)}</span>{' '}
        <span className={styles.muted}>n={summary.matches}</span>
      </span>
    </div>
  )
}

function PrePostChart({ rows }: { rows: PrePostRow[] }) {
  const [metricId, setMetricId] = useState<ChartMetric>('decision')
  const metric = METRICS.find((item) => item.id === metricId) ?? METRICS[0]
  return (
    <>
      <div className={styles.chartHead}>
        <label className={styles.field}>
          <span>Measure</span>
          <select
            value={metricId}
            onChange={(event) => setMetricId(event.target.value as ChartMetric)}
          >
            {METRICS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <p className={styles.legend} aria-hidden="true">
          <span className={styles.key}>
            <span className={`${styles.swatch} ${styles.previewSwatch}`} />
            Preview Battle (before lessons)
          </span>
          <span className={styles.key}>
            <span className={`${styles.swatch} ${styles.bossSwatch}`} />
            Chapter Boss (after lessons)
          </span>
        </p>
      </div>
      <div
        className={styles.chart}
        role="group"
        aria-label={`${metric.label}, Preview Battle against Chapter Boss; the table below lists every value`}
      >
        {rows.map((row) => (
          <div key={row.chapterId} className={styles.chartGroup}>
            <p className={styles.groupLabel}>{row.label}</p>
            <Bar series="Preview" summary={row.preview} metric={metric} />
            <Bar series="Boss" summary={row.boss} metric={metric} />
          </div>
        ))}
      </div>
    </>
  )
}

function PrePostTable({ rows }: { rows: PrePostRow[] }) {
  const phases = (row: PrePostRow) =>
    [
      ['Preview', row.preview],
      ['Boss', row.boss],
    ] as const
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="visually-hidden">
          Preview Battle against Chapter Boss per chapter
        </caption>
        <thead>
          <tr>
            <th scope="col">Chapter</th>
            <th scope="col">Match</th>
            <th scope="col">Matches</th>
            <th scope="col">Players</th>
            <th scope="col">Forfeits</th>
            <th scope="col">Mean profit</th>
            <th scope="col">Decision score</th>
            <th scope="col">Missions part</th>
            <th scope="col">Plan part</th>
            <th scope="col">Risk part</th>
            <th scope="col">Overtrading part</th>
            <th scope="col">Missions done</th>
            <th scope="col">Win rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.flatMap((row) => [
            ...phases(row).map(([label, summary]) => (
              <tr key={`${row.chapterId}-${label}`}>
                <th scope="row">{row.label}</th>
                <td>{label}</td>
                <td className="num">{summary.matches}</td>
                <td className="num">{summary.participants}</td>
                <td className="num">{summary.forfeited}</td>
                <td className="num">{formatMoney(summary.mean_profit)}</td>
                <td className="num">
                  {formatScore(summary.mean_decision_score)}
                </td>
                <td className="num">
                  {formatShare(summary.decision_parts.missions)}
                </td>
                <td className="num">
                  {formatShare(summary.decision_parts.plan)}
                </td>
                <td className="num">
                  {formatShare(summary.decision_parts.risk)}
                </td>
                <td className="num">
                  {formatShare(summary.decision_parts.overtrading)}
                </td>
                <td className="num">
                  {formatShare(summary.mission_completion)}
                </td>
                <td className="num">{formatShare(summary.win_rate)}</td>
              </tr>
            )),
            <tr key={`${row.chapterId}-paired`} className={styles.paired}>
              <th scope="row">{row.label}</th>
              <td colSpan={12}>
                Paired first attempts: {row.paired.participants} players ·
                profit change {formatMoney(row.paired.mean_profit_change)} ·
                decision score change{' '}
                {formatScore(row.paired.mean_decision_score_change)}
              </td>
            </tr>,
          ])}
        </tbody>
      </table>
    </div>
  )
}

function Funnel({
  summary,
  chapterId,
}: {
  summary: ResearchSummary
  chapterId: string | null
}) {
  const chapter =
    summary.funnel.find((item) => item.chapter_id === chapterId) ??
    summary.funnel[0]
  if (!chapter) return null
  return (
    <>
      <p className={styles.groupLabel}>
        Chapter {chapter.number}: {chapter.title}
      </p>
      <ol className={styles.funnel}>
        {chapter.steps.map((step) => (
          <li key={step.step} className={styles.barRow}>
            <span className={styles.stepLabel}>{step.label}</span>
            <svg className={styles.barTrack} aria-hidden="true">
              <rect
                className={styles.funnelBar}
                x="0"
                y="2"
                width={`${Math.max(barPercent(step.participants, summary.participants), 0.5)}%`}
                height="16"
                rx="4"
              />
            </svg>
            <span className={`num ${styles.value}`}>{step.participants}</span>
          </li>
        ))}
      </ol>
    </>
  )
}

function Trends({
  chapterId,
  group,
}: {
  chapterId: string | null
  group: Cohort
}) {
  const resource = useResource(
    (signal) => getDecisionTrends({ chapterId, group }, signal),
    [chapterId, group],
  )
  return (
    <ResourceView resource={resource} label="Loading trends…">
      {(trends) => (
        <Section
          id="trends-title"
          title="Decision score by attempt"
          note={trends.note}
        >
          {trends.series.length === 0 ? (
            <p className={styles.muted}>No finished matches in this filter.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Match kind</th>
                    {trends.series[0].points.map((point) => (
                      <th key={point.attempt} scope="col">
                        Attempt {point.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trends.series.map((series) => (
                    <tr key={series.kind}>
                      <th scope="row">{series.kind}</th>
                      {series.points.map((point) => (
                        <td key={point.attempt} className="num">
                          {formatScore(point.mean_decision_score)}{' '}
                          <span className={styles.muted}>
                            n={point.matches}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}
    </ResourceView>
  )
}

function Checks({
  chapterId,
  group,
}: {
  chapterId: string | null
  group: Cohort
}) {
  const resource = useResource(
    (signal) => getCheckAccuracy({ chapterId, group }, signal),
    [chapterId, group],
  )
  return (
    <ResourceView resource={resource} label="Loading check answers…">
      {(checks) => (
        <Section
          id="checks-title"
          title="First-try check accuracy"
          note={checks.note}
        >
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Level</th>
                  <th scope="col">Players</th>
                  <th scope="col">First answers</th>
                  <th scope="col">Correct first try</th>
                  <th scope="col">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {checks.levels.map((level) => (
                  <tr key={level.level_id}>
                    <th scope="row">
                      {level.level_id} · {level.title}
                    </th>
                    <td className="num">{level.participants}</td>
                    <td className="num">{level.answers}</td>
                    <td className="num">{level.first_try_correct}</td>
                    <td className="num">{formatShare(level.accuracy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </ResourceView>
  )
}

function Quizzes({ group, firstOnly }: { group: Cohort; firstOnly: boolean }) {
  const resource = useResource(
    (signal) => getQuizPerformance(group, signal),
    [group],
  )
  return (
    <ResourceView resource={resource} label="Loading quizzes…">
      {(quizzes) => (
        <Section id="quiz-title" title="Quiz performance" note={quizzes.note}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Chapter</th>
                  <th scope="col">
                    {firstOnly ? 'First attempts' : 'Attempts'}
                  </th>
                  <th scope="col">Players</th>
                  <th scope="col">Mean score</th>
                  <th scope="col">Pass rate</th>
                  <th scope="col">Bank answers</th>
                  <th scope="col">Answer accuracy</th>
                </tr>
              </thead>
              <tbody>
                {quizzes.chapters.map((chapter) => {
                  const stats = firstOnly
                    ? chapter.first_attempts
                    : chapter.all_attempts
                  return (
                    <tr key={chapter.chapter_id}>
                      <th scope="row">
                        Ch {chapter.number}: {chapter.title}
                      </th>
                      <td className="num">{stats.attempts}</td>
                      <td className="num">{stats.participants}</td>
                      <td className="num">
                        {stats.mean_score_pct === null
                          ? '-'
                          : `${Math.round(stats.mean_score_pct)}%`}
                      </td>
                      <td className="num">{formatShare(stats.pass_rate)}</td>
                      <td className="num">{chapter.answers}</td>
                      <td className="num">
                        {formatShare(chapter.answer_accuracy)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </ResourceView>
  )
}

function Exports() {
  const notify = useToast()
  const [busy, setBusy] = useState<CsvKind | null>(null)

  async function download(kind: CsvKind) {
    setBusy(kind)
    try {
      const url = URL.createObjectURL(
        new Blob([await exportCsv(kind)], { type: 'text/csv' }),
      )
      const link = document.createElement('a')
      link.href = url
      link.download = csvFilename(kind, new Date())
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      notify(errorText(error), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Section
      id="exports-title"
      title="CSV exports"
      note="Pseudonymous participant, match and quiz ids. No names, emails, sign-in ids or reflection text. Store files only where the approved study protocol allows."
    >
      <div className={styles.exports}>
        {EXPORTS.map((item) => (
          <Button
            key={item.kind}
            variant="secondary"
            icon="arrow-down"
            disabled={busy !== null}
            onClick={() => void download(item.kind)}
          >
            {busy === item.kind ? 'Preparing…' : item.label}
          </Button>
        ))}
      </div>
    </Section>
  )
}

function Dashboard({ summary }: { summary: ResearchSummary }) {
  const [chapterId, setChapterId] = useState<string | null>(null)
  const [group, setGroup] = useState<Cohort>('all')
  const [firstOnly, setFirstOnly] = useState(true)
  const prePost = useResource(getPrePost)

  return (
    <div className={styles.page}>
      <PageHeader
        title="Research dashboard"
        subtitle={`Policy ${summary.policy_version} · instrument ${summary.instrument_version}. Every learning measure here is unvalidated.`}
      />
      <p className={styles.scope}>{summary.scope}</p>
      <Overview summary={summary} />
      <div className={styles.filters} role="group" aria-label="Filters">
        <label className={styles.field}>
          <span>Chapter</span>
          <select
            value={chapterId ?? ''}
            onChange={(event) => setChapterId(event.target.value || null)}
          >
            <option value="">All chapters</option>
            {summary.funnel.map((chapter) => (
              <option key={chapter.chapter_id} value={chapter.chapter_id}>
                Chapter {chapter.number}: {chapter.title}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Prior-knowledge group</span>
          <select
            value={group}
            onChange={(event) => setGroup(event.target.value as Cohort)}
          >
            {COHORTS.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={firstOnly}
            onChange={(event) => setFirstOnly(event.target.checked)}
          />
          <span>First attempts only</span>
        </label>
      </div>
      <ResourceView resource={prePost} label="Loading the pre/post comparison…">
        {(report) => {
          const rows = prePostRows(report, chapterId, group, firstOnly)
          return (
            <Section
              id="prepost-title"
              title={`Before and after the lessons · ${firstOnly ? 'first attempts' : 'all attempts'}`}
              note={report.note}
            >
              <PrePostChart rows={rows} />
              <PrePostTable rows={rows} />
            </Section>
          )
        }}
      </ResourceView>
      <Section
        id="funnel-title"
        title="Completion funnel"
        note="Participants with an in-scope record at each step, out of all participants."
      >
        <Funnel summary={summary} chapterId={chapterId} />
      </Section>
      <Trends chapterId={chapterId} group={group} />
      <Checks chapterId={chapterId} group={group} />
      <Quizzes group={group} firstOnly={firstOnly} />
      <Exports />
    </div>
  )
}

/** Researcher-only aggregates; the server refuses everyone not on its allow-list. */
export default function ResearchPage() {
  const summary = useResource(getResearchSummary)
  return (
    <ResourceView resource={summary} label="Loading the research dashboard…">
      {(data) => <Dashboard summary={data} />}
    </ResourceView>
  )
}
