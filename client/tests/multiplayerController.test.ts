import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MultiplayerController } from '../controllers/multiplayerController.ts'
import { MultiplayerJournal } from '../services/multiplayerJournal.ts'
import { HttpError } from '../services/httpService.ts'
import type {
  MultiplayerCommand,
  MultiplayerMatch,
} from '../services/multiplayerService.ts'
import {
  multiplayer,
  plannedOrder,
  memoryStorage,
} from './fixtures/multiplayerFixtures.ts'

function setup(storage = memoryStorage()) {
  const world = {
    current: multiplayer(),
    owner: 'owner' as string | null,
    commands: [] as MultiplayerCommand[],
    receipts: new Map<string, MultiplayerMatch>(),
    lost: false,
    stale: false,
    failRead: false,
    onReply: null as (() => Promise<void>) | null,
  }
  const transport = {
    async get() {
      if (world.failRead) throw new HttpError('Offline', 'network')
      return structuredClone(world.current)
    },
    async execute(command: MultiplayerCommand) {
      world.commands.push(structuredClone(command))
      const receipt = world.receipts.get(command.key)
      if (receipt) return structuredClone(receipt)
      if (world.stale) {
        world.current = multiplayer(1)
        throw new HttpError('Stale observation', 'http', 409)
      }
      if (command.kind === 'create')
        world.current = { ...multiplayer(null), join_code: 'AABBCCDDEEFF0011' }
      if (command.kind === 'ready') world.current.participants[0].ready = true
      if (command.kind === 'abandon')
        world.current.participants[0].forfeit = true
      world.receipts.set(command.key, structuredClone(world.current))
      await world.onReply?.()
      if (world.lost)
        throw new HttpError('Response lost after commit', 'network')
      return structuredClone(world.current)
    },
  }
  const create = () =>
    new MultiplayerController({
      owner: 'owner',
      getOwner: () => world.owner,
      storage,
      transport,
    })
  return { world, storage, create, controller: create() }
}

test('a lost readiness response survives reload without automatically readying the next observation', async () => {
  const { world, controller, create } = setup()
  await controller.load('match-one')
  world.lost = true
  await assert.rejects(controller.ready(), { kind: 'network' })
  world.current = multiplayer(1)
  const reloaded = create()
  await reloaded.load('match-one')
  assert.equal(world.commands.length, 1)
  assert.equal(reloaded.getSnapshot().pending, true)

  await reloaded.retry()

  assert.deepEqual(world.commands[1], world.commands[0])
  assert.equal(world.receipts.size, 1)
  assert.equal(reloaded.getSnapshot().match?.player?.tick, 1)
  assert.equal(reloaded.getSnapshot().match?.participants[0].ready, false)
  assert.equal(reloaded.getSnapshot().pending, false)
})

test('stale readiness refreshes the observation and requires an explicit new decision', async () => {
  const { world, controller, storage } = setup()
  await controller.load('match-one')
  world.stale = true

  await assert.rejects(controller.ready(), { status: 409 })

  assert.equal(world.commands.length, 1)
  assert.equal(controller.getSnapshot().match?.player?.tick, 1)
  assert.equal(new MultiplayerJournal('owner', storage).read().pending, null)
  await controller.load('match-one')
  assert.equal(world.commands.length, 1)
  world.stale = false
  await controller.ready()
  assert.equal(world.commands[1].kind, 'ready')
  assert.equal(
    'expectedTick' in world.commands[1] && world.commands[1].expectedTick,
    1,
  )
  assert.notEqual(world.commands[0].key, world.commands[1].key)
})

test('ready participants cannot place another order before the shared market advances', async () => {
  const { world, controller } = setup()
  await controller.load('match-one')
  await controller.ready()

  await assert.rejects(
    controller.order(plannedOrder),
    /Wait for a new observation/,
  )

  assert.equal(world.commands.length, 1)
})

