import type {
  Cohort,
  CohortPrePost,
  CsvKind,
  MetricSummary,
  PrePostReport,
} from '../../services/researchService.ts'

export const COHORTS: { id: Cohort; label: string }[] = [
  { id: 'all', label: 'All participants' },
  { id: 'novice', label: 'Novice' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'experienced', label: 'Experienced' },
  { id: 'unknown', label: 'Unknown (skipped)' },
]

export const EXPORTS: { kind: CsvKind; label: string }[] = [
  { kind: 'participants', label: 'Participants' },
  { kind: 'matches', label: 'Matches' },
  { kind: 'game-events', label: 'Game events' },
  { kind: 'check-answers', label: 'Check answers' },
  { kind: 'quiz-answers', label: 'Quiz answers' },
  { kind: 'prior-knowledge', label: 'Prior knowledge' },
]

export interface PrePostRow {
  chapterId: string
  label: string
  preview: MetricSummary
  boss: MetricSummary
  paired: CohortPrePost['paired_first_attempts']
}

/** One row per chapter (or only the chosen one) for the chosen cohort and attempt filter. */
export function prePostRows(
  report: PrePostReport,
  chapterId: string | null,
  cohort: Cohort,
  firstOnly: boolean,
): PrePostRow[] {
  return report.chapters
    .filter((chapter) => !chapterId || chapter.chapter_id === chapterId)
    .flatMap((chapter) => {
      const data = chapter.cohorts.find((item) => item.cohort === cohort)
      if (!data) return []
      const pick = firstOnly ? 'first_attempts' : 'all_attempts'
      return [
        {
          chapterId: chapter.chapter_id,
          label: `Ch ${chapter.number}: ${chapter.title}`,
          preview: data.preview[pick],
          boss: data.boss[pick],
          paired: data.paired_first_attempts,
        },
      ]
    })
}

/** A bar length as a percentage of `max`, clamped to 0–100; empty for no value. */
export function barPercent(value: number | null, max: number): number {
  if (value === null || max <= 0) return 0
  return Math.min(100, Math.max(0, (value / max) * 100))
}

const DASH = '-'

export function formatShare(value: number | null): string {
  return value === null ? DASH : `${Math.round(value * 100)}%`
}

export function formatScore(value: number | null): string {
  return value === null ? DASH : value.toFixed(1)
}

export function formatMoney(value: number | null): string {
  if (value === null) return DASH
  const sign = value < 0 ? '−' : value > 0 ? '+' : ''
  return `${sign}$${Math.abs(value).toFixed(2)}`
}

export function csvFilename(kind: CsvKind, date: Date): string {
  return `traders-edge-research-${kind}-${date.toISOString().slice(0, 10)}.csv`
}
