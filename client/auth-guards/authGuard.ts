import authService from '../services/authService.ts'

/**
 * Guard for handling authentication and redirecting unauthenticated users.
 * Certain actions or routes may require the user to be authenticated.
 */
export class AuthGuard {
  async canActivate(): Promise<boolean> {
    const authenticated = await authService.isAuthenticated()
    if (!authenticated) {
      // TODO: Redirect to sign-in page
      window.location.replace('/')
      return false
    }

    return true
  }
}

export const authGuard = new AuthGuard()

export default authGuard
