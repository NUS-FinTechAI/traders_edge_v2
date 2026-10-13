import { HttpError } from '../services/httpService.ts'

export function text(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : invalid()
}

export function amount(value: unknown): string {
  return typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value)
    ? value
    : invalid()
}

export function units(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : invalid()
}

export function list<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) return invalid()
  return value.map(parse)
}

export function choice<T extends string>(
  value: unknown,
  choices: readonly T[],
): T {
  if (typeof value !== 'string' || !choices.includes(value as T))
    return invalid()
  return value as T
}

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid()
  return value as Record<string, unknown>
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid()
  return value as Record<string, unknown>
}

export function boolean(value: unknown): boolean {
  return typeof value === 'boolean' ? value : invalid()
}

export function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : invalid()
}

export function string(value: unknown): string {
  return typeof value === 'string' ? value : invalid()
}

function invalid(): never {
  throw new HttpError(
    'The server returned an invalid value.',
    'invalid-response',
  )
}
