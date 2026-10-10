import httpService, { HttpError, type HttpService } from './httpService.ts'
import { ApiClient } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import type { components } from '../api/api-types.ts'

export type GuestSession = components['schemas']['GuestSession']
export type UserProfile = components['schemas']['UserProfile']

export interface AuthRequestOptions {
  signal?: AbortSignal
}

export class AuthService {
  private readonly api: ApiClient

  constructor(http: HttpService = httpService) {
    this.api = new ApiClient(http)
  }

  startGuestSession(options?: AuthRequestOptions): Promise<GuestSession> {
    return this.api.call(apiEndpoints.startGuestSession, options)
  }

  async getProfile(options?: AuthRequestOptions): Promise<UserProfile> {
    const profile = await this.api.call(apiEndpoints.getProfile, options)
    if (!profile || typeof profile.id !== 'string' || !profile.id) {
      throw new HttpError(
        'The server returned a profile without a valid identity',
        'invalid-response',
        200,
      )
    }
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
    try {
      await this.api.call(apiEndpoints.logout, options)
    } catch (error) {
      // An expired or missing session already has no authenticated access.
      if (!this.isUnauthorized(error)) throw error
    }
  }

  private isUnauthorized(error: unknown): boolean {
    return (
      error instanceof HttpError &&
      error.kind === 'http' &&
      error.status === 401
    )
  }
}

export const authService = new AuthService()

export default authService
