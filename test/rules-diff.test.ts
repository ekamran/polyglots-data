import { expect, it } from 'vitest'
import { diffItems } from '../src/check/rules-diff.js'

it('lists added and removed items', () => {
  const base = { regexes: [{ where: 'patterns[0].find', source: 'a' }], fixes: [], prompts: [{ where: 'guidance', text: 'old' }], whens: [] }
  const head = { regexes: [{ where: 'patterns[0].find', source: 'b' }], fixes: [], prompts: [{ where: 'guidance', text: 'old' }], whens: [{ where: 'patterns[0].when', notSource: 'x' }] }
  expect(diffItems(base, head)).toEqual([
    { kind: 'regex', where: 'patterns[0].find', change: 'removed', text: 'a' },
    { kind: 'regex', where: 'patterns[0].find', change: 'added', text: 'b' },
    { kind: 'when', where: 'patterns[0].when', change: 'added', text: 'notSource: x' },
  ])
})
