import { describe, expect, it } from 'vitest'
import { recheckFindings, staticRegexFindings } from '../src/rules/regex-safety.js'

describe('staticRegexFindings', () => {
  it('flags a regex that does not compile with u, and one too long', () => {
    const f = staticRegexFindings([{ where: 'a', source: '\\p{Nope}', flags: 'gu' }, { where: 'b', source: 'a'.repeat(1001), flags: 'gu' }, { where: 'c', source: '\\d+', flags: 'gu' }], 'r.yaml')
    expect(f.map((x) => x.message)).toEqual([expect.stringMatching(/^a: does not compile/), 'b: 1001 characters, the limit is 1000'])
  })
})

describe('recheckFindings', () => {
  it('fails vulnerable, fails unknown unless allowlisted', async () => {
    const checker = async (s: string) => ({ status: s === 'v' ? 'vulnerable' : s === 'u' || s === 'ua' ? 'unknown' : 'safe' })
    const f = await recheckFindings([{ where: 'x', source: 'v', flags: 'gu' }, { where: 'y', source: 'u', flags: 'gu' }, { where: 'z', source: 'ua', flags: 'gu' }, { where: 'w', source: 's', flags: 'gu' }], new Set(['ua']), 'r.yaml', checker)
    expect(f.map((x) => `${x.level} ${x.message}`)).toEqual(['error x: ReDoS check says vulnerable', 'error y: ReDoS check says unknown (not in data/regex-allowlist.json)'])
  })
  it('really detects (a+)+ with recheck', async () => {
    const f = await recheckFindings([{ where: 'x', source: '^(a+)+$', flags: 'gu' }], new Set(), 'r.yaml')
    expect(f[0]?.message).toMatch(/vulnerable/)
  }, 60_000)
})

describe('flags', () => {
  it('recheck gets the flags polyglots uses', async () => {
    const seen: string[] = []
    await recheckFindings([{ where: 'a', source: 'x', flags: 'gui' }, { where: 'b', source: 'y', flags: 'u' }], new Set(), 'r', async (_s, f) => { seen.push(f); return { status: 'safe' } })
    expect(seen).toEqual(['gui', 'u'])
  })
})
