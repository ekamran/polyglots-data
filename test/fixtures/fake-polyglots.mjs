#!/usr/bin/env node
// test/fixtures/fake-polyglots.mjs: stands in for `polyglots rules check --file <f> --json`.
import { readFileSync } from 'node:fs'
const args = process.argv.slice(2)
const i = args.indexOf('--file')
if (args[0] !== 'rules' || args[1] !== 'check' || i < 0 || !args.includes('--json')) process.exit(2)
const text = readFileSync(args[i + 1], 'utf8')
if (text.includes('INVALID')) {
  console.log(JSON.stringify({ valid: false, path: args[i + 1], error: 'unknown key INVALID', line: 2 }))
  process.exit(1)
}
const schema = Number(/^schema:\s*(\d+)/m.exec(text)?.[1] ?? 1)
console.log(JSON.stringify({ valid: true, path: args[i + 1], schema }))
