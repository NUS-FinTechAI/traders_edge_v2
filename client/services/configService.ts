import httpService, { HttpError, type HttpService } from './httpService.ts'
import { ApiClient } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import type { components } from '../api/api-types.ts'

export type PublicConfig = components['schemas']['PublicConfig']

export interface ConfigRequestOptions {
  signal?: AbortSignal
}

function waitForRequest<T>(
  request: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) return request
  if (signal.aborted)
    return Promise.reject(new HttpError('Request cancelled', 'aborted'))
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new HttpError('Request cancelled', 'aborted'))
    signal.addEventListener('abort', abort, { once: true })
    void request.then(
      (value) => {
        signal.removeEventListener('abort', abort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort)
        reject(error)
      },
    )
  })
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
    this.cachedConfig = config
    return structuredClone(config)
  }
}

export const configService = new ConfigService()

export default configService
