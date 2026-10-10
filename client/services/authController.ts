import authService, { type UserProfile } from './authService.ts'
import configService, { type PublicConfig } from './configService.ts'
import { HttpError } from './httpService.ts'

export interface AuthSnapshot {
  user: UserProfile | null
  config: PublicConfig | null
  status: 'loading' | 'signed-in' | 'signed-out' | 'unavailable'
  error: string
  signingOut: boolean
}

export class AuthController {
  private snapshot: AuthSnapshot = {
    user: null,
    config: null,
    status: 'loading',
    error: '',
    signingOut: false,
  }
  private readonly listeners = new Set<() => void>()
  private readonly auth: Pick<typeof authService, 'getProfile' | 'logout'>
  private readonly config: Pick<typeof configService, 'getConfig'>
  private startup?: Promise<void>
  private pendingProfile?: Promise<UserProfile | null>
  private pendingLogout?: Promise<void>
  private revision = 0

  constructor(
    auth: Pick<typeof authService, 'getProfile' | 'logout'> = authService,
    config: Pick<typeof configService, 'getConfig'> = configService,
  ) {
    this.auth = auth
    this.config = config
  }

  getSnapshot = (): AuthSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private update(changes: Partial<AuthSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...changes }
    for (const listener of this.listeners) listener()
  }

  initialize = (): Promise<void> => {
    if (!this.startup) {
      const revision = this.revision
      this.update({ status: 'loading', error: '' })
      this.startup = (async () => {
        try {
          const config = await this.config.getConfig()
          if (revision !== this.revision) return
          this.update({ config })
          await this.refreshUser()
        } catch (error) {
          if (revision === this.revision) {
            this.startup = undefined
            this.update({
              status: 'unavailable',
              error: 'Unable to load sign-in. Please try again.',
            })
          }
          throw error
        }
      })()
    }
    return this.startup
  }

  retry = (): Promise<void> => {
    if (this.snapshot.status === 'unavailable') this.startup = undefined
    return this.initialize()
  }

  refreshUser = (): Promise<UserProfile | null> => {
    if (this.pendingLogout)
      return Promise.reject(new Error('Sign-out is in progress'))
    if (!this.pendingProfile) {
      const revision = this.revision
      const request = (async () => {
        try {
          const user = await this.auth.getProfile()
          if (revision === this.revision)
            this.update({ user, status: 'signed-in', error: '' })
          return user
        } catch (error) {
          if (
            error instanceof HttpError &&
            error.kind === 'http' &&
            error.status === 401
          ) {
            if (revision === this.revision)
              this.update({ user: null, status: 'signed-out', error: '' })
            return null
          }
          if (revision === this.revision)
            this.update({
              status: 'unavailable',
              error: 'Unable to check your sign-in. Please try again.',
            })
          throw error
        } finally {
          if (revision === this.revision) this.pendingProfile = undefined
        }
      })()
      this.pendingProfile = request
    }
    return this.pendingProfile
  }

  logout = (): Promise<void> => {
    if (!this.pendingLogout) {
      this.revision++
      this.pendingProfile = undefined
      this.update({ signingOut: true, error: '' })
      this.pendingLogout = (async () => {
        try {
          await this.auth.logout()
          this.update({ user: null, status: 'signed-out', error: '' })
        } catch (error) {
          this.update({ error: 'Unable to sign out. Please try again.' })
          throw error
        } finally {
          this.pendingLogout = undefined
          this.update({ signingOut: false })
        }
      })()
    }
    return this.pendingLogout
  }
}

export const authController = new AuthController()
