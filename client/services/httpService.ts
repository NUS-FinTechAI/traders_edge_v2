export type HttpErrorKind = 'http' | 'network' | 'aborted' | 'invalid-response'

export class HttpError extends Error {
  readonly kind: HttpErrorKind
  readonly status: number | null
  readonly details: unknown

  constructor(
    message: string,
    kind: HttpErrorKind,
    status: number | null = null,
    details?: unknown,
    cause?: unknown,
  ) {
    super(message, { cause })
    this.name = 'HttpError'
    this.kind = kind
    this.status = status
    this.details = details
  }
}

type QueryValue = string | number | boolean | null | undefined

export interface RequestOptions {
  query?: Record<string, QueryValue | readonly QueryValue[]>
  headers?: HeadersInit
  signal?: AbortSignal
  auth?: 'required' | 'none'
}

export interface HttpServiceOptions {
  baseUrl: string
  credentials?: RequestCredentials
  getAccessToken?: () => Promise<string | null>
  onUnauthorized?: (error: HttpError) => void
}

export interface HttpRequestOptions extends RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
}

export class HttpService {
  private readonly baseUrl: URL
  private readonly config: HttpServiceOptions

  constructor(config: HttpServiceOptions) {
    this.baseUrl = new URL(config.baseUrl)
    this.config = config

    if (
      !['http:', 'https:'].includes(this.baseUrl.protocol) ||
      this.baseUrl.username ||
      this.baseUrl.password ||
      this.baseUrl.pathname !== '/' ||
      this.baseUrl.search ||
      this.baseUrl.hash
    ) {
      throw new TypeError('The API base URL must be an HTTP(S) origin')
    }
  }

  get<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' })
  }

  post<T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', body })
  }

  patch<T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PATCH', body })
  }

  delete<T = void>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' })
  }

  async request<T = unknown>(
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<T> {
    const url = this.buildUrl(path, options.query)
    const method = options.method ?? 'GET'
    if (method === 'GET' && options.body !== undefined) {
      throw new TypeError('GET requests cannot have a body')
    }

    const body =
      options.body === undefined ? undefined : JSON.stringify(options.body)
    this.throwIfAborted(options.signal)
    const headers = await this.buildHeaders(options, body !== undefined)
    this.throwIfAborted(options.signal)

    const { response, text } = await this.sendRequest(url, {
      method,
      headers,
      body,
      signal: options.signal,
      credentials: this.config.credentials ?? 'include',
      cache: 'no-store',
      redirect: 'error',
    })

    const data = this.parseJson(response, text)
    if (!response.ok) {
      this.handleHttpError(response, data, options.auth !== 'none')
    }
    return data as T
  }

  private buildUrl(path: string, query?: RequestOptions['query']): URL {
    if (
      !path.startsWith('/') ||
      path.startsWith('//') ||
      /[\\\s#]/.test(path)
    ) {
      throw new TypeError('Use a server-relative path, such as /api/me/profile')
    }
    const url = new URL(path, this.baseUrl)
    if (url.origin !== this.baseUrl.origin) {
      throw new TypeError('Requests must target the configured API origin')
    }
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null) continue
      url.searchParams.delete(key)
      for (const entry of Array.isArray(value) ? value : [value]) {
        if (entry !== undefined && entry !== null) {
          url.searchParams.append(key, String(entry))
        }
      }
    }
    return url
  }

  private async buildHeaders(
    options: RequestOptions,
    hasBody: boolean,
  ): Promise<Headers> {
    const headers = new Headers(options.headers)
    headers.set('Accept', 'application/json')
    if (hasBody) headers.set('Content-Type', 'application/json')

    // Authentication headers belong to the service, never individual callers.
    headers.delete('Authorization')
    if (options.auth !== 'none' && this.config.getAccessToken) {
      const token = await this.config.getAccessToken()
      if (token) headers.set('Authorization', `Bearer ${token}`)
    }
    return headers
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw new HttpError(
        'Request cancelled',
        'aborted',
        null,
        undefined,
        signal.reason,
      )
    }
  }

  private async sendRequest(
    url: URL,
    options: RequestInit,
  ): Promise<{ response: Response; text: string }> {
    try {
      const response = await fetch(url, options)
      const text = response.status === 204 ? '' : await response.text()
      return { response, text }
    } catch (cause) {
      const aborted =
        options.signal?.aborted ||
        (cause instanceof Error && cause.name === 'AbortError')
      throw new HttpError(
        aborted ? 'Request cancelled' : 'Unable to reach the server',
        aborted ? 'aborted' : 'network',
        null,
        undefined,
        cause,
      )
    }
  }

  private parseJson(response: Response, text: string): unknown {
    if (!text) return undefined

    try {
      return JSON.parse(text)
    } catch (cause) {
      if (response.ok) {
        throw new HttpError(
          'The server returned invalid JSON',
          'invalid-response',
          response.status,
          undefined,
          cause,
        )
      }
      // Proxy error pages must still retain their HTTP status.
      return undefined
    }
  }

  private handleHttpError(
    response: Response,
    data: unknown,
    authenticated: boolean,
  ): never {
    const details =
      data && typeof data === 'object' && 'detail' in data ? data.detail : data
    const error = new HttpError(
      this.getErrorMessage(details, response.status),
      'http',
      response.status,
      details,
    )

    if (
      response.status === 401 &&
      authenticated &&
      this.config.onUnauthorized
    ) {
      try {
        this.config.onUnauthorized(error)
      } catch {
        // A subscriber failure must not replace the server's authentication error.
        throw error
      }
    }
    throw error
  }

  private getErrorMessage(details: unknown, status: number): string {
    if (typeof details === 'string') return details
    if (Array.isArray(details)) {
      const messages = details.flatMap((item) =>
        item && typeof item.msg === 'string' ? [item.msg] : [],
      )
      if (messages.length) return messages.join('; ')
    }
    return `Request failed (${status})`
  }
}

export const httpService = new HttpService({
  baseUrl: import.meta.env?.VITE_BACKEND_URL || 'http://localhost:8000',
})

export default httpService
