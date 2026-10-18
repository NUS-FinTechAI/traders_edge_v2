import {
  challengeService,
  type Challenge,
  type ChallengeAction,
  type ChallengeCommand,
  type ChallengeOrder,
  type ChallengeService,
  type ChallengeStart,
} from '../services/challengeService.ts'
import {
  ChallengeJournal,
  type ChallengeStorage,
} from '../services/challengeJournal.ts'
import { HttpError } from '../services/httpService.ts'

export type ChallengePhase =
  | 'idle'
  | 'loading'
  | 'submitting'
  | 'recovery'
  | 'active'
  | 'reflection'
  | 'completed'
  | 'abandoned'
  | 'error'
export type ChallengeState = {
  phase: ChallengePhase
  challenge: Challenge | null
  pending: boolean
  error: unknown
}
type Transport = Pick<ChallengeService, 'get' | 'execute'>

export class ChallengeController {
  private readonly owner: string
  private readonly getOwnerId: () => string | null
  private readonly journal: ChallengeJournal
  private readonly transport: Transport
  private readonly listeners = new Set<() => void>()
  private busy = false
  private disposed = false
  private state: ChallengeState = {
    phase: 'idle',
    challenge: null,
    pending: false,
    error: null,
  }

  constructor(options: {
    ownerId: string
    getOwnerId: () => string | null
    storage: ChallengeStorage
    transport?: Transport
  }) {
    this.owner = options.ownerId
    this.getOwnerId = options.getOwnerId
    this.journal = new ChallengeJournal(this.owner, options.storage)
    this.transport = options.transport ?? challengeService
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
    this.setState({
      phase: 'idle',
      challenge: null,
      pending: false,
      error: null,
    })
    this.listeners.clear()
  }

  private setState(state: ChallengeState) {
    this.state = state
    for (const listener of this.listeners) {
      try {
        listener()
      } catch {
        /* Subscriber errors must not interrupt command recovery. */
      }
    }
  }

  private requireOwner() {
    if (this.disposed || this.getOwnerId() !== this.owner) {
      if (!this.disposed)
        this.setState({
          phase: 'idle',
          challenge: null,
          pending: false,
          error: null,
        })
      throw new Error(
        'The challenge controller no longer belongs to the signed-in player.',
      )
    }
  }

  private async run(task: () => Promise<void>) {
    this.requireOwner()
    if (this.busy)
      throw new Error('A challenge request is already in progress.')
    this.busy = true
    try {
      await task()
    } catch (error) {
      if (!this.disposed) {
        if (this.getOwnerId() === this.owner)
          this.setState({
            ...this.state,
            phase: this.state.pending ? 'recovery' : 'error',
            error,
          })
        else
          this.setState({
            phase: 'idle',
            challenge: null,
            pending: false,
            error: null,
          })
      }
      throw error
    } finally {
      this.busy = false
    }
  }

  private show(challenge: Challenge) {
    this.requireOwner()
    if (challenge.result && challenge.result.user_id !== this.owner)
      throw new HttpError(
        'The result belongs to another player.',
        'invalid-response',
      )
    this.setState({
      phase:
        challenge.status === 'active'
          ? challenge.player.tick === challenge.player.total_ticks - 1
            ? 'reflection'
            : 'active'
          : challenge.status,
      challenge,
      pending: false,
      error: null,
    })
  }

  private async readCurrent(attemptId: string) {
    this.requireOwner()
    const challenge = await this.transport.get(attemptId)
    this.requireOwner()
    this.show(challenge)
  }

  private async send(command: ChallengeCommand) {
    this.setState({
      ...this.state,
      phase: 'submitting',
      pending: true,
      error: null,
    })
    let result: Challenge
    try {
      this.requireOwner()
      result = await this.transport.execute(structuredClone(command))
    } catch (error) {
      this.requireOwner()
      if (
        error instanceof HttpError &&
        error.kind === 'http' &&
        [404, 409, 422].includes(error.status ?? 0)
      ) {
        const saved = this.journal.read()
        this.journal.write({ ...saved, pending: null })
        this.setState({ ...this.state, pending: false })
        if (error.status === 409 && saved.attemptId) {
          // A rejected command may have used an old observation; refresh before further actions.
          try {
            await this.readCurrent(saved.attemptId)
          } catch {
            /* The original rejection remains actionable. */
          }
        }
      }
      throw error
    }
    this.requireOwner()
    if (result.result && result.result.user_id !== this.owner)
      throw new HttpError(
        'The result belongs to another player.',
        'invalid-response',
      )
    // One storage write both acknowledges the command and retains its attempt for reload.
    this.journal.write({ attemptId: result.id, pending: null })
    this.setState({ ...this.state, phase: 'loading', pending: false })
    // A replay receipt can be older than current state, including after another tab advanced it.
    await this.readCurrent(result.id)
  }

  recover(attemptId?: string) {
    return this.run(async () => {
      const saved = this.journal.read()
      if (saved.pending) {
        if (
          attemptId &&
          (saved.pending.kind === 'start' ||
            saved.pending.attemptId !== attemptId)
        )
          throw new Error(
            'Recover the pending challenge command before opening another attempt.',
          )
        await this.send(saved.pending)
      } else {
        const target = attemptId ?? saved.attemptId
        if (!target) return
        this.setState({ ...this.state, phase: 'loading', error: null })
        await this.readCurrent(target)
        this.journal.write({ attemptId: target, pending: null })
      }
    })
  }

  private mutate(action: ChallengeAction) {
    return this.run(async () => {
      const saved = this.journal.read()
      if (saved.pending) {
        this.setState({ ...this.state, pending: true })
        throw new Error(
          'Recover the pending command before submitting another action.',
        )
      }
      if (action.kind === 'start') {
        if (
          this.state.challenge?.status === 'active' ||
          (saved.attemptId && !this.state.challenge)
        )
          throw new Error('Resume the saved challenge before starting another.')
      } else if (
        !this.state.challenge ||
        action.attemptId !== this.state.challenge.id ||
        this.state.challenge.status !== 'active' ||
        !['active', 'reflection'].includes(this.state.phase)
      ) {
        throw new Error('Load an active challenge before submitting an action.')
      }
      if (action.kind === 'complete' && this.state.phase !== 'reflection')
        throw new Error('Reach the final observation before reflecting.')
      if (action.kind === 'advance' && this.state.phase !== 'active')
        throw new Error('The final observation has already been reached.')
      const command = structuredClone({ ...action, key: crypto.randomUUID() })
      this.journal.write({
        attemptId: action.kind === 'start' ? saved.attemptId : action.attemptId,
        pending: command,
      })
      await this.send(command)
    })
  }

  start(input: ChallengeStart = {}) {
    return this.mutate({ kind: 'start', input })
  }
  submitOrder(order: ChallengeOrder) {
    return this.mutate({
      kind: 'order',
      attemptId: this.state.challenge?.id ?? '',
      order,
    })
  }
  cancelOrder(orderId: string) {
    return this.mutate({
      kind: 'cancel',
      attemptId: this.state.challenge?.id ?? '',
      orderId,
    })
  }
  advance(steps = 1) {
    return this.mutate({
      kind: 'advance',
      attemptId: this.state.challenge?.id ?? '',
      steps,
    })
  }
  complete(reflection: string) {
    return this.mutate({
      kind: 'complete',
      attemptId: this.state.challenge?.id ?? '',
      reflection,
    })
  }
  abandon() {
    return this.mutate({
      kind: 'abandon',
      attemptId: this.state.challenge?.id ?? '',
    })
  }
}
