import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import YAML from 'yaml'
import { expect, it } from 'vitest'
import { extractItems } from '../src/rules/items.js'
import { promptFindings } from '../src/rules/prompt-text.js'

it('the live prompt text has no error (warnings are allowed)', () => {
  const locales = join(import.meta.dirname, '..', 'locales')
  for (const l of readdirSync(locales).filter((x) => existsSync(join(locales, x, 'rules.yaml')))) {
    const doc = YAML.parse(readFileSync(join(locales, l, 'rules.yaml'), 'utf8'))
    expect(promptFindings(extractItems(doc).prompts, l).filter((f) => f.level === 'error'), l).toEqual([])
  }
})

it('fails a URL and warns on text that is not English', () => {
  const f = promptFindings([
    { where: 'guidance', text: 'Join us at https://example.org for help.' },
    { where: 'register', text: 'Türkçe çeviride kullanıcıya hitap ederken resmi dil kullanılır ve kısaltmalar yazılmaz her zaman' },
    { where: 'patterns[0].note', text: 'Ελληνικά κείμενα για τους μεταφραστές που δεν γράφουν αγγλικά καθόλου εδώ πέρα σήμερα' },
  ], 'r')
  expect(f.map((x) => `${x.level} ${x.message}`)).toEqual([
    'error guidance: prompt text must not contain a URL (https://example.org)',
    'warning register: prompt text does not look like English',
    'warning patterns[0].note: prompt text does not look like English',
  ])
})

it('refuses every URL form', () => {
  expect(promptFindings([
    { where: 'a', text: 'Visit evil.xyz/x now for details here.' },
    { where: 'b', text: 'Fetch ftp://a.b for the rules now.' },
    { where: 'c', text: 'Load //evil.sh/x in the review tool now.' },
    { where: 'd', text: 'Use example.community for the rules now please.' },
    { where: 'e', text: 'Use www.example for the rules now please.' },
  ], 'r').map((f) => f.message)).toEqual([
    'a: prompt text must not contain a URL (evil.xyz/x)',
    'b: prompt text must not contain a URL (ftp://a.b)',
    'c: prompt text must not contain a URL (//evil.sh/x)',
    'd: prompt text must not contain a URL (example.community)',
    'e: prompt text must not contain a URL (www.example)',
  ])
})

it('accepts plain English without a URL token', () => {
  expect(promptFindings([
    { where: 'ok', text: 'Use plain English for the rules and keep the tone formal in every note you write.' },
  ], 'r')).toEqual([])
})
