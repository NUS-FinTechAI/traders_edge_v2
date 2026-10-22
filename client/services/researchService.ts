import { api } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import type { operations } from '../api/api-contract.ts'
import type { components } from '../api/api-types.ts'
import httpService from './httpService.ts'

type Schemas = components['schemas']

export type ResearchMetadata = Schemas['ResearchMetadataView']
export type OnboardingView = Schemas['OnboardingView']
export type PriorKnowledgeInstrument = Schemas['PriorKnowledgeInstrument']
export type SelfReport = Schemas['SelfReport']
export type ConceptAnswer = Schemas['ConceptAnswer']
export type ResearchSummary = Schemas['ResearchSummary']
export type PrePostReport = Schemas['PrePostReport']
export type CohortPrePost = Schemas['CohortPrePost']
export type MetricSummary = Schemas['MetricSummary']
export type DecisionTrends = Schemas['DecisionTrends']
export type CheckAccuracy = Schemas['CheckAccuracy']
export type QuizPerformance = Schemas['QuizPerformance']
export type Cohort = Schemas['Cohort']
export type CsvKind =
  operations['exportResearchCsv']['parameters']['path']['kind']

/** An idempotency key for one research command (8–100 URL-safe characters). */
export function commandKey(): string {
  return crypto.randomUUID()
}

export function getResearchMetadata(
  signal?: AbortSignal,
): Promise<ResearchMetadata> {
  return api.call(apiEndpoints.getResearchMetadata, { signal })
}

export function joinStudy(
  policy: ResearchMetadata['study_policy'],
): Promise<ResearchMetadata> {
  return api.call(apiEndpoints.submitResearchConsent, {
    body: {
      idempotency_key: commandKey(),
      accepted: true,
      policy_version: policy.version ?? '',
      policy_digest: policy.policy_digest ?? '',
    },
  })
}

export function leaveStudy(): Promise<ResearchMetadata> {
  return api.call(apiEndpoints.withdrawResearchConsent, {
    body: { idempotency_key: commandKey() },
  })
}

export function getOnboarding(signal?: AbortSignal): Promise<OnboardingView> {
  return api.call(apiEndpoints.getResearchOnboarding, { signal })
}

export function submitOnboarding(body: {
  idempotency_key: string
  instrument_version: string
  self_report: SelfReport
  answers: ConceptAnswer[]
  elapsed_seconds: number
}): Promise<OnboardingView> {
  return api.call(apiEndpoints.submitResearchOnboarding, { body })
}

export function skipOnboarding(
  idempotencyKey: string,
  instrumentVersion: string,
): Promise<OnboardingView> {
  return api.call(apiEndpoints.skipResearchOnboarding, {
    body: {
      idempotency_key: idempotencyKey,
      instrument_version: instrumentVersion,
    },
  })
}

export async function getResearchAccess(
  signal?: AbortSignal,
): Promise<boolean> {
  return (await api.call(apiEndpoints.getResearchAccess, { signal })).allowed
}

export function getResearchSummary(
  signal?: AbortSignal,
): Promise<ResearchSummary> {
  return api.call(apiEndpoints.getResearchSummary, { signal })
}

export function getPrePost(signal?: AbortSignal): Promise<PrePostReport> {
  return api.call(apiEndpoints.getResearchPrePost, { signal })
}

interface Filters {
  chapterId: string | null
  group: Cohort
}

export function getDecisionTrends(
  filters: Filters,
  signal?: AbortSignal,
): Promise<DecisionTrends> {
  return api.call(apiEndpoints.getResearchDecisionTrends, {
    query: { chapter_id: filters.chapterId, group: filters.group },
    signal,
  })
}

export function getCheckAccuracy(
  filters: Filters,
  signal?: AbortSignal,
): Promise<CheckAccuracy> {
  return api.call(apiEndpoints.getResearchCheckAccuracy, {
    query: { chapter_id: filters.chapterId, group: filters.group },
    signal,
  })
}

export function getQuizPerformance(
  group: Cohort,
  signal?: AbortSignal,
): Promise<QuizPerformance> {
  return api.call(apiEndpoints.getResearchQuizPerformance, {
    query: { group },
    signal,
  })
}

/** The CSV export as text; the caller saves it as a file. */
export function exportCsv(kind: CsvKind): Promise<string> {
  return httpService.requestText(
    apiEndpoints.exportResearchCsv.path.replace('{kind}', kind),
    { accept: 'text/csv' },
  )
}
