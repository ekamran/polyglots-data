import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import YAML from 'yaml'
import { expect, it } from 'vitest'
import { extractItems } from '../src/rules/items.js'

const root = join(import.meta.dirname, '..')
const load = (l: string) => YAML.parse(readFileSync(join(root, 'locales', l, 'rules.yaml'), 'utf8'))

it('extracts tr_TR items', () => {
  const items = extractItems(load('tr_TR'))
  expect(items.regexes.length).toBe(14)
  expect(items.fixes).toEqual([{ where: expect.stringMatching(/^patterns\[\d+\]$/), find: expect.stringContaining('([Yy])ada'), replace: '$1a da' }])
  expect(items.prompts.map((p) => p.where)).toEqual(expect.arrayContaining(['guidance', 'capitalization', 'register.audit', 'register.translate', 'mistakes[0].note', 'mistakes[0].right', 'patterns[0].note']))
})

it('extracts sentenceEnd regexes', () => {
  expect(extractItems(load('el')).regexes.map((r) => r.where)).toEqual(['sentenceEnd.answers[0].text', 'sentenceEnd.answers[0].source'])
  expect(extractItems(load('th')).regexes.map((r) => r.where)).toEqual(['sentenceEnd.notEnding'])
})

it('extracts when conditions and text fixes', () => {
  const items = extractItems({ patterns: [{ text: 'a  b', replace: 'a b', level: 'fix', when: { notSource: 'x' } }] })
  expect(items.fixes).toEqual([{ where: 'patterns[0]', text: 'a  b', replace: 'a b' }])
  expect(items.whens).toEqual([{ where: 'patterns[0].when', notSource: 'x' }])
})
