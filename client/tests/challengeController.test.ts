import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ChallengeController } from '../controllers/challengeController.ts'
import { ChallengeJournal } from '../services/challengeJournal.ts'
import type {
  Challenge,
  ChallengeCommand,
  ChallengeOrder,
} from '../services/challengeService.ts'
import { HttpError } from '../services/httpService.ts'
import {
  challenge,
  completedChallenge,
  memoryStorage,
} from './challengeFixtures.ts'

function setup(storage = memoryStorage()) {
  const world = {
    current: challenge(),
    owner: 'owner' as string | null,
    commands: [] as ChallengeCommand[],
    reads: [] as string[],
    receipts: new Map<string, Challenge>(),
    failAfterCommit: false,
    failRead: false,
  }
  const transport = {
    async get(id: string) {
      world.reads.push(id)
      if (world.failRead) throw new HttpError('Offline', 'network')
      return structuredClone(world.current)
    },
    async execute(command: ChallengeCommand) {
      world.commands.push(structuredClone(command))
      const receipt = world.receipts.get(command.key)
      if (receipt) return structuredClone(receipt)
      switch (command.kind) {
        case 'start':
          world.current = challenge()
          break
        case 'advance':
          world.current = challenge(world.current.player.tick + command.steps)
          break
        case 'complete':
          world.current = completedChallenge()
          break
        case 'abandon':
          world.current.status = 'abandoned'
          world.current.player.finished = true
          break
      }
      world.receipts.set(command.key, structuredClone(world.current))
      if (world.failAfterCommit) throw new HttpError('Response lost', 'network')
      return structuredClone(world.current)
    },
  }
  const create = () =>
    new ChallengeController({
      ownerId: 'owner',
      getOwnerId: () => world.owner,
      storage,
      transport,
    })
  return { world, transport, storage, create, controller: create() }
}

const order: ChallengeOrder = {
  symbol: 'NORTH',
  side: 'buy',
  type: 'market',
  quantity: 1,
  plan: {
    reason: 'Apply the written investment thesis',
    risk: 'Prices may fall after purchase',
    exit: 'Review after five observations',
    size_reason: 'Limit exposure to a small position',
    max_loss: '10.00',
  },
}

test('start saves an attempt for reload and publishes active state', async () => {
  const { controller, world, create } = setup()
  const phases: string[] = []
  const unsubscribe = controller.subscribe(() =>
    phases.push(controller.getSnapshot().phase),
  )

  await controller.start()
  unsubscribe()
  const reloaded = create()
  await reloaded.recover()

  assert.equal(reloaded.getSnapshot().challenge?.id, 'attempt-one')
  assert.equal(world.commands.length, 1)
  assert.equal(controller.getSnapshot().phase, 'active')
  assert.deepEqual(phases, ['submitting', 'loading', 'active'])
})

test('lost start response retries the same command after reload without creating another attempt', async () => {
  const { controller, world, create } = setup()
  world.failAfterCommit = true
  await assert.rejects(controller.start(), { kind: 'network' })
  assert.equal(controller.getSnapshot().phase, 'recovery')
  const reloaded = create()

  await reloaded.recover()

  assert.deepEqual(world.commands[1], world.commands[0])
  assert.equal(world.receipts.size, 1)
  assert.equal(reloaded.getSnapshot().phase, 'active')
})

test('lost order response freezes its original written plan across retry', async () => {
  const { controller, world, create } = setup()
  await controller.start()
  const input = structuredClone(order)
  world.failAfterCommit = true
  await assert.rejects(controller.submitOrder(input), { kind: 'network' })
  input.plan.reason = 'A replacement plan that must not be submitted'
  const reloaded = create()

  await reloaded.recover()

  assert.deepEqual(world.commands[2], world.commands[1])
  assert.equal(world.commands[2].kind, 'order')
  if (world.commands[2].kind === 'order')
    assert.deepEqual(world.commands[2].order, order)
})

test('new mutations are blocked while a command remains uncertain', async () => {
  const { controller, world } = setup()
  await controller.start()
  world.failAfterCommit = true
  await assert.rejects(controller.advance(), { kind: 'network' })

  await assert.rejects(
    controller.submitOrder(order),
    /Recover the pending command/,
  )

  assert.equal(world.commands.length, 2)
})