test('a lost planned order retains every plan field and the original observed tick', async () => {
  const { world, controller, create } = setup()
  await controller.load('match-one')
  world.lost = true
  await assert.rejects(controller.order(plannedOrder))
  world.current = multiplayer(2)

  await create().retry()

  assert.deepEqual(world.commands[0], world.commands[1])
  assert.equal(world.commands[1].kind, 'order')
  assert.equal(
    'expectedTick' in world.commands[1] && world.commands[1].expectedTick,
    0,
  )
  assert.deepEqual(
    'order' in world.commands[1] && world.commands[1].order,
    plannedOrder,
  )
})

test('the private host code survives the post-creation current-state read and reload', async () => {
  const { controller, create, world } = setup()
  await controller.create()
  delete world.current.join_code
  const reloaded = create()

  await reloaded.load('match-one')

  assert.equal(reloaded.getSnapshot().joinCode, 'AABBCCDDEEFF0011')
})

test('storage failure prevents any unrepeatable multiplayer mutation', async () => {
  const storage = {
    ...memoryStorage(),
    setItem() {
      throw new Error('Storage unavailable')
    },
  }
  const { controller, world } = setup(storage)

  await assert.rejects(controller.create(), /Storage unavailable/)

  assert.equal(world.commands.length, 0)
})

test('saved actions remain isolated between authenticated owners', async () => {
  const { controller, storage, world } = setup()
  world.lost = true
  await assert.rejects(controller.create())

  assert.equal(
    new MultiplayerJournal('another-owner', storage).read().pending,
    null,
  )
  assert.equal(
    new MultiplayerJournal('owner', storage).read().pending?.kind,
    'create',
  )
})

test('an owner change during a delayed match read clears the previous personal state', async () => {
  const { controller, world } = setup()
  await controller.load('match-one')
  world.owner = 'another-owner'

  await assert.rejects(
    controller.load('match-one'),
    /different signed-in session/,
  )

  assert.equal(controller.getSnapshot().match, null)
  assert.equal(world.commands.length, 0)
})

test('an uncertain action blocks a different action until its exact receipt is recovered', async () => {
  const { controller, world } = setup()
  await controller.load('match-one')
  world.lost = true
  await assert.rejects(controller.order(plannedOrder))

  await assert.rejects(controller.abandon(), /Confirm the saved action/)

  assert.equal(world.commands.length, 1)
})

test('two same-owner tabs cannot overwrite an in-flight command whose response is lost', async () => {
  const { controller, create, world, storage } = setup()
  let start!: () => void
  let release!: () => void
  const started = new Promise<void>((resolve) => {
    start = resolve
  })
  const reply = new Promise<void>((resolve) => {
    release = resolve
  })
  world.lost = true
  world.onReply = async () => {
    start()
    await reply
  }
  const first = assert.rejects(controller.create(), { kind: 'network' })
  await started
  const second = assert.rejects(create().queue(), /Confirm the saved action/)

  release()
  await Promise.all([first, second])

  assert.equal(world.commands.length, 1)
  assert.deepEqual(
    new MultiplayerJournal('owner', storage).read().pending,
    world.commands[0],
  )
})

test('a confirmed receipt followed by a failed current read is refreshed without resending', async () => {
  const { controller, world, create } = setup()
  await controller.load('match-one')
  world.failRead = true
  await assert.rejects(controller.order(plannedOrder), { kind: 'network' })
  assert.equal(controller.getSnapshot().pending, false)
  world.failRead = false

  await create().load('match-one')

  assert.equal(world.commands.length, 1)
})

test('a malformed saved observation cannot become a fresh readiness command', () => {
  const storage = memoryStorage()
  new MultiplayerJournal('owner', storage).write({
    lobbyId: 'match-one',
    joinCodes: {},
    pending: {
      kind: 'ready',
      lobbyId: 'match-one',
      expectedTick: -1,
      key: 'invalid-observation-key',
    },
  })
  assert.throws(
    () => new MultiplayerJournal('owner', storage).read(),
    /could not be read/,
  )
})
