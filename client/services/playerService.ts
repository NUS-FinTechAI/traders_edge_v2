import { api, type ApiClient } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import type { components } from '../api/api-types.ts'
import { HttpError } from './httpService.ts'
import authService from './authService.ts'

export type Wallet = components['schemas']['EconomyState']
export type RewardItem = components['schemas']['RewardItem']
export type PlayerAction =
  | { kind: 'login' }
  | { kind: 'refresh' }
  | { kind: 'purchase'; itemId: string }
  | { kind: 'claim'; itemId: string }
  | { kind: 'equip'; slot: 'avatar_id' | 'title_id'; itemId: string | null }
type Command = { owner: string; key: string; action: PlayerAction }
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
export type PlayerOwner = { id: string; getOwnerId: () => string | null }

function requireOwner(owner: PlayerOwner) {
  if (owner.getOwnerId() !== owner.id)
    throw new Error(
      'The signed-in player changed. Open the current player record before continuing.',
    )
}

function invalid(): never {
  throw new HttpError(
    'The saved player action could not be verified.',
    'invalid-response',
  )
}
function walletReceipt(value: unknown) {
  if (!value || typeof value !== 'object') return invalid()
  const wallet = value as Record<string, unknown>
  if (
    wallet.policy_version !== '1' ||
    !Number.isSafeInteger(wallet.stocks_balance) ||
    Number(wallet.stocks_balance) < 0 ||
    !Number.isSafeInteger(wallet.premium_balance) ||
    Number(wallet.premium_balance) < 0
  )
    return invalid()
}

function result<T>(value: PromiseSettledResult<T>) {
  return value.status === 'fulfilled'
    ? { status: 'ready' as const, data: value.value }
    : { status: 'error' as const, error: value.reason as unknown }
}

export async function loadPlayer(
  signal?: AbortSignal,
  client: ApiClient = api,
  owner?: PlayerOwner,
) {
  if (owner) requireOwner(owner)
  const [wallet, shop, inventory, reviews] = await Promise.allSettled([
    client.call(apiEndpoints.getEconomy, { signal }),
    client.call(apiEndpoints.getShop, { signal }),
    client.call(apiEndpoints.getRewardInventory, { signal }),
    client.call(apiEndpoints.listReviews, { signal }),
  ])
  signal?.throwIfAborted()
  if (owner) requireOwner(owner)
  return {
    wallet: result(wallet),
    shop: result(shop),
    inventory: result(inventory),
    reviews: result(reviews),
  }
}
export type PlayerData = Awaited<ReturnType<typeof loadPlayer>>

export class PlayerCommands {
  private readonly storage: Storage
  private readonly owner: string
  private readonly key: string
  private readonly client: ApiClient
  private readonly getOwnerId: () => string | null
  private busy = false

  constructor(
    owner: string,
    storage: Storage,
    client: ApiClient = api,
    getOwnerId: () => string | null = () => authService.getUser()?.id ?? null,
  ) {
    this.owner = owner
    this.storage = storage
    this.key = `player-command:v1:${encodeURIComponent(owner)}`
    this.client = client
    this.getOwnerId = getOwnerId
  }

  pending(): Command | null {
    const raw = this.storage.getItem(this.key)
    if (!raw) return null
    try {
      const saved: Command = JSON.parse(raw)
      const action = saved.action
      if (
        saved.owner !== this.owner ||
        !/^[A-Za-z0-9_-]{8,100}$/.test(saved.key) ||
        !action ||
        !['login', 'refresh', 'purchase', 'claim', 'equip'].includes(
          action.kind,
        ) ||
        ((action.kind === 'purchase' || action.kind === 'claim') &&
          (typeof action.itemId !== 'string' || !action.itemId)) ||
        (action.kind === 'equip' &&
          action.itemId !== null &&
          (typeof action.itemId !== 'string' || !action.itemId)) ||
        (action.kind === 'equip' &&
          !['avatar_id', 'title_id'].includes(action.slot))
      )
        throw new Error('Invalid saved command')
      return saved
    } catch {
      throw new Error(
        'The saved player action cannot be read. Keep the saved data and reload your player record before continuing.',
      )
    }
  }

