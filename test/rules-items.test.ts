import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import YAML from 'yaml'
import { expect, it } from 'vitest'
import { extractItems } from '../src/rules/items.js'

const root = join(import.meta.dirname, '..')
const load = (l: string) => YAML.parse(readFileSync(join(root, 'locales', l, 'rules.yaml'), 'utf8'))
const fixture = (name: string) => YAML.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'rules', name), 'utf8'))

it('extracts tr_TR items (fixture copy, so maintainer edits do not break the test)', () => {
  const items = extractItems(fixture('tr_TR.yaml'), 'tr')
  expect(items.regexes.length).toBe(14)
  expect(items.fixes).toEqual([{ where: expect.stringMatching(/^patterns\[\d+\]$/), find: expect.stringContaining('([Yy])ada'), replace: '$1a da', flags: 'gu', tag: 'tr' }])
  expect(items.prompts.map((p) => p.where)).toEqual(expect.arrayContaining(['guidance', 'capitalization', 'register.audit', 'register.translate', 'mistakes[0].note', 'mistakes[0].right', 'patterns[0].note']))
})

it('live tr_TR rules keep their shape', () => {
  const items = extractItems(load('tr_TR'), 'tr')
  expect(items.regexes.length).toBeGreaterThanOrEqual(1)
  for (const f of items.fixes) expect(f.find !== undefined || f.text !== undefined, f.where).toBe(true)
})

it('every live rules file yields items without throwing', () => {
  for (const l of readdirSync(join(root, 'locales'))) {
    let doc: unknown
    try { doc = load(l) } catch { continue }
    expect(() => extractItems(doc), l).not.toThrow()
  }
})

it('extracts sentenceEnd regexes', () => {
  expect(extractItems(load('el')).regexes.map((r) => r.where)).toEqual(['sentenceEnd.answers[0].text', 'sentenceEnd.answers[0].source'])
  expect(extractItems(load('th')).regexes.map((r) => r.where)).toEqual(['sentenceEnd.notEnding'])
})

it('extracts when conditions and text fixes', () => {
  const items = extractItems({ patterns: [{ text: 'a  b', replace: 'a b', level: 'fix', when: { notSource: 'x' } }] }, 'tr')
  expect(items.fixes).toEqual([{ where: 'patterns[0]', text: 'a  b', replace: 'a b', flags: 'gu', tag: 'tr' }])
  expect(items.whens).toEqual([{ where: 'patterns[0].when', notSource: 'x' }])
})

it('takes flags from ignoreCase as polyglots does, and u for sentenceEnd', () => {
  const items = extractItems({
    patterns: [{ find: 'a', ignoreCase: true }, { find: 'b' }, { find: 'c', ignoreCase: true, replace: 'd', level: 'fix' }, { text: 'e', ignoreCase: false, replace: 'f', level: 'fix' }],
    sentenceEnd: { notEnding: '\\.$' },
  })
  expect(items.regexes.map((r) => [r.where, r.flags])).toEqual([
    ['patterns[0].find', 'gui'], ['patterns[1].find', 'gu'], ['patterns[2].find', 'gui'], ['sentenceEnd.notEnding', 'u'],
  ])
  expect(items.fixes.map((f) => f.flags)).toEqual(['gui', 'gu'])
})

it('adds the NFC form of a finding regex that polyglots also runs', () => {
  const items = extractItems({ patterns: [{ find: 'e\u0301' }, { find: 'e\u0301', replace: 'x', level: 'fix' }] })
  expect(items.regexes).toEqual([
    { where: 'patterns[0].find', source: 'e\u0301', flags: 'gu' },
    { where: 'patterns[0].find (NFC)', source: '\u00e9', flags: 'gu', derived: true },
    { where: 'patterns[1].find', source: 'e\u0301', flags: 'gu' },
  ])
})
