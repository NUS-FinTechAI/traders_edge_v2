import ErrorPanel from '../../error-panel/ErrorPanel.tsx'

export default function ReadError({
  error,
  fatal = false,
}: {
  error: unknown
  fatal?: boolean
}) {
  if (fatal) throw error
  return <ErrorPanel />
}