  private async locked(task: () => Promise<void>) {
    requireOwner({ id: this.owner, getOwnerId: this.getOwnerId })
    if (this.busy) throw new Error('A player request is already in progress.')
    if (!globalThis.navigator?.locks)
      throw new Error(
        'This browser cannot safely save player actions across tabs. Use a browser with Web Locks support.',
      )
    this.busy = true
    try {
      await navigator.locks.request(
        `traders-edge-player:${this.owner}`,
        async () => {
          requireOwner({ id: this.owner, getOwnerId: this.getOwnerId })
          await task()
        },
      )
    } finally {
      this.busy = false
    }
  }

  submit(action: PlayerAction) {
    return this.locked(async () => {
      if (this.pending())
        throw new Error(
          'Confirm the saved player action before making another choice.',
        )
      const command: Command = {
        owner: this.owner,
        key: crypto.randomUUID(),
        action: structuredClone(action),
      }
      this.storage.setItem(this.key, JSON.stringify(command))
      await this.send(command)
    })
  }

  retry() {
    return this.locked(async () => {
      const saved = this.pending()
      if (!saved) throw new Error('There is no saved player action to confirm.')
      await this.send(saved)
    })
  }

  private async send(command: Command) {
    requireOwner({ id: this.owner, getOwnerId: this.getOwnerId })
    const body = { idempotency_key: command.key }
    try {
      const action = command.action
      switch (action.kind) {
        case 'login': {
          const receipt = await this.client.call(
            apiEndpoints.claimLoginReward,
            { body },
          )
          walletReceipt(receipt?.wallet)
          if (
            !receipt.awarded ||
            [
              receipt.awarded.stocks,
              receipt.awarded.premium,
              receipt.awarded.xp,
            ].some((value) => !Number.isSafeInteger(value) || value < 0)
          )
            return invalid()
          break
        }
        case 'refresh': {
          const receipt = await this.client.call(
            apiEndpoints.refreshDailyChallenge,
            { body },
          )
          walletReceipt(receipt?.wallet)
          if (
            !Number.isSafeInteger(receipt.spent?.premium) ||
            receipt.spent.premium < 0
          )
            return invalid()
          break
        }
        case 'purchase': {
          const receipt = await this.client.call(
            apiEndpoints.purchaseShopItem,
            {
              body: { ...body, item_id: action.itemId },
            },
          )
          walletReceipt(receipt?.wallet)
          if (receipt.item?.shop_id !== action.itemId) return invalid()
          break
        }
        case 'claim': {
          const receipt = await this.client.call(
            apiEndpoints.claimLearningReward,
            {
              body: { ...body, item_id: action.itemId },
            },
          )
          if (
            receipt?.item?.id !== action.itemId ||
            receipt.item.status !== 'owned'
          )
            return invalid()
          break
        }
        case 'equip': {
          const receipt = await this.client.call(
            apiEndpoints.updateRewardEquipment,
            {
              body: { ...body, [action.slot]: action.itemId },
            },
          )
          if (receipt?.equipment?.[action.slot] !== action.itemId)
            return invalid()
          break
        }
      }
      requireOwner({ id: this.owner, getOwnerId: this.getOwnerId })
      this.storage.removeItem(this.key)
    } catch (error) {
      requireOwner({ id: this.owner, getOwnerId: this.getOwnerId })
      if (
        error instanceof HttpError &&
        error.kind === 'http' &&
        [403, 404, 409, 422].includes(error.status ?? 0)
      )
        this.storage.removeItem(this.key)
      throw error
    }
  }
}

export function playerError(error: unknown) {
  if (error instanceof HttpError) {
    if (typeof error.details === 'string') return error.details
    if (error.status === 401)
      return 'Sign in again, then confirm your saved action.'
    if (error.status === 503)
      return 'This content is awaiting publication review.'
  }
  return error instanceof Error && !(error instanceof HttpError)
    ? error.message
    : 'The request could not be confirmed. Confirm the saved action before making another choice.'
}
