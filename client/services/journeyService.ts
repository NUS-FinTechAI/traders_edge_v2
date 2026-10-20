import { api, type ApiClient } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'
import authService from './authService.ts'

export async function loadJourney(
  owner: string,
  signal?: AbortSignal,
  client: ApiClient = api,
  getOwnerId: () => string | null = () => authService.getUser()?.id ?? null,
) {
  function checkOwner() {
    if (getOwnerId() !== owner)
      throw new Error(
        'The signed-in player changed. Open your current journey to continue.',
      )
  }
  checkOwner()
  const workflow = await client.call(apiEndpoints.getLearningWorkflow, {
    signal,
  })
  signal?.throwIfAborted()
  checkOwner()
  if (workflow.profile.id !== owner)
    throw new Error('This saved journey belongs to another player.')
  return workflow
}