test('replayed receipt is followed by a fresh read rather than restoring its stale tick', async () => {
  const { controller, world } = setup()
  await controller.start()
  world.failAfterCommit = true
  await assert.rejects(controller.advance(), { kind: 'network' })
  world.current = challenge(9)

  await controller.recover()

  assert.equal(controller.getSnapshot().challenge?.player.tick, 9)
  assert.equal(world.commands.length, 3)
})

test('failed fresh read after acknowledgement does not repeat a successful mutation', async () => {
  const { controller, world } = setup()
  world.failRead = true
  await assert.rejects(controller.start(), { kind: 'network' })
  assert.equal(controller.getSnapshot().pending, false)
  world.failRead = false

  await controller.recover()

  assert.equal(world.commands.length, 1)
  assert.equal(controller.getSnapshot().phase, 'active')
})

test('simultaneous mutation is rejected before another request is sent', async () => {
  const { controller, world } = setup()
  const first = controller.start()

  await assert.rejects(controller.start(), /already in progress/)
  await first

  assert.equal(world.commands.length, 1)
})

test('409 refreshes authoritative state and releases the rejected command', async () => {
  const { controller, world, transport, storage } = setup()
  await controller.start()
  transport.execute = async () => {
    throw new HttpError('Conflict', 'http', 409)
  }
  world.current = challenge(5)

  await assert.rejects(controller.advance(), { status: 409 })

  assert.equal(controller.getSnapshot().challenge?.player.tick, 5)
  assert.equal(controller.getSnapshot().pending, false)
  assert.equal(new ChallengeJournal('owner', storage).read().pending, null)
  assert.equal(world.reads.length, 2)
})

test('422 permits a corrected command with a new key after recovering current state', async () => {
  const { controller, world, transport } = setup()
  await controller.start()
  const execute = transport.execute
  let rejectedKey = ''
  transport.execute = async (command) => {
    rejectedKey = command.key
    throw new HttpError('Invalid plan', 'http', 422)
  }
  await assert.rejects(controller.submitOrder(order), { status: 422 })
  transport.execute = execute
  await controller.recover()

  await controller.submitOrder(order)

  assert.notEqual(world.commands.at(-1)?.key, rejectedKey)
})

test('401 keeps the pending command for reauthentication by the same owner', async () => {
  const { controller, world, transport } = setup()
  await controller.start()
  world.failAfterCommit = true
  await assert.rejects(controller.advance(), { kind: 'network' })
  const execute = transport.execute
  transport.execute = async () => {
    throw new HttpError('Expired', 'http', 401)
  }
  await assert.rejects(controller.recover(), { status: 401 })
  assert.equal(controller.getSnapshot().pending, true)
  transport.execute = execute

  await controller.recover()

  assert.deepEqual(world.commands[2], world.commands[1])
})

test('final observation requires reflection and completion uses the frozen server result', async () => {
  const { controller, world } = setup()
  world.current = challenge(29)
  await controller.recover('attempt-one')
  assert.equal(controller.getSnapshot().phase, 'reflection')
  await assert.rejects(controller.advance(), /final observation/)
  await controller.recover()

  await controller.complete(
    'I followed the written plan and compared outcomes after costs.',
  )

  assert.equal(controller.getSnapshot().phase, 'completed')
  assert.deepEqual(
    controller.getSnapshot().challenge?.result,
    completedChallenge().result,
  )
  await assert.rejects(
    controller.submitOrder(order),
    /Load an active challenge/,
  )
})

test('abandonment publishes terminal state without a result', async () => {
  const { controller } = setup()
  await controller.start()

  await controller.abandon()

  assert.equal(controller.getSnapshot().phase, 'abandoned')
  assert.equal(controller.getSnapshot().challenge?.result, null)
})

test('storage failure before submission sends no request', async () => {
  const { world, transport } = setup()
  const controller = new ChallengeController({
    ownerId: 'owner',
    getOwnerId: () => 'owner',
    transport,
    storage: {
      getItem: () => null,
      setItem: () => {
        throw new Error('Storage full')
      },
    },
  })

  await assert.rejects(controller.start(), /Storage full/)

  assert.equal(world.commands.length, 0)
})

