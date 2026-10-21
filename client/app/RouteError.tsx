import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { ButtonLink } from '../ui/Button.tsx'
import { EmptyState } from '../ui/States.tsx'

export default function RouteError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? error.statusText
    : error instanceof Error
      ? error.message
      : 'This page could not be loaded.'
  return (
    <EmptyState
      icon="compass"
      title="We lost the trail"
      action={
        <ButtonLink to="/" icon="home">
          Back to camp
        </ButtonLink>
      }
    >
      {message}
    </EmptyState>
  )
}
