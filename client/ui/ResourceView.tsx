import type { ReactNode } from 'react'
import { ErrorState, InlineError, Loading } from './States.tsx'
import type { Resource } from './useResource.ts'

/** Render loaded data, keeping it on screen while it refreshes. */
export default function ResourceView<T>({
  resource,
  label,
  children,
}: {
  resource: Resource<T>
  label?: string
  children: (data: T) => ReactNode
}) {
  if (resource.data !== undefined)
    return (
      <>
        {resource.status === 'error' && (
          <InlineError
            message={`Couldn’t refresh: ${resource.error}`}
            onRetry={resource.reload}
          />
        )}
        {children(resource.data)}
      </>
    )
  if (resource.status === 'error')
    return <ErrorState message={resource.error} onRetry={resource.reload} />
  return <Loading label={label} />
}
