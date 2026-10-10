import httpService, { HttpError, type HttpService } from './httpService.ts'

export interface GuestSession {
  profile_id: string
  auth_mode: 'guest'
  expires_at: string
}

export interface UserProfile {
  id: string
  display_name: string
  leaderboard_opt_in: boolean
  analytics_opt_in: boolean
  xp: number
  completed_lesson_ids: string[]
  mastered_module_ids: string[]
  activity_days: string[]
  activity_timezone: 'UTC'
  due_review_count: number
  learning_only: true
}

export interface AuthRequestOptions {
  signal?: AbortSignal
}

export class AuthService {
  private readonly http: HttpService

  constructor() {
    this.http = httpService
  }

  startGuestSession(options?: AuthRequestOptions): Promise<GuestSession> {
    return this.http.post<GuestSession>('/api/session', undefined, {
      ...options,
      auth: 'none',
    })
  }

  async getProfile(options?: AuthRequestOptions): Promise<UserProfile> {
    const profile = await this.http.get<UserProfile>('/api/me/profile', options)
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
      await this.http.delete('/api/session', options)
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
