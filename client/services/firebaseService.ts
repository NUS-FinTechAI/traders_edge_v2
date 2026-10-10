import type { Auth } from 'firebase/auth'
import type { PublicConfig } from './configService.ts'

export interface FirebaseWebConfig {
  apiKey?: string
  authDomain?: string
  appId?: string
}

export interface FirebaseSession {
  getAccessToken(): Promise<string | null>
  signInWithGoogle(): Promise<void>
  signInWithEmail(email: string, password: string): Promise<void>
  createAccount(email: string, password: string): Promise<void>
  signOut(): Promise<void>
}

type SessionFactory = (
  config: Required<FirebaseWebConfig> & { projectId: string },
) => Promise<FirebaseSession>

async function createSession(
  config: Required<FirebaseWebConfig> & { projectId: string },
): Promise<FirebaseSession> {
  const { initializeApp, getApps } = await import('firebase/app')
  const sdk = await import('firebase/auth')
  const existing = getApps().find((app) => app.name === 'traders-edge')
  if (existing && existing.options.projectId !== config.projectId) {
    throw new Error('Firebase is initialized for a different project')
  }
  const auth: Auth = sdk.getAuth(
    existing ?? initializeApp(config, 'traders-edge'),
  )
  return {
    async getAccessToken() {
      await auth.authStateReady()
      return auth.currentUser ? auth.currentUser.getIdToken() : null
    },
    async signInWithGoogle() {
      await sdk.signInWithPopup(auth, new sdk.GoogleAuthProvider())
    },
    async signInWithEmail(email, password) {
      await sdk.signInWithEmailAndPassword(auth, email, password)
    },
    async createAccount(email, password) {
      await sdk.createUserWithEmailAndPassword(auth, email, password)
    },
    async signOut() {
      await sdk.signOut(auth)
    },
  }
}

export class FirebaseService {
  private session?: Promise<FirebaseSession>
  private readonly getConfig: () => Promise<PublicConfig>
  private readonly webConfig: FirebaseWebConfig
  private readonly createSession: SessionFactory

  constructor(
    getConfig: () => Promise<PublicConfig> = async () => {
      const { configService } = await import('./configService.ts')
      return configService.getConfig()
    },
    webConfig: FirebaseWebConfig = {
      apiKey: import.meta.env?.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN,
      appId: import.meta.env?.VITE_FIREBASE_APP_ID,
    },
    sessionFactory: SessionFactory = createSession,
  ) {
    this.getConfig = getConfig
    this.webConfig = webConfig
    this.createSession = sessionFactory
  }

  async getAccessToken(): Promise<string | null> {
    const config = await this.getConfig()
    if (config.auth.mode === 'guest') {
      return null
    }
    return (await this.getSession(config)).getAccessToken()
  }

  async signInWithGoogle(): Promise<void> {
    await (await this.requireSession()).signInWithGoogle()
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    await (await this.requireSession()).signInWithEmail(email.trim(), password)
  }

  async createAccount(email: string, password: string): Promise<void> {
    await (await this.requireSession()).createAccount(email.trim(), password)
  }

  async signOut(): Promise<void> {
    await (await this.requireSession()).signOut()
  }

  private async requireSession(): Promise<FirebaseSession> {
    const config = await this.getConfig()
    if (config.auth.mode !== 'firebase') {
      throw new Error('Account sign-in is unavailable in guest mode')
    }
    return this.getSession(config)
  }

  private getSession(config: PublicConfig): Promise<FirebaseSession> {
    if (config.auth.mode !== 'firebase') {
      throw new Error('Firebase is unavailable')
    }
    if (!this.session) {
      const { apiKey, authDomain, appId } = this.webConfig
      if (!apiKey?.trim() || !authDomain?.trim() || !appId?.trim()) {
        throw new Error('Account sign-in has not been configured for this site')
      }
      this.session = this.createSession({
        apiKey,
        authDomain,
        appId,
        projectId: config.auth.firebase_project_id,
      }).catch((error: unknown) => {
        this.session = undefined
        throw error
      })
    }
    return this.session
  }
}

export const firebaseService = new FirebaseService()
export default firebaseService
