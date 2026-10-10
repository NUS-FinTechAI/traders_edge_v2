import httpService, {
  type HttpService,
  type RequestOptions,
} from '../services/httpService.ts'
import type { operations } from './api-contract.ts'
import { apiEndpoints } from './api-endpoints.ts'

type Endpoint = (typeof apiEndpoints)[keyof typeof apiEndpoints]
type Value<T, K extends PropertyKey> = K extends keyof T
  ? NonNullable<T[K]>
  : never
type ParametersFor<O, K extends PropertyKey> = Value<Value<O, 'parameters'>, K>
type ParameterOption<K extends PropertyKey, T> = [T] extends [never]
  ? { [P in K]?: never }
  : {} extends T
    ? { [P in K]?: T }
    : { [P in K]: T }
type JsonBody<T> = T extends { content: { 'application/json': infer B } }
  ? B
  : never
type BodyOption<O> = O extends { requestBody: unknown }
  ? { body: JsonBody<O['requestBody']> }
  : { body?: JsonBody<Value<O, 'requestBody'>> }
type CallOptions<O> = Pick<RequestOptions, 'signal'> &
  ParameterOption<'path', ParametersFor<O, 'path'>> &
  ParameterOption<'query', ParametersFor<O, 'query'>> &
  BodyOption<O>
type CallArguments<O> =
  {} extends CallOptions<O>
    ? [options?: CallOptions<O>]
    : [options: CallOptions<O>]
type SuccessResponse<R> = {
  [S in keyof R]: `${S & (string | number)}` extends `2${string}`
    ? R[S] extends { content: { 'application/json': infer T } }
      ? T
      : void
    : never
}[keyof R]

export class ApiClient {
  private readonly http: HttpService

  constructor(http: HttpService = httpService) {
    this.http = http
  }

  call<E extends Endpoint>(
    endpoint: E,
    ...args: CallArguments<operations[NoInfer<E['operationId']>]>
  ): Promise<SuccessResponse<operations[E['operationId']]['responses']>> {
    const options = (args[0] ?? {}) as {
      path?: Record<string, string | number>
      query?: RequestOptions['query']
      body?: unknown
      signal?: AbortSignal
    }
    const url = endpoint.path.replace(
      /\{([^}]+)\}/g,
      (_placeholder, key: string) => {
        const value = options.path?.[key]
        if (value === undefined || value === null)
          throw new TypeError(`Missing path parameter: ${key}`)
        const encoded = encodeURIComponent(String(value))
        if (encoded === '.' || encoded === '..')
          throw new TypeError('Path parameters cannot be dot segments')
        return encoded
      },
    )
    return this.http.request(url, {
      method: endpoint.method,
      auth: endpoint.auth,
      query: options.query,
      body: options.body,
      signal: options.signal,
    })
  }
}

export const api = new ApiClient()
