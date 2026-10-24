import assert from 'node:assert/strict'
import { test } from 'node:test'
import { singleFlight } from '../features/level/singleFlight.ts'

test('calls made while the action runs share one run', async () => {
  const slot = { current: null as Promise<number> | null }
  let runs = 0
  const finish = () =>
    singleFlight(slot, async () => {
      runs += 1
      await Promise.resolve()
      return runs
    })

  const results = await Promise.all([finish(), finish()])

  assert.equal(runs, 1)
  assert.deepEqual(results, [1, 1])
})

test('the action can run again once it has settled, including after a failure', async () => {
  const slot = { current: null as Promise<number> | null }
  let runs = 0
  const finish = () =>
    singleFlight(slot, async () => {
      runs += 1
      if (runs === 1) throw new Error('offline')
      return runs
    })

  await assert.rejects(finish(), /offline/)
  assert.equal(await finish(), 2)
})
