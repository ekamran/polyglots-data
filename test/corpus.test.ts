import { join } from 'node:path'
import { expect, it } from 'vitest'
import { loadCorpus } from '../src/rules/corpus.js'

it('reads sources and targets from the fixture TMX', () => {
  const c = loadCorpus([join(import.meta.dirname, 'fixtures/tr_TR.tmx.gz')])
  expect(c.length).toBeGreaterThan(1000)
  expect(c).toContain('1.1.5 sürümünde küçültülmüş CSS yeniden derlenmemişti.')
  expect(c.some((s) => s.includes('<seg>') || s.includes('</tuv>'))).toBe(false)
})
