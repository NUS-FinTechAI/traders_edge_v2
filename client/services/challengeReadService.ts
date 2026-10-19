import { api } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import type { components } from '../api/api-types.ts'
import {
  challengeService,
  type Challenge,
  type ChallengeStart,
} from './challengeService.ts'
import { HttpError } from './httpService.ts'
import { object, text, units } from '../utilities/typeUtils.ts'

export type ChallengeMode = NonNullable<ChallengeStart['mode']>
export type Wallet = components['schemas']['ChallengeWallet']
export const challengeNames: Record<ChallengeMode, string> = {
  practice: 'Practice against AI',
  daily: 'Daily AI challenge',
  chapter_entry: 'Entry boss',
  chapter_exit: 'Chapter boss',
}
export function challengeMode(value: string): value is ChallengeMode {
  return ['practice', 'daily', 'chapter_entry', 'chapter_exit'].includes(value)
}
export function challengeStartPath(
  mode: ChallengeMode,
  moduleId?: string | null,
) {
  return `/challenges/start/${mode}${moduleId ? `?chapter=${encodeURIComponent(moduleId)}` : ''}`
}
export function challengePath(id: string) {
  return `/challenges/play/${encodeURIComponent(id)}`
}

export function parseChallengeWallet(value: unknown): Wallet {
  const wallet = object(value)
  for (const key of ['stocks_balance', 'premium_balance', 'login_streak_days'])
    units(wallet[key])
  for (const key of [
    'policy_version',
    'timezone',
    'stocks_week',
    'stocks_expires_at',
    'simulated_trading_funds',
  ])
    text(wallet[key])
  for (const key of ['daily_cooldown_until', 'login_last_day'])
    if (wallet[key] !== null) text(wallet[key])
  return wallet as Wallet
}

export async function loadChallengeOverview(signal?: AbortSignal) {
  const [attempts, adventure, profile, wallet] = await Promise.all([
    challengeService.list(signal),
    api.call(apiEndpoints.getAdventure, { signal }),
    api.call(apiEndpoints.getProfile, { signal }),
    api.call(apiEndpoints.getEconomy, { signal }),
  ])
  const required = adventure.chapters.filter((chapter) => chapter.order <= 4)
  const missing = required.filter(
    (chapter) => !profile.mastered_module_ids.includes(chapter.module_id),
  )
  return {
    attempts: attempts.attempts,
    chapters: adventure.chapters,
    profile,
    wallet: parseChallengeWallet(wallet),
    practiceAvailable: required.length === 4 && missing.length === 0,
    missing,
  }
}
export type ChallengeOverview = Awaited<
  ReturnType<typeof loadChallengeOverview>
>

export function startAvailability(
  data: ChallengeOverview,
  mode: ChallengeMode,
  moduleId?: string | null,
): string | null {
  if (
    data.attempts.filter((attempt) => attempt.status === 'active').length >= 3
  )
    return 'Resume or abandon an active challenge before starting another; three attempts are already open.'
  if (mode === 'practice')
    return data.practiceAvailable
      ? null
      : 'Pass the learning checks in Chapters 1–4 before this practice mode.'
  if (mode === 'daily') {
    if (
      data.attempts.some(
        (attempt) => attempt.mode === 'daily' && attempt.status === 'active',
      )
    )
      return 'Resume your saved daily attempt before starting another.'
    return data.wallet.daily_cooldown_until
      ? `Your daily retry is available again at ${utcTime(data.wallet.daily_cooldown_until)}.`
      : null
  }
  const chapter = data.chapters.find((item) => item.module_id === moduleId)
  if (!chapter) return 'Choose a chapter from its adventure map first.'
  const boss = mode === 'chapter_entry' ? chapter.entry_boss : chapter.exit_boss
  if (boss.active_attempt_ids.length)
    return 'Resume your saved boss attempt before starting another.'
  if (boss.available) return null
  switch (boss.reason) {
    case 'introductory_diagnostic':
      return 'Chapter 1 begins with its introductory assessment instead of an entry boss.'
    case 'chapter_locked':
      return 'Unlock this chapter first.'
    case 'required_levels_incomplete':
      return 'Complete all required chapter levels first.'
    case 'diagnostic_incomplete':
      return 'Complete the chapter’s introductory assessment first.'
    case 'active_challenge_limit':
      return 'Resume or abandon an active challenge before starting another.'
    default:
      return 'This boss is not currently available. Reload its chapter map.'
  }
}

export function utcTime(value: string): string {
  const hasZone = /(?:z|[+-]\d{2}:\d{2})$/i.test(value)
  const date = new Date(value.includes('T') && !hasZone ? `${value}Z` : value)
  return Number.isFinite(date.valueOf())
    ? `${date.toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC`
    : value
}

export function challengeError(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.status === 401)
      return 'Your session expired. Sign in again, then recover your saved challenge.'
    if (error.status === 403)
      return typeof error.details === 'string'
        ? error.details
        : 'This mode requires the learning checks shown in its briefing.'
    if (error.status === 404)
      return 'This saved challenge could not be found for your profile.'
    if (error.status === 409 || error.status === 422) {
      if (typeof error.details === 'string') return error.details
      if (
        error.details &&
        typeof error.details === 'object' &&
        'message' in error.details &&
        typeof error.details.message === 'string'
      ) {
        const value = error.details as { message: string; retry_at?: string }
        return `${value.message}${value.retry_at ? `. Available again at ${utcTime(value.retry_at)}.` : '.'}`
      }
    }
    if (error.status === 503)
      return 'This challenge is unavailable or awaiting publication review. Your saved attempt is retained.'
    return 'The response could not be confirmed. Recover the saved command before making another decision.'
  }
  return error instanceof Error
    ? error.message
    : 'The challenge could not be loaded. Try again.'
}

type Brief = {
  context?: string
  review_prompts?: string[]
  assessment_basis?: string
}
export type DecisionReview = {
  basis: string
  cash_percent: string
  largest_position_percent: string
  max_drawdown_percent: string
  fees: string
  submitted_orders: number
  filled_orders: number
  review_prompts: string[]
}
export function challengeBrief(challenge: Challenge): Brief {
  const value = challenge.policy as Challenge['policy'] & Partial<Brief>
  return {
    context: typeof value.context === 'string' ? value.context : undefined,
    review_prompts: Array.isArray(value.review_prompts)
      ? value.review_prompts.filter((item) => typeof item === 'string')
      : undefined,
    assessment_basis:
      typeof value.assessment_basis === 'string'
        ? value.assessment_basis
        : undefined,
  }
}
export function challengeDecisionReview(
  challenge: Challenge,
): DecisionReview | null {
  const result = challenge.result as
    | (NonNullable<Challenge['result']> & {
        decision_review?: DecisionReview | null
      })
    | null
  const review = result?.decision_review
  if (
    !review ||
    typeof review.basis !== 'string' ||
    !Array.isArray(review.review_prompts)
  )
    return null
  return review
}
