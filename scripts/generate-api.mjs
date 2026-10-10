import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildArtifacts, writeArtifacts } from './api-artifacts.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const check = process.argv.includes('--check')
const schema = JSON.parse(
  execFileSync(
    'uv',
    [
      'run',
      '--project',
      'server',
      '--locked',
      'python',
      '-m',
      'app.export_openapi',
    ],
    { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  ),
)
const { outputs, coverage } = await buildArtifacts(schema, root)
const stale = await writeArtifacts(root, outputs, check)
console.log(
  `${coverage.operation_count} operations; ${coverage.unspecified_success_responses.length} success responses still need schemas (see client/api/api-coverage.json).`,
)
if (stale.length) {
  for (const filename of stale)
    console.error(`Stale or missing generated file: ${filename}`)
  console.error('Run npm run api:generate and commit the generated changes.')
  process.exitCode = 1
}
