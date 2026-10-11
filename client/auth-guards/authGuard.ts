import authService from '../services/authService.ts'
import { redirect } from 'react-router-dom'

/**
 * Guard for handling authentication and redirecting unauthenticated users.
 * Certain actions or routes may require the user to be authenticated.
 */
export class AuthGuard {
  async canActivate(returnTo: URL, signal?: AbortSignal): Promise<boolean> {
    const authenticated = await authService.isAuthenticated({ signal })
    signal?.throwIfAborted()
    if (!authenticated) {
      this.redirectToLogin(returnTo)
    }

    return true
  }

  private redirectToLogin(returnTo: URL): never {
    throw redirect(
      `/login?returnTo=${encodeURIComponent(returnTo.pathname + returnTo.search + returnTo.hash)}`,
    )
  }

  loader = async ({ request }: { request: Request }) => {
    await this.canActivate(new URL(request.url), request.signal)
    const user = authService.getUser()
    if (!user) throw new Error('The authenticated profile could not be loaded.')
    return user
  }
}

export const authGuard = new AuthGuard()

export default authGuard
