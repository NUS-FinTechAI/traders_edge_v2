import { SignInSetupError } from '../../services/firebaseService.ts'
import { HttpError } from '../../services/httpService.ts'

/** Shown after a reset request whether or not the account exists. */
export const RESET_SENT =
  'If an account exists for that email, we’ve sent a reset link. Check your inbox and spam folder.'

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'That email and password don’t match. Try again.',
  'auth/invalid-login-credentials':
    'That email and password don’t match. Try again.',
  'auth/wrong-password': 'That email and password don’t match. Try again.',
  'auth/user-not-found': 'That email and password don’t match. Try again.',
  'auth/invalid-email': 'That email address doesn’t look right. Check it.',
  'auth/missing-email': 'Enter your email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/email-already-in-use':
    'That email already has an account. Try signing in.',
  'auth/weak-password': 'Pick a stronger password (at least 8 characters).',
  'auth/password-does-not-meet-requirements':
    'Pick a stronger password (at least 8 characters).',
  'auth/user-disabled': 'This account has been turned off.',
  'auth/popup-closed-by-user': 'Google sign-in was closed. You can try again.',
  'auth/cancelled-popup-request':
    'Google sign-in was closed. You can try again.',
  'auth/popup-blocked':
    'Your browser blocked the sign-in window. Allow pop-ups and retry.',
  'auth/too-many-requests': 'Too many tries. Wait a moment and try again.',
  'auth/network-request-failed':
    'We couldn’t reach the sign-in service. Check your connection and try again.',
  'auth/internal-error':
    'The sign-in service had a problem. Try again in a moment.',
  'auth/operation-not-allowed':
    'This sign-in method isn’t turned on for this site yet. Try another one.',
  'auth/unauthorized-domain':
    'This site isn’t authorised for sign-in yet (Firebase authorized domains).',
  'auth/invalid-api-key':
    'Sign-in isn’t set up correctly for this site (Firebase API key).',
}

function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error)
    return typeof error.code === 'string' ? error.code : ''
  return ''
}

/** A plain message for a failed sign-in, sign-up or reset request. */
export function signInErrorMessage(error: unknown): string {
  const code = errorCode(error)
  if (Object.hasOwn(MESSAGES, code)) return MESSAGES[code]
  // The API key's own errors carry a long, variable code.
  if (code.startsWith('auth/api-key-not-valid'))
    return MESSAGES['auth/invalid-api-key']
  if (/^auth\/requests-from-referer-.*-are-blocked/.test(code))
    return 'This site isn’t allowed to use the sign-in service yet (API key restrictions).'
  if (error instanceof SignInSetupError) return error.message
  if (error instanceof HttpError) {
    if (error.kind === 'http') return error.message
    if (error.kind === 'network')
      return 'The game server didn’t answer. Check your connection and try again.'
  }
  if (code)
    return `We couldn’t sign you in (${code}). Try again, and report this code if it keeps happening.`
  return 'We couldn’t sign you in. Check your connection and try again.'
}

/** True for a reset failure that must not reveal whether the account exists. */
export function hidesAccount(error: unknown): boolean {
  return errorCode(error) === 'auth/user-not-found'
}

/** Light check before asking Firebase; it rejects anything it disagrees with. */
export function emailLooksValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/** The email form may be sent once the email looks valid and the password is long enough. */
export function canSubmitEmail(
  email: string,
  password: string,
  register: boolean,
): boolean {
  return emailLooksValid(email) && password.length >= (register ? 8 : 1)
}
