import { api } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import type { components } from '../api/api-types.ts'
import { HttpError } from './httpService.ts'
import { object, text as string } from '../utilities/typeUtils.ts'

type LearningRunResponse = components['schemas']['LearningRunResponse']
export type LearningPurpose = Extract<
  LearningRunResponse['purpose'],
  'diagnostic' | 'practice' | 'bonus'
>
export type StepAnswer = components['schemas']['StepAnswer']
type Entry = components['schemas']['TaskEntry']
export type LearningTask = NonNullable<LearningRunResponse['current_step']>
export type LearningRun = Pick<
  LearningRunResponse,
  | 'id'
  | 'module_id'
  | 'level_id'
  | 'purpose'
  | 'status'
  | 'current_step'
  | 'progress'
> & {
  feedback: Pick<
    components['schemas']['LearningFeedback'],
    'step_id' | 'correct' | 'explanation'
  >[]
  result: Pick<
    components['schemas']['LearningResult'],
    'passed' | 'score_percent' | 'standard_star' | 'bonus_star' | 'xp_awarded'
  > | null
}

function entries(value: Entry[]): Entry[] {
  return value.map(({ id, text }) => ({ id, text }))
}

export function parseLearningRun(data: LearningRun): LearningRun {
  let task: LearningTask | null = null
  if (data.current_step !== null) {
    const step = data.current_step
    const base = {
      id: step.id,
      prompt: step.prompt,
    }
    switch (step.type) {
      case 'instruction':
        task = {
          ...base,
          type: 'instruction',
          text: step.text,
        }
        break
      case 'choice':
        task = { ...base, type: 'choice', options: entries(step.options) }
        break
      case 'classification':
        task = {
          ...base,
          type: 'classification',
          items: entries(step.items),
          categories: entries(step.categories),
        }
        break
      case 'simulation':
        task = { ...base, type: 'simulation' }
        break
    }
  }
  const feedback = data.feedback.map((item) => {
    return {
      step_id: item.step_id,
      correct: item.correct,
      explanation: item.explanation,
    }
  })
  let result: LearningRun['result'] = null
  if (data.result !== null) {
    const outcome = data.result
    result = {
      passed: outcome.passed,
      score_percent: outcome.score_percent,
      standard_star: outcome.standard_star,
      bonus_star: outcome.bonus_star,
      xp_awarded: outcome.xp_awarded,
    }
  }
  const completed = data.progress.completed_steps
  const total = data.progress.total_steps
  if (
    completed > total ||
    (data.status === 'active'
      ? !task || result !== null || completed === total
      : task !== null || !result || completed !== total)
  )
    throw new HttpError(
      'Something went wrong while processing the learning run.',
      'invalid-response',
    )
  return {
    id: data.id,
    module_id: data.module_id,
    level_id: data.level_id,
    purpose: data.purpose,
    status: data.status,
    current_step: task,
    progress: { completed_steps: completed, total_steps: total },
    feedback,
    result,
  }
}

export function isLearningPurpose(value: string): value is LearningPurpose {
  return value === 'diagnostic' || value === 'practice' || value === 'bonus'
}

export async function getLearningRun(id: string, signal?: AbortSignal) {
  const run = parseLearningRun(
    await api.call(apiEndpoints.getLearningRun, {
      path: { run_id: id },
      signal,
    }),
  )
  if (run.id !== id)
    throw new HttpError(
      'Something went wrong while processing the learning run.',
      'invalid-response',
    )
  return run
}

export type PendingAnswer = {
  idempotency_key: string
  run_id: string
  step_id: string
  answer: StepAnswer
}
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>

export class LearningCommands {
  private readonly owner: string
  private readonly storage: Storage

  constructor(owner: string, storage: Storage) {
    this.owner = owner
    this.storage = storage
  }

  private key(target: string) {
    return `adventure-command:${encodeURIComponent(this.owner)}:${target}`
  }

  private read(target: string) {
    const value = this.storage.getItem(this.key(target))
    if (!value) return null
    try {
      return object(JSON.parse(value))
    } catch {
      throw new Error(
        'The saved command could not be read. Return to the map to inspect your saved progress.',
      )
    }
  }

  pending(runId: string): PendingAnswer | null {
    const saved = this.read(`run:${runId}`)
    if (!saved) return null
    if (saved.run_id !== runId)
      throw new HttpError(
        'Something went wrong while processing the pending command.',
        'invalid-response',
      )
    return {
      idempotency_key: string(saved.idempotency_key),
      run_id: runId,
      step_id: string(saved.step_id),
      answer: object(saved.answer) as StepAnswer,
    }
  }

  clearAnswer(runId: string) {
    this.storage.removeItem(this.key(`run:${runId}`))
  }

  async start(purpose: LearningPurpose, target: string, signal?: AbortSignal) {
    const key = this.key(`start:${purpose}:${target}`)
    const saved = this.read(`start:${purpose}:${target}`)
    const body = {
      idempotency_key: saved
        ? string(saved.idempotency_key)
        : crypto.randomUUID(),
    }
    this.storage.setItem(key, JSON.stringify(body))
    const response =
      purpose === 'diagnostic'
        ? await api.call(apiEndpoints.startDiagnosticRun, {
            path: { module_id: target },
            body,
            signal,
          })
        : await api.call(apiEndpoints.startLevelRun, {
            path: { level_id: target },
            body: { ...body, purpose },
            signal,
          })
    const run = parseLearningRun(response)
    if (
      run.purpose !== purpose ||
      (purpose === 'diagnostic' ? run.module_id : run.level_id) !== target
    )
      throw new HttpError(
        'Something went wrong while processing the start response.',
        'invalid-response',
      )
    // Keep the start receipt until navigation commits; a reload of the start URL must resume it.
    return run
  }

  finishStart(purpose: LearningPurpose, target: string) {
    this.storage.removeItem(this.key(`start:${purpose}:${target}`))
  }

  async submit(run: LearningRun, answer?: StepAnswer) {
    let command = this.pending(run.id)
    if (!command) {
      if (
        !answer ||
        !run.current_step ||
        run.current_step.type === 'simulation' ||
        run.status !== 'active'
      )
        throw new Error('This step cannot be submitted here.')
      command = {
        idempotency_key: crypto.randomUUID(),
        run_id: run.id,
        step_id: run.current_step.id,
        answer: structuredClone(answer),
      }
      this.storage.setItem(this.key(`run:${run.id}`), JSON.stringify(command))
    }
    const updated = parseLearningRun(
      await api.call(apiEndpoints.submitLearningStep, {
        path: { run_id: command.run_id, step_id: command.step_id },
        body: {
          idempotency_key: command.idempotency_key,
          answer: command.answer,
        },
      }),
    )
    if (updated.id !== run.id)
      throw new HttpError(
        'Something went wrong while processing the submit response.',
        'invalid-response',
      )
    this.clearAnswer(run.id)
    return updated
  }
}

export function learningError(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.status === 401)
      return 'Your session has expired. Sign in again to continue.'
    if (error.status === 403)
      return 'This activity is not available to your profile. Check the chapter prerequisites.'
    if (error.status === 404) return 'This saved activity could not be found.'
    if (error.status === 409)
      return 'Your saved activity has changed. Reload it before continuing.'
    if (error.status === 422)
      return 'The answer was not accepted. Reload the saved activity and try again.'
    if (error.status === 503)
      return 'This content is awaiting publication review. Please try again later.'
  }
  return 'The request could not be confirmed. Retry to check the same saved command.'
}
