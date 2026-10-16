import { describe, expect, it } from 'vitest'
import { adversarialStrings } from '../src/rules/adversarial.js'
import { timeRegexes } from '../src/rules/regex-timing.js'

describe('adversarialStrings', () => {
  it('builds long runs from the characters a pattern uses', () => {
    const s = adversarialStrings('[Yy]ada\\s+\\p{L}')
    expect(s.some((x) => x.length >= 10_000 && /^Y+/.test(x))).toBe(true)
    expect(s.some((x) => /^ +/.test(x) && x.length >= 10_000)).toBe(true)
    expect(s.every((x) => x.length <= 10_001)).toBe(true)
  })
})

describe('timeRegexes', () => {
  it('passes a fast regex', async () => {
    expect(await timeRegexes([{ where: 'a', source: '\\d+', flags: 'gu' }], ['123', 'abc'.repeat(3000)], 'r.yaml')).toEqual([])
  })
  it('kills and reports a catastrophic regex', async () => {
    const f = await timeRegexes([{ where: 'bad', source: '^(a+)+$', flags: 'gu' }], ['a'.repeat(40) + '!'], 'r.yaml', { hardMs: 1000, adversarial: false })
    expect(f).toEqual([{ level: 'error', check: 'regex-time', file: 'r.yaml', message: 'bad: did not finish within 1000 ms on a string of 41 characters' }])
  })
  it('catches with adversarial strings a ReDoS the corpus misses', async () => {
    const f = await timeRegexes([{ where: 'bad', source: '^(a+)+$', flags: 'gu' }], ['hello'], 'r.yaml', { hardMs: 1000 })
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ level: 'error', check: 'regex-time' })
  })
  it('reports a regex over the budget', async () => {
    const f = await timeRegexes([{ where: 'slow', source: '(?:a|a)*b', flags: 'gu' }], ['a'.repeat(18)], 'r.yaml', { budgetMs: 0.001, hardMs: 5000, adversarial: false })
    expect(f[0]?.message).toMatch(/^slow: \d+(\.\d+)? ms on a string of 18 characters/)
  })
})

describe('timeRegexes with polyglots flags', () => {
  it('runs a sentenceEnd regex with u only (no global scan)', async () => {
    expect(await timeRegexes([{ where: 'sentenceEnd.notEnding', source: '[.!?]$', flags: 'u' }], ['Done.', 'x'], 'r.yaml', { adversarial: false })).toEqual([])
  })
  it('runs a pattern with gui', async () => {
    expect(await timeRegexes([{ where: 'p', source: 'yada', flags: 'gui' }], ['YADA yada'], 'r.yaml', { adversarial: false })).toEqual([])
  })
})
