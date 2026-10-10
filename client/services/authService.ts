import httpService, { HttpError, type HttpService } from './httpService.ts'
import { ApiClient } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import type { components } from '../api/api-types.ts'
import configService from './configService.ts'
import firebaseService from './firebaseService.ts'

export type GuestSession = components['schemas']['GuestSession']
export type UserProfile = components['schemas']['UserProfile']

export interface AuthRequestOptions {
  signal?: AbortSignal
}

export class AuthService {
  private readonly api: ApiClient
  private readonly signOutIdentity?: () => Promise<void>
  private user: UserProfile | null = null
  private revision = 0
  private readonly listeners = new Set<() => void>()

  getUser = (): UserProfile | null => this.user

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private setUser(user: UserProfile | null): void {
    this.user = user
    for (const listener of this.listeners) listener()
  }

  constructor(
    http: HttpService = httpService,
    signOutIdentity?: () => Promise<void>,
  ) {
    this.api = new ApiClient(http)
    this.signOutIdentity = signOutIdentity
  }

  startGuestSession(options?: AuthRequestOptions): Promise<GuestSession> {
    return this.api.call(apiEndpoints.startGuestSession, options)
  }

  async getProfile(options?: AuthRequestOptions): Promise<UserProfile> {
    const revision = this.revision
    let profile: UserProfile
    try {
      profile = await this.api.call(apiEndpoints.getProfile, options)
    } catch (error) {
      if (this.isUnauthorized(error) && revision === this.revision)
        this.setUser(null)
      throw error
    }
    if (!profile || typeof profile.id !== 'string' || !profile.id) {
      throw new HttpError(
        'The server returned a profile without a valid identity',
        'invalid-response',
        200,
      )
    }
    if (revision === this.revision) this.setUser(profile)
    return profile
  }

  async isAuthenticated(options?: AuthRequestOptions): Promise<boolean> {
    try {
      await this.getProfile(options)
      return true
    } catch (error) {
      if (this.isUnauthorized(error)) return false
      throw error
    }
  }

  async logout(options?: AuthRequestOptions): Promise<void> {
    this.revision++
    try {
      await this.api.call(apiEndpoints.logout, options)
    } catch (error) {
      // An expired or missing session already has no authenticated access.
      if (!this.isUnauthorized(error)) throw error
    }
    await this.signOutIdentity?.()
    this.revision++
    this.setUser(null)
  }

  private isUnauthorized(error: unknown): boolean {
    return (
      error instanceof HttpError &&
      error.kind === 'http' &&
      error.status === 401
    )
  }
}

export const authService = new AuthService(httpService, async () => {
  if ((await configService.getConfig()).auth.mode === 'firebase') {
    await firebaseService.signOut()
  }
})

export default authService
