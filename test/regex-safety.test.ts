import { describe, expect, it } from 'vitest'
import { recheckFindings, staticRegexFindings } from '../src/rules/regex-safety.js'

describe('staticRegexFindings', () => {
  it('flags a regex that does not compile with u, and one too long', () => {
    const f = staticRegexFindings([{ where: 'a', source: '\\p{Nope}' }, { where: 'b', source: 'a'.repeat(1001) }, { where: 'c', source: '\\d+' }], 'r.yaml')
    expect(f.map((x) => x.message)).toEqual([expect.stringMatching(/^a: does not compile/), 'b: 1001 characters, the limit is 1000'])
  })
})

describe('recheckFindings', () => {
  it('fails vulnerable, fails unknown unless allowlisted', async () => {
    const checker = async (s: string) => ({ status: s === 'v' ? 'vulnerable' : s === 'u' || s === 'ua' ? 'unknown' : 'safe' })
    const f = await recheckFindings([{ where: 'x', source: 'v' }, { where: 'y', source: 'u' }, { where: 'z', source: 'ua' }, { where: 'w', source: 's' }], new Set(['ua']), 'r.yaml', checker)
    expect(f.map((x) => `${x.level} ${x.message}`)).toEqual(['error x: ReDoS check says vulnerable', 'error y: ReDoS check says unknown (not in data/regex-allowlist.json)'])
  })
  it('really detects (a+)+ with recheck', async () => {
    const f = await recheckFindings([{ where: 'x', source: '^(a+)+$' }], new Set(), 'r.yaml')
    expect(f[0]?.message).toMatch(/vulnerable/)
  }, 60_000)
})
