export type Source = { id: string; title: string; url: string }
export type Question = {
  id: string
  prompt: string
  options: { id: string; text: string }[]
}
export type Profile = {
  id: string
  display_name: string
  leaderboard_opt_in: boolean
  analytics_opt_in: boolean
  xp: number
  completed_lesson_ids: string[]
  mastered_module_ids: string[]
  activity_days: string[]
  activity_timezone: string
  due_review_count: number
  learning_only: boolean
}
export type LessonSummary = {
  id: string
  title: string
  objective: string
  completed: boolean
  unlocked: boolean
}
export type Module = {
  id: string
  order: number
  title: string
  description: string
  optional: boolean
  unlocked: boolean
  mastered: boolean
  prerequisite_module_ids: string[]
  assessment_available: boolean
  lessons: LessonSummary[]
}
export type Curriculum = {
  schema_version: number
  review_status: string
  modules: Module[]
  sources: Source[]
  practice_eligibility: {
    simulation: boolean
    multiplayer: boolean
    endless: boolean
    prerequisite_module_ids: string[]
  }
}
export type Lesson = {
  id: string
  title: string
  objective: string
  source_basis: string[]
  explanation: string
  worked_example: string
  learning_cycle: Record<string, string>
  questions: Question[]
}
export type LessonResponse = {
  module_id: string
  completed: boolean
  review_status: string
  lesson: Lesson
  sources: Source[]
}
export type Result = {
  calibration?: {
    mean_brier_score: number
    sample_size: number
    scope: string
  } | null
  attempt_id: string
  kind: string
  target_id: string
  score_percent: number
  passed: boolean
  critical_items_passed: boolean
  mastery_rule: string
  feedback: {
    question_id: string
    correct: boolean
    selected_option_id: string
    correct_option_id: string
    explanation: string
    confidence: number | null
  }[]
  xp_awarded: number
  reflection_recorded: boolean
  reflection_assessed: boolean
  profile: Profile
}
export type Review = {
  id: string
  lesson_id: string
  title: string
  due_at: string
  completed: boolean
  due: boolean
  questions: Question[]
}
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(
      'The learning service could not be reached. Your current answers remain on this page. Try again when the connection returns.',
      0,
    )
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const detail = body.detail
    throw new ApiError(
      typeof detail === 'string'
        ? detail
        : detail && typeof detail.message === 'string'
          ? detail.message
          : Array.isArray(detail)
            ? detail.map((item: { msg: string }) => item.msg).join('. ')
            : 'The request could not be completed. Please try again.',
      response.status,
    )
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>)
}
export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) })
