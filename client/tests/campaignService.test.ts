import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as campaign from '../services/campaignService.ts'
import { stubHttp } from './helpers/serviceHttp.ts'

for (const [name, load, path, response] of [
  ['campaign', campaign.getCampaign, '/api/campaign', { chapters: [] }],
  [
    'chapter map',
    (signal?: AbortSignal) => campaign.getChapterMap('ch/a ?#', signal),
    '/api/campaign/chapters/ch%2Fa%20%3F%23',
    { nodes: [] },
  ],
  [
    'level',
    (signal?: AbortSignal) => campaign.getLevel('level/a ?#', signal),
    '/api/campaign/levels/level%2Fa%20%3F%23',
    { id: 'level/a ?#' },
  ],
  ['archive', campaign.getArchive, '/api/archive', { terms: [] }],
] as const) {
  test(`loading ${name} uses its endpoint and forwards cancellation`, async (t) => {
    const requests = stubHttp(t, response)
    const controller = new AbortController()

    const result = await load(controller.signal)

    assert.deepEqual(result, response)
    assert.equal(requests.length, 1)
    assert.equal(requests[0].url.pathname, path)
    assert.equal(requests[0].method, 'GET')
    assert.equal(requests[0].signal, controller.signal)
  })
}

test('checking an answer sends question and option IDs for the encoded level', async (t) => {
  const response = { correct: false, feedback: 'Try again' }
  const requests = stubHttp(t, response)

  const result = await campaign.checkAnswer('level/a', 'question', 'option')

  assert.deepEqual(result, response)
  assert.equal(requests[0].url.pathname, '/api/campaign/levels/level%2Fa/check')
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].body, {
    question_id: 'question',
    option_id: 'option',
  })
})

test('completing a check posts to the encoded level completion endpoint', async (t) => {
  const response = { completed: true }
  const requests = stubHttp(t, response)

  const result = await campaign.completeCheck('level/a')

  assert.deepEqual(result, response)
  assert.equal(
    requests[0].url.pathname,
    '/api/campaign/levels/level%2Fa/check/complete',
  )
  assert.equal(requests[0].method, 'POST')
})

for (const body of [
  { mode: 'level', level_id: 'ch1-l1' },
  { mode: 'boss', chapter_id: 'ch1', boss: 'final' },
  { mode: 'daily' },
  { mode: 'practice', scenario_id: 'practice-trend' },
] as const) {
  test(`creating a ${body.mode} game retains its mode-specific fields`, async (t) => {
    const requests = stubHttp(t, { id: 'game-1' })

    const result = await campaign.createGame(body)

    assert.deepEqual(result, { id: 'game-1' })
    assert.equal(requests[0].url.pathname, '/api/games')
    assert.equal(requests[0].method, 'POST')
    assert.deepEqual(requests[0].body, body)
  })
}

test('a refused check completion propagates the server reason without retrying', async (t) => {
  const requests = stubHttp(t, { detail: 'Answer every question first' }, 409)

  await assert.rejects(campaign.completeCheck('level'), {
    status: 409,
    message: 'Answer every question first',
  })

  assert.equal(requests.length, 1)
})

test('an aborted campaign read does not reach the network', async (t) => {
  const requests = stubHttp(t)
  const controller = new AbortController()
  controller.abort()

  await assert.rejects(campaign.getCampaign(controller.signal), {
    kind: 'aborted',
  })

  assert.equal(requests.length, 0)
})
