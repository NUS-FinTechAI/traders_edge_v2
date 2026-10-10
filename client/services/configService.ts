import httpService, { HttpError, type HttpService } from './httpService.ts'

export interface PublicConfig {
  auth:
    | { mode: 'guest'; firebase_project_id: null }
    | { mode: 'firebase'; firebase_project_id: string }
}

export interface ConfigRequestOptions {
  signal?: AbortSignal
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export class ConfigService {
  private readonly http: HttpService

  constructor() {
    this.http = httpService
  }

  async getConfig(options?: ConfigRequestOptions): Promise<PublicConfig> {
    const config = await this.http.get<unknown>('/api/config', {
      ...options,
      auth: 'none',
    })
    if (isRecord(config) && isRecord(config.auth)) {
      const { mode, firebase_project_id } = config.auth
      if (mode === 'guest' && firebase_project_id === null) {
        return { auth: { mode, firebase_project_id } }
      }
      if (
        mode === 'firebase' &&
        typeof firebase_project_id === 'string' &&
        firebase_project_id.trim().length > 0
      ) {
        return { auth: { mode, firebase_project_id } }
      }
    }
    throw new HttpError(
      'The server returned invalid public configuration',
      'invalid-response',
      200,
    )
  }
}

export const configService = new ConfigService()

export default configService
