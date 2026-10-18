import type { ChallengeCommand } from './challengeService.ts'
import { object, text } from '../utilities/typeUtils.ts'

export type ChallengeStorage = Pick<Storage, 'getItem' | 'setItem'>
export type ChallengeJournalEntry = {
  attemptId: string | null
  pending: ChallengeCommand | null
}

function parseCommand(value: unknown): ChallengeCommand {
  const command = object(value)
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(text(command.key)))
    throw new Error('Invalid command key.')
  if (command.kind !== 'start') text(command.attemptId)
  switch (command.kind) {
    case 'start': {
      const input = object(command.input)
      if (
        input.mode !== undefined &&
        !['practice', 'daily', 'chapter_entry', 'chapter_exit'].includes(
          String(input.mode),
        )
      )
        throw new Error('Invalid challenge mode.')
      if (input.module_id !== undefined && input.module_id !== null)
        text(input.module_id)
      if (
        input.opponent_count !== undefined &&
        ![1, 2, 3].includes(input.opponent_count as number)
      )
        throw new Error('Invalid opponent count.')
      break
    }
    case 'order': {
      const order = object(command.order)
      const plan = object(order.plan)
      if (
        !['NORTH', 'HARBOR', 'PLAIN', 'COVE'].includes(String(order.symbol)) ||
        !['buy', 'sell'].includes(String(order.side)) ||
        !['market', 'limit', 'stop'].includes(String(order.type)) ||
        !Number.isSafeInteger(order.quantity) ||
        Number(order.quantity) < 1
      )
        throw new Error('Invalid saved order.')
      if (order.price !== undefined && order.price !== null) text(order.price)
      for (const field of ['reason', 'risk', 'exit', 'size_reason', 'max_loss'])
        text(plan[field])
      break
    }
    case 'cancel':
      text(command.orderId)
      break
    case 'advance':
      if (![1, 2, 3, 4, 5].includes(command.steps as number))
        throw new Error('Invalid advance size.')
      break
    case 'complete':
      text(command.reflection)
      break
    case 'abandon':
      break
    default:
      throw new Error('Unknown saved command.')
  }
  return command as ChallengeCommand
}

export class ChallengeJournal {
  private readonly storage: ChallengeStorage
  private readonly key: string
  private readonly owner: string

  constructor(owner: string, storage: ChallengeStorage) {
    this.owner = text(owner)
    this.storage = storage
    this.key = `trading-challenge:v1:${encodeURIComponent(owner)}`
  }

  read(): ChallengeJournalEntry {
    const raw = this.storage.getItem(this.key)
    if (raw === null) return { attemptId: null, pending: null }
    try {
      const saved = object(JSON.parse(raw))
      if (saved.version !== 1 || saved.owner !== this.owner)
        throw new Error('Invalid journal owner or version.')
      const attemptId = saved.attemptId === null ? null : text(saved.attemptId)
      const pending =
        saved.pending === null ? null : parseCommand(saved.pending)
      if (
        pending &&
        pending.kind !== 'start' &&
        pending.attemptId !== attemptId
      )
        throw new Error('The saved command targets a different attempt.')
      return { attemptId, pending }
    } catch {
      throw new Error(
        'The saved challenge command could not be read. Keep this tab open and inspect the saved attempt before clearing browser data.',
      )
    }
  }

  write(entry: ChallengeJournalEntry) {
    this.storage.setItem(
      this.key,
      JSON.stringify({ version: 1, owner: this.owner, ...entry }),
    )
  }
}
