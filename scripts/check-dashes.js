#!/usr/bin/env node

// Fails when a tracked text file contains an em dash. Owner inputs under
// docs/source/ and docs/game-design.md are left as supplied.

const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..')
const EM_DASH = String.fromCodePoint(0x2014)
const exempt = (file) =>
  file.startsWith('docs/source/') || file === 'docs/game-design.md'

const files = execFileSync('git', ['ls-files', '-z'], {
  cwd: repoRoot,
  encoding: 'utf8',
})
  .split('\0')
  .filter((file) => file && !exempt(file))

const hits = []
for (const file of files) {
  const buffer = fs.readFileSync(path.join(repoRoot, file))
  if (buffer.includes(0)) continue
  buffer
    .toString('utf8')
    .split('\n')
    .forEach((line, index) => {
      if (line.includes(EM_DASH)) hits.push(`${file}:${index + 1}`)
    })
}

if (hits.length) {
  console.error('Em dashes found; use a comma, colon, full stop or brackets:')
  for (const hit of hits) console.error(`  ${hit}`)
  process.exit(1)
}
console.log('No em dashes.')
