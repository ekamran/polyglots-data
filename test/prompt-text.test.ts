import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import YAML from 'yaml'
import { expect, it } from 'vitest'
import { extractItems } from '../src/rules/items.js'
import { promptFindings } from '../src/rules/prompt-text.js'

it('passes the real tr_TR and sv_SE prompt text', () => {
  for (const l of ['tr_TR', 'sv_SE']) {
    const doc = YAML.parse(readFileSync(join(import.meta.dirname, '..', 'locales', l, 'rules.yaml'), 'utf8'))
    expect(promptFindings(extractItems(doc).prompts, l)).toEqual([])
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