test('corrupt saved command is retained and never replaced by a new mutation', async () => {
  const { controller, storage, world } = setup()
  const key = 'trading-challenge:v1:owner'
  storage.setItem(key, '{broken')

  await assert.rejects(controller.recover(), /could not be read/)
  await assert.rejects(controller.start(), /could not be read/)

  assert.equal(storage.getItem(key), '{broken')
  assert.equal(world.commands.length, 0)
})

test('journals belonging to another owner cannot be replayed by this controller', async () => {
  const { controller, storage, world } = setup()
  new ChallengeJournal('another-owner', storage).write({
    attemptId: null,
    pending: { kind: 'start', input: {}, key: 'another-command-key' },
  })

  await controller.recover()

  assert.equal(world.commands.length, 0)
  assert.equal(controller.getSnapshot().phase, 'idle')
})

test('account change during a request hides its result and retains the original owners recovery command', async () => {
  const { controller, transport, storage, world } = setup()
  const execute = transport.execute
  transport.execute = async (command) => {
    const result = await execute(command)
    world.owner = 'another-owner'
    return result
  }

  await assert.rejects(controller.start(), /signed-in player/)

  assert.equal(controller.getSnapshot().challenge, null)
  assert.notEqual(new ChallengeJournal('owner', storage).read().pending, null)
})

test('disposing a controller prevents an in-flight response from publishing state', async () => {
  const { controller, storage } = setup()
  const pending = controller.start()
  controller.dispose()

  await assert.rejects(pending, /signed-in player/)

  assert.equal(controller.getSnapshot().phase, 'idle')
  assert.equal(controller.getSnapshot().challenge, null)
  assert.notEqual(new ChallengeJournal('owner', storage).read().pending, null)
})

test('recovery cannot silently switch away from a different pending attempt', async () => {
  const { controller, world } = setup()
  await controller.start()
  world.failAfterCommit = true
  await assert.rejects(controller.advance(), { kind: 'network' })

  await assert.rejects(
    controller.recover('attempt-two'),
    /pending challenge command/,
  )

  assert.equal(world.commands.length, 2)
})

test('opening an attempt by URL saves its identity for subsequent reload', async () => {
  const { controller, create } = setup()
  await controller.recover('attempt-one')
  const reloaded = create()

  await reloaded.recover()

  assert.equal(reloaded.getSnapshot().challenge?.id, 'attempt-one')
})

test('failed acknowledgement write leaves the committed command recoverable after reload', async () => {
  const { controller, storage, world, create } = setup()
  await controller.start()
  const write = storage.setItem
  let writes = 0
  storage.setItem = (key, value) => {
    if (++writes === 2) throw new Error('Storage full')
    write(key, value)
  }
  await assert.rejects(controller.advance(), /Storage full/)
  const reloaded = create()

  await reloaded.recover()

  assert.deepEqual(world.commands[2], world.commands[1])
  assert.equal(reloaded.getSnapshot().challenge?.player.tick, 1)
})

test('server errors retain an uncertain command for exact retry', async () => {
  const { controller, world, transport } = setup()
  await controller.start()
  const execute = transport.execute
  let pending: ChallengeCommand | undefined
  transport.execute = async (command) => {
    pending = structuredClone(command)
    throw new HttpError('Unavailable', 'http', 503)
  }
  await assert.rejects(controller.advance(), { status: 503 })
  transport.execute = execute

  await controller.recover()

  assert.deepEqual(world.commands.at(-1), pending)
})

test('a cold controller resumes its saved attempt before allowing another start', async () => {
  const { controller, create, world } = setup()
  await controller.start()
  const reloaded = create()

  await assert.rejects(reloaded.start(), /Resume the saved challenge/)

  assert.equal(world.commands.length, 1)
})

test('trading before loading and completion before the final observation send no mutation', async () => {
  const { controller, world } = setup()
  await assert.rejects(
    controller.submitOrder(order),
    /Load an active challenge/,
  )
  await controller.start()

  await assert.rejects(
    controller.complete('I followed the plan and compared the final outcome.'),
    /final observation/,
  )

  assert.equal(world.commands.length, 1)
})

test('signed-out owner cannot issue a mutation through an existing controller', async () => {
  const { controller, world } = setup()
  await controller.start()
  world.owner = null

  await assert.rejects(controller.advance(), /signed-in player/)

  assert.equal(world.commands.length, 1)
  assert.equal(controller.getSnapshot().challenge, null)
})
