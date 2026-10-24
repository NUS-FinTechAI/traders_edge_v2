import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  conceptAnswers,
  elapsedSeconds,
  selfReport,
  steps,
} from '../features/research/onboardingFlow.ts'
import {
  barPercent,
  csvFilename,
  formatMoney,
  formatShare,
  prePostRows,
} from '../features/research/researchLogic.ts'
import type {
  MetricSummary,
  PrePostReport,
  PriorKnowledgeInstrument,
} from '../services/researchService.ts'

const instrument: PriorKnowledgeInstrument = {
  version: 'v1',
  self_report: [
    { id: 'experience', prompt: 'Experience?', options: [] },
    { id: 'confidence', prompt: 'Confidence?', options: [] },
  ],
  items: [
    { id: 'pk-a', kind: 'mc', prompt: 'A?', options: [] },
    { id: 'pk-b', kind: 'true_false', prompt: 'B?', options: [] },
  ],
}

function metrics(matches: number, score: number | null): MetricSummary {
  return {
    matches,
    participants: matches,
    forfeited: 0,
    mean_profit: null,
    mean_decision_score: score,
    decision_parts: {
      missions: null,
      plan: null,
      risk: null,
      overtrading: null,
    },
    mission_completion: null,
    win_rate: null,
  }
}

const report: PrePostReport = {
  metric_status: 'unvalidated',
  note: '',
  chapters: ['ch1', 'ch2'].map((id, index) => ({
    chapter_id: id,
    number: index + 1,
    title: `Chapter ${index + 1}`,
    cohorts: [
      {
        cohort: 'all',
        preview: {
          first_attempts: metrics(1, 40),
          all_attempts: metrics(3, 50),
        },
        boss: { first_attempts: metrics(1, 70), all_attempts: metrics(2, 80) },
        paired_first_attempts: {
          participants: 1,
          mean_profit_change: 10,
          mean_decision_score_change: 30,
        },
      },
    ],
  })),
}

test('the onboarding runs intro, self-report items, then concept items', () => {
  assert.deepEqual(steps(instrument), [
    { kind: 'intro' },
    { kind: 'report', index: 0 },
    { kind: 'report', index: 1 },
    { kind: 'item', index: 0 },
    { kind: 'item', index: 1 },
  ])
})

test('self-report answers become typed values and unanswered items stay null', () => {
  assert.deepEqual(
    selfReport({
      experience: 'some',
      brokerage_account: 'no',
      confidence: '4',
    }),
    {
      experience: 'some',
      brokerage_account: false,
      market_frequency: null,
      confidence: 4,
    },
  )
  assert.deepEqual(selfReport({ experience: null }), {
    experience: null,
    brokerage_account: null,
    market_frequency: null,
    confidence: null,
  })
})

test('every concept item is answered, with "Not sure" sent as null', () => {
  assert.deepEqual(conceptAnswers(instrument, { 'pk-a': 'b', 'pk-b': null }), [
    { item_id: 'pk-a', option_id: 'b' },
    { item_id: 'pk-b', option_id: null },
  ])
  assert.deepEqual(conceptAnswers(instrument, {})[1], {
    item_id: 'pk-b',
    option_id: null,
  })
})

test('elapsed time is whole seconds within 0 to one day', () => {
  assert.equal(elapsedSeconds(1000, 95_400), 94)
  assert.equal(elapsedSeconds(5000, 1000), 0)
  assert.equal(elapsedSeconds(0, 10 ** 9), 86400)
})

test('pre/post rows follow the chapter, cohort and first-attempt filters', () => {
  const pick = (rows: ReturnType<typeof prePostRows>) =>
    rows.map((row) => [
      row.chapterId,
      row.preview.matches,
      row.boss.mean_decision_score,
    ])
  assert.deepEqual(pick(prePostRows(report, null, 'all', true)), [
    ['ch1', 1, 70],
    ['ch2', 1, 70],
  ])
  assert.deepEqual(pick(prePostRows(report, 'ch2', 'all', false)), [
    ['ch2', 3, 80],
  ])
  assert.deepEqual(prePostRows(report, null, 'novice', true), [])
})

test('bars are clamped percentages and empty without a value', () => {
  assert.equal(barPercent(45, 100), 45)
  assert.equal(barPercent(150, 100), 100)
  assert.equal(barPercent(-5, 100), 0)
  assert.equal(barPercent(null, 100), 0)
  assert.equal(barPercent(3, 0), 0)
})

test('values are formatted with a dash for missing data', () => {
  assert.equal(formatShare(0.456), '46%')
  assert.equal(formatShare(null), '-')
  assert.equal(formatMoney(-12.5), '−$12.50')
  assert.equal(formatMoney(3), '+$3.00')
  assert.equal(formatMoney(null), '-')
})

test('CSV file names carry the export kind and UTC date', () => {
  assert.equal(
    csvFilename('game-events', new Date('2026-10-22T23:30:00Z')),
    'traders-edge-research-game-events-2026-10-22.csv',
  )
})
