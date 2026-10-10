import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { buildArtifacts, writeArtifacts } from '../api-artifacts.mjs'

function schema() {
  return {
    openapi: '3.1.0',
    info: { title: 'Contract fixture', version: '1' },
    paths: {
      '/items': {
        get: {
          operationId: 'listItems',
          responses: {
            200: {
              description: 'Unspecified response',
              content: { 'application/json': { schema: {} } },
            },
          },
        },
      },
      '/config': {
        get: {
          operationId: 'getConfig',
          'x-client-auth': 'none',
          responses: {
            200: {
              description: 'Config',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['enabled'],
                    properties: { enabled: { type: 'boolean' } },
                  },
                },
              },
            },
          },
        },
      },
    },
  }
}

async function workspace(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'traders-edge-api-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return directory
}

test('repeated generation produces identical artifacts and reports unspecified responses', async (t) => {
  const root = await workspace(t)

  const first = await buildArtifacts(schema(), root)
  const second = await buildArtifacts(schema(), root)

  assert.deepEqual(second, first)
  assert.equal(first.coverage.operation_count, 2)
  assert.deepEqual(first.coverage.unspecified_success_responses, [
    { operationId: 'listItems', method: 'GET', path: '/items', status: '200' },
  ])
})

test('a backend operation change makes check fail without rewriting generated files', async (t) => {
  const root = await workspace(t)
  const first = await buildArtifacts(schema(), root)
  await writeArtifacts(root, first.outputs, false)
  const changed = schema()
  changed.paths['/config'].get.operationId = 'getPublicConfig'
  const next = await buildArtifacts(changed, root)

  const stale = await writeArtifacts(root, next.outputs, true)

  assert.deepEqual(stale, [
    'client/api/api-types.ts',
    'client/api/api-endpoints.ts',
  ])
  for (const [filename, expected] of Object.entries(first.outputs)) {
    assert.equal(await readFile(path.join(root, filename), 'utf8'), expected)
  }
})

test('check identifies missing generated files', async (t) => {
  const root = await workspace(t)
  const { outputs } = await buildArtifacts(schema(), root)

  const stale = await writeArtifacts(root, outputs, true)

  assert.deepEqual(stale, Object.keys(outputs))
})

test('check accepts Windows line endings without reporting contract changes', async (t) => {
  const root = await workspace(t)
  const { outputs } = await buildArtifacts(schema(), root)
  await writeArtifacts(root, outputs, false)
  for (const [filename, content] of Object.entries(outputs)) {
    await writeFile(path.join(root, filename), content.replace(/\n/g, '\r\n'))
  }

  const stale = await writeArtifacts(root, outputs, true)

  assert.deepEqual(stale, [])
})

test('duplicate operation IDs stop generation', async (t) => {
  const root = await workspace(t)
  const invalid = schema()
  invalid.paths['/items'].get.operationId = 'getConfig'

  await assert.rejects(buildArtifacts(invalid, root), /duplicate operationId/)
})
