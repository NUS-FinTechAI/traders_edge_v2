import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadJourney } from '../services/journeyService.ts'
import type { ApiClient } from '../api/apiClient.ts'
import { apiEndpoints } from '../api/api-endpoints.ts'

test('a journey read forwards cancellation and returns the signed-in owner’s workflow', async () => {
  const controller = new AbortController()
  const workflow = {
    profile: { id: 'owner' },
    game_next_action: { kind: 'chapter_exit_boss' },
  }
  let calls = 0
  const client = {
    async call(endpoint: unknown, options: { signal: AbortSignal }) {
      calls++
      assert.equal(endpoint, apiEndpoints.getLearningWorkflow)
      assert.equal(options.signal, controller.signal)
      return workflow
    },
  } as unknown as ApiClient

  const result = await loadJourney(
    'owner',
    controller.signal,
    client,
    () => 'owner',
  )

  assert.equal(result, workflow)
  assert.equal(calls, 1)
})

test('a known account change blocks a stale journey request before it is sent', async () => {
  let calls = 0
  const client = {
    async call() {
      calls++
      throw new Error('Unexpected request')
    },
  } as unknown as ApiClient

  await assert.rejects(
    loadJourney('owner', undefined, client, () => 'other'),
    /signed-in player changed/,
  )

  assert.equal(calls, 0)
})

test('an account change during a journey request withholds the old workflow', async () => {
  let owner = 'owner'
  const client = {
    async call() {
      owner = 'other'
      return { profile: { id: 'owner' } }
    },
  } as unknown as ApiClient

  await assert.rejects(
    loadJourney('owner', undefined, client, () => owner),
    /signed-in player changed/,
  )
})

test('a journey response with another profile is rejected before it can be displayed', async () => {
  const client = {
    async call() {
      return { profile: { id: 'other' } }
    },
  } as unknown as ApiClient

  await assert.rejects(
    loadJourney('owner', undefined, client, () => 'owner'),
    /another player/,
  )
})
