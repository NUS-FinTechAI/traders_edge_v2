import { useCallback, useEffect, useRef, useState } from 'react'
import { QuizCommands } from '../../services/quizCommands.ts'
import authService from '../../services/authService.ts'
import type {
  QuizAction,
  QuizCommandResult,
} from '../../services/quizService.ts'
import { readQuizAsOwner } from '../../services/quizService.ts'

export function useQuizRead<T>(
  owner: string,
  load: (signal: AbortSignal) => Promise<T>,
) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; data: T }
    | { status: 'error'; error: unknown }
  >({ status: 'loading' })
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => {
    setState({ status: 'loading' })
    setRevision((value) => value + 1)
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    void readQuizAsOwner(
      owner,
      () => authService.getUser()?.id ?? null,
      () => load(controller.signal),
    ).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: 'ready', data })
      },
      (error) => {
        if (!controller.signal.aborted) setState({ status: 'error', error })
      },
    )
    return () => controller.abort()
  }, [owner, load, revision])
  return { state, reload }
}

export function useQuizCommands(owner: string) {
  const [initial] = useState(() => {
    try {
      const commands = new QuizCommands(
        owner,
        sessionStorage,
        () => authService.getUser()?.id ?? null,
      )
      return { commands, pending: !!commands.pending(), error: null as unknown }
    } catch (error) {
      return { commands: null, pending: true, error }
    }
  })
  const [pending, setPending] = useState(initial.pending)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(initial.error)
  const mounted = useRef(true)
  const inFlight = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  async function perform(
    action?: QuizAction,
  ): Promise<QuizCommandResult | null> {
    if (!initial.commands || inFlight.current) return null
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const result = action
        ? await initial.commands.submit(action)
        : await initial.commands.retry()
      if (!mounted.current) return null
      setPending(false)
      return result
    } catch (failure) {
      if (mounted.current) {
        setError(failure)
        try {
          setPending(!!initial.commands.pending())
        } catch {
          setPending(true)
        }
      }
      return null
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }
  return {
    perform,
    pending,
    busy,
    error,
    recoverable: !!initial.commands,
    disabled: busy || pending || !initial.commands,
  }
}
