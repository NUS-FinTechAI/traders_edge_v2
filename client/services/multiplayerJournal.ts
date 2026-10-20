import type { MultiplayerCommand } from './multiplayerService.ts'
import { object, text, units } from '../utilities/typeUtils.ts'

export type MultiplayerStorage = Pick<Storage, 'getItem' | 'setItem'>
export type MultiplayerJournalEntry = {
  lobbyId: string | null
  pending: MultiplayerCommand | null
  joinCodes: Record<string, string>
}

function command(value: unknown): MultiplayerCommand {
  const saved = object(value)
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(text(saved.key)))
    throw new Error('Invalid command key')
  if (
    ['start', 'order', 'cancel', 'ready', 'complete', 'abandon'].includes(
      text(saved.kind),
    )
  )
    text(saved.lobbyId)
  if (
    ['order', 'cancel', 'ready'].includes(String(saved.kind)) &&
    units(saved.expectedTick) > 29
  )
    throw new Error('Invalid observation')
  switch (saved.kind) {
    case 'join':
      if (!/^[A-F0-9]{16}$/.test(text(saved.code)))
        throw new Error('Invalid code')
      break
    case 'order': {
      const order = object(saved.order),
        plan = object(order.plan)
      if (
        !['NORTH', 'HARBOR', 'PLAIN', 'COVE'].includes(text(order.symbol)) ||
        !['buy', 'sell'].includes(text(order.side)) ||
        !['market', 'limit', 'stop'].includes(text(order.type)) ||
        units(order.quantity) < 1 ||
        units(order.quantity) > 1000
      )
        throw new Error('Invalid order')
      if (order.type !== 'market') text(order.price)
      for (const field of ['reason', 'risk', 'exit', 'size_reason', 'max_loss'])
        text(plan[field])
      break
    }
    case 'cancel':
      text(saved.orderId)
      break
    case 'complete':
      text(saved.reflection)
      break
    case 'create':
    case 'queue':
    case 'start':
    case 'ready':
    case 'abandon':
      break
    default:
      throw new Error('Unknown saved action')
  }
  return saved as MultiplayerCommand
}

export class MultiplayerJournal {
  private readonly owner: string
  private readonly storage: MultiplayerStorage
  private readonly key: string
  constructor(owner: string, storage: MultiplayerStorage) {
    this.owner = text(owner)
    this.storage = storage
    this.key = `multiplayer:v1:${encodeURIComponent(owner)}`
  }
  read(): MultiplayerJournalEntry {
    const raw = this.storage.getItem(this.key)
    if (raw === null) return { lobbyId: null, pending: null, joinCodes: {} }
    try {
      const saved = object(JSON.parse(raw))
      if (saved.owner !== this.owner || saved.version !== 1)
        throw new Error('Wrong journal')
      const lobbyId = saved.lobbyId === null ? null : text(saved.lobbyId)
      const pending = saved.pending === null ? null : command(saved.pending)
      if (pending && 'lobbyId' in pending && pending.lobbyId !== lobbyId)
        throw new Error('Wrong match')
      const joinCodes: Record<string, string> = Object.create(null)
      for (const [id, code] of Object.entries(object(saved.joinCodes))) {
        if (!/^[A-F0-9]{16}$/.test(text(code)))
          throw new Error('Invalid saved code')
        joinCodes[id] = String(code)
      }
      return { lobbyId, pending, joinCodes }
    } catch {
      throw new Error(
        'The saved multiplayer action could not be read. Keep this tab and inspect your saved matches before clearing browser data.',
      )
    }
  }
  write(entry: MultiplayerJournalEntry) {
    this.storage.setItem(
      this.key,
      JSON.stringify({ version: 1, owner: this.owner, ...entry }),
    )
  }
}
