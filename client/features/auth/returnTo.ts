/** Only same-site paths are valid return targets; anything else goes home. */
export function safeReturnTo(value: string | null, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//'))
    return fallback
  if (/[\\\s]/.test(value) || value.startsWith('/login')) return fallback
  return value
}
