import httpService, { HttpError, type HttpService } from './httpService.ts'
import { ApiClient } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import type { components } from '../api/api-types.ts'
import { waitForRequest } from './requestCancellation.ts'

export type PublicConfig = components['schemas']['PublicConfig']

export interface ConfigRequestOptions {
  signal?: AbortSignal
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export class ConfigService {
  private readonly api: ApiClient
  private cachedConfig?: PublicConfig
  private pendingConfig?: Promise<PublicConfig>

  constructor(http: HttpService = httpService) {
    this.api = new ApiClient(http)
  }

  async getConfig(options?: ConfigRequestOptions): Promise<PublicConfig> {
    if (options?.signal?.aborted) {
      throw new HttpError('Request cancelled', 'aborted')
    }

    if (this.cachedConfig) {
      return structuredClone(this.cachedConfig)
    }

    if (!this.pendingConfig) {
      this.pendingConfig = this.fetchConfig().finally(() => {
        this.pendingConfig = undefined
      })
    }
    return structuredClone(
      await waitForRequest(this.pendingConfig, options?.signal),
    )
  }

  private async fetchConfig(): Promise<PublicConfig> {
    const config = await this.api.call(apiEndpoints.getConfig)
    if (isRecord(config) && isRecord(config.auth)) {
      const { mode, firebase_project_id } = config.auth
      if (mode === 'guest' && firebase_project_id === null) {
        return this.cacheConfig({ auth: { mode, firebase_project_id } })
      }
      if (
        mode === 'firebase' &&
        typeof firebase_project_id === 'string' &&
        firebase_project_id.trim().length > 0
      ) {
        return this.cacheConfig({ auth: { mode, firebase_project_id } })
      }
    }
    throw new HttpError(
      'The server returned invalid public configuration',
      'invalid-response',
      200,
    )
  }

  private cacheConfig(config: PublicConfig): PublicConfig {
    this.cachedConfig = config
    return structuredClone(config)
  }
}

export const configService = new ConfigService()

export default configService
