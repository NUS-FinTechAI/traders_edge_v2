import { HttpError } from '../services/httpService.ts'

export function isEnumValue<
  E extends Readonly<Record<string, string | number | boolean | null>>,
>(enumeration: E, value: unknown): value is E[keyof E] {
  return Object.values(enumeration).some((member) => member === value)
}

export function text(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : invalid()
}

export function units(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : invalid()
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid()
  return value as Record<string, unknown>
}

function invalid(): never {
  throw new HttpError(
    'The server returned an invalid value.',
    'invalid-response',
  )
}
