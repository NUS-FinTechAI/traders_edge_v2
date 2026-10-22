import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  canSubmitEmail,
  emailLooksValid,
  hidesAccount,
  signInErrorMessage,
} from '../features/auth/signIn.ts'
import { SignInSetupError } from '../services/firebaseService.ts'
import { HttpError } from '../services/httpService.ts'

function firebaseError(code: string) {
  return Object.assign(new Error(`Firebase: Error (${code}).`), { code })
}

test('wrong email or password gets one message that does not reveal which', () => {
  const messages = [
    'auth/invalid-credential',
    'auth/invalid-login-credentials',
    'auth/wrong-password',
    'auth/user-not-found',
  ].map((code) => signInErrorMessage(firebaseError(code)))
  assert.equal(new Set(messages).size, 1)
  assert.match(messages[0], /don’t match/)
})

test('each input problem names the field to fix', () => {
  assert.match(
    signInErrorMessage(firebaseError('auth/invalid-email')),
    /email address/,
  )
  assert.match(
    signInErrorMessage(firebaseError('auth/missing-email')),
    /Enter your email/,
  )
  assert.match(
    signInErrorMessage(firebaseError('auth/missing-password')),
    /Enter your password/,
  )
})

test('service and account problems get their own messages', () => {
  assert.match(
    signInErrorMessage(firebaseError('auth/network-request-failed')),
    /couldn’t reach the sign-in service/,
  )
  assert.match(
    signInErrorMessage(firebaseError('auth/user-disabled')),
    /turned off/,
  )
  assert.match(
    signInErrorMessage(firebaseError('auth/internal-error')),
    /sign-in service had a problem/,
  )
  assert.match(
    signInErrorMessage(firebaseError('auth/operation-not-allowed')),
    /isn’t turned on/,
  )
})

test('an unauthorised site names the Firebase setting to change', () => {
  assert.equal(
    signInErrorMessage(firebaseError('auth/unauthorized-domain')),
    'This site isn’t authorised for sign-in yet (Firebase authorized domains).',
  )
})

test('API key errors with variable codes are recognised', () => {
  assert.match(
    signInErrorMessage(
      firebaseError('auth/api-key-not-valid.-please-pass-a-valid-api-key.'),
    ),
    /Firebase API key/,
  )
  assert.match(
    signInErrorMessage(
      firebaseError(
        'auth/requests-from-referer-https://example.test-are-blocked.',
      ),
    ),
    /API key restrictions/,
  )
})

test('an unknown Firebase error includes its code for reporting', () => {
  assert.match(
    signInErrorMessage(firebaseError('auth/quota-exceeded')),
    /\(auth\/quota-exceeded\)/,
  )
})

test('a code matching an object property is treated as unknown', () => {
  assert.match(
    signInErrorMessage(firebaseError('constructor')),
    /\(constructor\)/,
  )
})

test('server answers keep their message and a silent server is explained', () => {
  assert.equal(
    signInErrorMessage(
      new HttpError('Sign-in could not be verified', 'http', 401),
    ),
    'Sign-in could not be verified',
  )
  assert.match(
    signInErrorMessage(new HttpError('Failed to fetch', 'network')),
    /game server didn’t answer/,
  )
})

test('setup errors show their own message', () => {
  assert.equal(
    signInErrorMessage(
      new SignInSetupError(
        'Account sign-in has not been configured for this site',
      ),
    ),
    'Account sign-in has not been configured for this site',
  )
})

test('an error without a code gets the generic message', () => {
  assert.match(
    signInErrorMessage(new TypeError('x is undefined')),
    /^We couldn’t sign you in\. Check your connection/,
  )
  assert.match(signInErrorMessage(null), /^We couldn’t sign you in\./)
})

test('only a missing account is hidden after a reset request', () => {
  assert.equal(hidesAccount(firebaseError('auth/user-not-found')), true)
  assert.equal(hidesAccount(firebaseError('auth/invalid-email')), false)
  assert.equal(hidesAccount(new Error('offline')), false)
})

test('emails are checked after trimming spaces', () => {
  assert.equal(emailLooksValid('  ann@example.com '), true)
  assert.equal(emailLooksValid('ann@example'), false)
  assert.equal(emailLooksValid('ann example@x.com'), false)
  assert.equal(emailLooksValid(''), false)
})

test('the email form needs a valid email and a long enough password', () => {
  assert.equal(canSubmitEmail('ann@example.com', 'x', false), true)
  assert.equal(canSubmitEmail('ann@example.com', '', false), false)
  assert.equal(canSubmitEmail('ann@', 'secret', false), false)
  assert.equal(canSubmitEmail('ann@example.com', '1234567', true), false)
  assert.equal(canSubmitEmail('ann@example.com', '12345678', true), true)
})
