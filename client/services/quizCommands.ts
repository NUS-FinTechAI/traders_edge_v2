import { HttpError } from './httpService.ts'
import {
  getQuizAttempt,
  getQuizRoom,
  sendQuizCommand,
  requireQuizOwner,
  type QuizAction,
  type QuizCommand,
  type QuizCommandResult,
} from './quizService.ts'

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
function validAction(value: unknown): value is QuizAction {
  if (!value || typeof value !== 'object' || !('kind' in value)) return false
  const action = value as Record<string, unknown>
  const text = (value: unknown): value is string =>
    typeof value === 'string' && value.length > 0
  switch (action.kind) {
    case 'start':
      return text(action.moduleId)
    case 'room-attempt':
    case 'start-room':
    case 'close-room':
      return text(action.roomId)
    case 'join-room':
      return (
        typeof action.code === 'string' && /^[A-Z2-9]{8}$/.test(action.code)
      )
    case 'answer': {
      if (
        !text(action.attemptId) ||
        !action.answer ||
        typeof action.answer !== 'object'
      )
        return false
      const answer = action.answer as Record<string, unknown>
      return (
        text(answer.question_id) &&
        text(answer.option_id) &&
        (answer.confidence === undefined ||
          answer.confidence === null ||
          (Number.isInteger(answer.confidence) &&
            Number(answer.confidence) >= 0 &&
            Number(answer.confidence) <= 100))
      )
    }
    case 'create-room': {
      if (!action.input || typeof action.input !== 'object') return false
      const input = action.input as Record<string, unknown>
      return (
        text(input.title) &&
        Array.isArray(input.question_ids) &&
        input.question_ids.length >= 1 &&
        input.question_ids.length <= 20 &&
        input.question_ids.every(text) &&
        new Set(input.question_ids).size === input.question_ids.length &&
        (input.attempt_limit === undefined ||
          (Number.isInteger(input.attempt_limit) &&
            Number(input.attempt_limit) >= 1 &&
            Number(input.attempt_limit) <= 3))
      )
    }
    default:
      return false
  }
}

export class QuizCommands {
  private readonly storageKey: string
  private readonly owner: string
  private readonly storage: Storage
  private readonly getOwnerId: () => string | null
  constructor(
    owner: string,
    storage: Storage,
    getOwnerId: () => string | null = () => owner,
  ) {
    this.owner = owner
    this.storage = storage
    this.getOwnerId = getOwnerId
    this.storageKey = `quiz-command:1:${encodeURIComponent(owner)}`
  }
  pending(): QuizCommand | null {
    const raw = this.storage.getItem(this.storageKey)
    if (!raw) return null
    try {
      const command = JSON.parse(raw) as QuizCommand
      if (
        command.owner !== this.owner ||
        typeof command.key !== 'string' ||
        !/^[A-Za-z0-9_-]{8,100}$/.test(command.key) ||
        !validAction(command.action)
      )
        throw new Error()
      return command
    } catch {
      throw new Error(
        'The saved quiz action could not be read. Keep this tab open and return to quizzes to inspect your saved activities.',
      )
    }
  }
  async submit(action: QuizAction): Promise<QuizCommandResult> {
    this.requireOwner()
    if (this.pending())
      throw new Error(
        'Confirm your saved quiz action before making another choice.',
      )
    if (!validAction(action))
      throw new Error('Choose a valid quiz action before submitting.')
    const command = {
      owner: this.owner,
      key: crypto.randomUUID(),
      action: structuredClone(action),
    }
    this.storage.setItem(this.storageKey, JSON.stringify(command))
    return this.send(command)
  }
  async retry(): Promise<QuizCommandResult> {
    this.requireOwner()
    const command = this.pending()
    if (!command) throw new Error('There is no saved quiz action to confirm.')
    return this.send(command)
  }
  private async send(command: QuizCommand): Promise<QuizCommandResult> {
    let confirmed = false
    try {
      this.requireOwner()
      const receipt = await sendQuizCommand(command)
      confirmed = true
      this.requireOwner()
      const current: QuizCommandResult =
        receipt.kind === 'attempt'
          ? {
              kind: 'attempt',
              attempt: await getQuizAttempt(receipt.attempt.id),
            }
          : { kind: 'room', room: await getQuizRoom(receipt.room.id) }
      this.requireOwner()
      this.storage.removeItem(this.storageKey)
      return current
    } catch (error) {
      this.requireOwner()
      if (
        !confirmed &&
        error instanceof HttpError &&
        error.kind === 'http' &&
        error.status !== null &&
        [400, 403, 404, 409, 422].includes(error.status)
      )
        this.storage.removeItem(this.storageKey)
      throw error
    }
  }
  private requireOwner() {
    requireQuizOwner(this.owner, this.getOwnerId)
  }
}
