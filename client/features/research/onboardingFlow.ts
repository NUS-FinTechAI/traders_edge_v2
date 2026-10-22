import type {
  ConceptAnswer,
  PriorKnowledgeInstrument,
  SelfReport,
} from '../../services/researchService.ts'

export type Step =
  | { kind: 'intro' }
  | { kind: 'report'; index: number }
  | { kind: 'item'; index: number }

/** Intro, then the self-report items, then the concept items. */
export function steps(instrument: PriorKnowledgeInstrument): Step[] {
  return [
    { kind: 'intro' },
    ...instrument.self_report.map((_, index) => ({
      kind: 'report' as const,
      index,
    })),
    ...instrument.items.map((_, index) => ({ kind: 'item' as const, index })),
  ]
}

/** Chosen option ids by question id; null records "Prefer not to say" or "Not sure". */
export type Answers = Record<string, string | null>

export function selfReport(answers: Answers): SelfReport {
  const brokerage = answers.brokerage_account
  const confidence = answers.confidence
  return {
    experience: (answers.experience ?? null) as SelfReport['experience'],
    brokerage_account:
      brokerage === 'yes' ? true : brokerage === 'no' ? false : null,
    market_frequency: (answers.market_frequency ??
      null) as SelfReport['market_frequency'],
    confidence: confidence ? Number(confidence) : null,
  }
}

export function conceptAnswers(
  instrument: PriorKnowledgeInstrument,
  answers: Answers,
): ConceptAnswer[] {
  return instrument.items.map((item) => ({
    item_id: item.id,
    option_id: answers[item.id] ?? null,
  }))
}

/** Whole seconds between two `performance.now()`-style readings, capped at one day. */
export function elapsedSeconds(startedMs: number, nowMs: number): number {
  return Math.min(86400, Math.max(0, Math.round((nowMs - startedMs) / 1000)))
}
