#!/usr/bin/env node

// Check file targets in single-line Markdown links and reference definitions.
// External URLs, heading fragments and multiline links need review separately.
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const files = execFileSync('git', ['ls-files', '-z', '*.md'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean)
const failures = []
let checked = 0

function escaped(source, index) {
  let count = 0
  while (index > 0 && source[--index] === '\\') count += 1
  return count % 2 === 1
}

function destination(source, start) {
  let index = start
  while (/\s/.test(source[index] ?? '') && index < source.length) index += 1
  if (source[index] === '<') {
    for (let end = index + 1; end < source.length; end += 1) {
      if (source[end] === '>' && !escaped(source, end))
        return source.slice(index + 1, end)
    }
    return ''
  }
  const begin = index
  let depth = 0
  for (; index < source.length; index += 1) {
    const char = source[index]
    if (char === '\\') {
      index += 1
      continue
    }
    if (char === '(') depth += 1
    else if (char === ')') {
      if (depth === 0) break
      depth -= 1
    } else if (/\s/.test(char)) break
  }
  return source.slice(begin, index)
}

function checkTarget(file, line, target) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(target)) return
  const local = target.split(/[?#]/, 1)[0]
  if (!local) return
  let decoded
  try {
    decoded = decodeURIComponent(local).replace(/\\([\\ ()])/g, '$1')
  } catch {
    failures.push(`${file}:${line}: invalid link encoding: ${target}`)
    return
  }
  const destination = decoded.startsWith('/')
    ? path.join(root, decoded)
    : path.resolve(root, path.dirname(file), decoded)
  checked += 1
  if (!fs.existsSync(destination)) {
    failures.push(`${file}:${line}: missing local target: ${target}`)
  }
}

for (const file of files) {
  let fence = null
  const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n')
  for (const [index, source] of lines.entries()) {
    const marker = source.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (marker) {
      if (!fence) fence = marker[1]
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length)
        fence = null
      continue
    }
    if (fence) continue
    const line = source.replace(/(`+).*?\1/g, '')
    const links = line.matchAll(/\[((?:\\.|[^\]\\])*)\]\(/g)
    for (const link of links) {
      if (!escaped(line, link.index))
        checkTarget(
          file,
          index + 1,
          destination(line, link.index + link[0].length),
        )
    }
    const reference = line.match(/^\s{0,3}\[[^\]]+\]:\s*/)
    if (reference)
      checkTarget(file, index + 1, destination(line, reference[0].length))
  }
}

if (failures.length) {
  for (const failure of failures) console.error(failure)
  process.exitCode = 1
} else {
  console.log(
    `Checked ${checked} local file targets in ${files.length} Markdown files.`,
  )
}
