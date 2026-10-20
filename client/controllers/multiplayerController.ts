import {
  multiplayerService,
  type MultiplayerAction,
  type MultiplayerCommand,
  type MultiplayerMatch,
  type MultiplayerService,
  type MultiplayerOrder,
} from '../services/multiplayerService.ts'
import {
  MultiplayerJournal,
  type MultiplayerStorage,
} from '../services/multiplayerJournal.ts'
import { HttpError } from '../services/httpService.ts'

type Transport = Pick<MultiplayerService, 'get' | 'execute'>
export type MultiplayerState = {
  match: MultiplayerMatch | null
  busy: boolean
  pending: boolean
  error: unknown
  joinCode: string | null
}

export class MultiplayerController {
  private readonly journal: MultiplayerJournal
  private readonly owner: string
  private readonly getOwner: () => string | null
  private readonly transport: Transport
  private readonly listeners = new Set<() => void>()
  private state: MultiplayerState = {
    match: null,
    busy: false,
    pending: false,
    error: null,
    joinCode: null,
  }
  private disposed = false
  constructor(options: {
    owner: string
    getOwner: () => string | null
    storage: MultiplayerStorage
    transport?: Transport
  }) {
    this.owner = options.owner
    this.getOwner = options.getOwner
    this.journal = new MultiplayerJournal(options.owner, options.storage)
    this.transport = options.transport ?? multiplayerService
  }
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  dispose() {
    this.disposed = true
    this.listeners.clear()
  }
  private publish(update: Partial<MultiplayerState>) {
    this.state = { ...this.state, ...update }
    for (const listener of this.listeners) {
      try {
        listener()
      } catch {
        /* Rendering must not interrupt receipt recovery. */
      }
    }
  }
  private requireOwner() {
    if (this.disposed || this.getOwner() !== this.owner) {
      if (!this.disposed)
        this.publish({ match: null, pending: false, joinCode: null })
      throw new Error('This match belongs to a different signed-in session.')
    }
  }
  private async run(task: () => Promise<void>) {
    this.requireOwner()
    if (this.state.busy) throw new Error('Wait for the current match request.')
    this.publish({ busy: true, error: null })
    try {
      await task()
    } catch (error) {
      if (!this.disposed && this.getOwner() === this.owner)
        this.publish({ error })
      throw error
    } finally {
      if (!this.disposed) this.publish({ busy: false })
    }
  }
  private async withCommandLock(task: () => Promise<void>) {
    if (!globalThis.navigator?.locks)
      throw new Error(
        'This browser cannot safely save multiplayer actions across tabs. Use a browser with Web Locks support.',
      )
    await navigator.locks.request(
      `traders-edge-multiplayer:${this.owner}`,
      async () => {
        this.requireOwner()
        await task()
      },
    )
  }
  private async read(lobbyId: string) {
    const match = await this.transport.get(lobbyId, this.owner)
    this.requireOwner()
    const saved = this.journal.read()
    this.publish({
      match,
      pending: saved.pending !== null,
      joinCode: saved.joinCodes[lobbyId] ?? null,
    })
  }
  load(lobbyId?: string) {
    return this.run(async () => {
      const saved = this.journal.read()
      this.publish({ pending: saved.pending !== null })
      if (
        saved.pending &&
        lobbyId &&
        (!('lobbyId' in saved.pending) || saved.pending.lobbyId !== lobbyId)
      )
        throw new Error(
          'Confirm the saved action in your previous match before opening another one.',
        )
      const target = lobbyId ?? saved.lobbyId
      if (target) await this.read(target)
    })
  }
  private async send(command: MultiplayerCommand) {
    let receipt: MultiplayerMatch
    try {
      receipt = await this.transport.execute(
        structuredClone(command),
        this.owner,
      )
    } catch (error) {
      this.requireOwner()
      if (
        error instanceof HttpError &&
        error.kind === 'http' &&
        [400, 403, 404, 409, 422, 429].includes(error.status ?? 0)
      ) {
        this.journal.write({ ...this.journal.read(), pending: null })
        this.publish({ pending: false })
        if (error.status === 409 && 'lobbyId' in command) {
          try {
            await this.read(command.lobbyId)
          } catch {
            /* Keep the rejected action visible. */
          }
        }
      }
      throw error
    }
    this.requireOwner()
    const saved = this.journal.read()
    const joinCodes = { ...saved.joinCodes }
    if (receipt.join_code) joinCodes[receipt.id] = receipt.join_code
    this.journal.write({ lobbyId: receipt.id, pending: null, joinCodes })
    this.publish({
      pending: false,
      match: receipt,
      joinCode: joinCodes[receipt.id] ?? null,
    })
    await this.read(receipt.id)
  }
  retry() {
    return this.run(() =>
      this.withCommandLock(async () => {
        const saved = this.journal.read()
        if (!saved.pending)
          throw new Error('There is no saved action to confirm.')
        await this.send(saved.pending)
      }),
    )
  }
  private mutate(action: MultiplayerAction) {
    return this.run(() =>
      this.withCommandLock(async () => {
        const saved = this.journal.read()
        if (saved.pending) {
          this.publish({ pending: true })
          throw new Error('Confirm the saved action before another decision.')
        }
        if ('lobbyId' in action && this.state.match?.id !== action.lobbyId)
          throw new Error('Refresh this match before acting.')
        if (
          action.kind === 'ready' ||
          action.kind === 'order' ||
          action.kind === 'cancel'
        ) {
          const match = this.state.match,
            own = match?.participants.find((p) => p.user_id === this.owner)
          if (
            match?.status !== 'active' ||
            !match.player ||
            !own ||
            own.ready ||
            own.forfeit ||
            own.departed
          )
            throw new Error(
              'Wait for a new observation before another decision.',
            )
        }
        const command = structuredClone({ ...action, key: crypto.randomUUID() })
        this.journal.write({
          ...saved,
          lobbyId: 'lobbyId' in action ? action.lobbyId : saved.lobbyId,
          pending: command,
        })
        this.publish({ pending: true })
        await this.send(command)
      }),
    )
  }
  create() {
    return this.mutate({ kind: 'create' })
  }
  join(code: string) {
    return this.mutate({ kind: 'join', code: code.trim().toUpperCase() })
  }
  queue() {
    return this.mutate({ kind: 'queue' })
  }
  start() {
    return this.mutate({ kind: 'start', lobbyId: this.state.match?.id ?? '' })
  }
  order(order: MultiplayerOrder) {
    return this.mutate({
      kind: 'order',
      lobbyId: this.state.match?.id ?? '',
      expectedTick: this.state.match?.player?.tick ?? -1,
      order,
    })
  }
  cancel(orderId: string) {
    return this.mutate({
      kind: 'cancel',
      lobbyId: this.state.match?.id ?? '',
      expectedTick: this.state.match?.player?.tick ?? -1,
      orderId,
    })
  }
  ready() {
    return this.mutate({
      kind: 'ready',
      lobbyId: this.state.match?.id ?? '',
      expectedTick: this.state.match?.player?.tick ?? -1,
    })
  }
  complete(reflection: string) {
    return this.mutate({
      kind: 'complete',
      lobbyId: this.state.match?.id ?? '',
      reflection,
    })
  }
  abandon() {
    return this.mutate({ kind: 'abandon', lobbyId: this.state.match?.id ?? '' })
  }
}
