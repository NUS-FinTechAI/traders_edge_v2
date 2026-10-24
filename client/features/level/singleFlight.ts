/**
 * Runs an async action unless one is already running in `slot`, in which case
 * the caller shares that run. Finishing a check is not repeatable: the server
 * closes the run on the first call and rejects a second with a 409. The slot
 * is passed in (a React ref) so each call can use the latest closure.
 */
export function singleFlight<T>(
  slot: { current: Promise<T> | null },
  action: () => Promise<T>,
): Promise<T> {
  slot.current ??= action().finally(() => {
    slot.current = null
  })
  return slot.current
}
