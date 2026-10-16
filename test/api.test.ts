import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findSet, parseProjectApi } from '../src/wporg/api.js'
import { apiUrl, exportUrl } from '../src/wporg/urls.js'

describe('urls', () => {
  it('builds both URLs', () => {
    expect(apiUrl('wp-plugins/debug-bar/dev')).toBe('https://translate.wordpress.org/api/projects/wp-plugins/debug-bar/dev/')
    expect(exportUrl('wp/dev', { slug: 'nl', set: 'formal' })).toBe(
      'https://translate.wordpress.org/projects/wp/dev/nl/formal/export-translations/?filters%5Bstatus%5D=current&format=po')
  })
  it('refuses a path that is not a project path', () => {
    for (const p of ['../x', 'wp/dev/../../x', 'wp/dev?x=1', 'wp/dev#a', 'https://evil.test/', '', 'Wp/dev']) {
      expect(() => apiUrl(p), p).toThrow(/not a project path/)
      expect(() => exportUrl(p, { slug: 'tr', set: 'default' }), p).toThrow(/not a project path/)
    }
  })
})

describe('parseProjectApi', () => {
  it('reads the tr set', () => {
    const r = parseProjectApi(readFileSync(join(import.meta.dirname, 'fixtures/api/debug-bar.json')))
    if (!r.ok) throw new Error(r.error)
    expect(findSet(r.sets, { slug: 'tr', set: 'default' })).toEqual({
      locale: 'tr', slug: 'default', wpLocale: 'tr_TR', currentCount: 84, allCount: 84, percent: 100, lastModified: '2026-09-27 21:47:28',
    })
  })
  it('reads all 208 sets of the live answer, including last_modified false', () => {
    const r = parseProjectApi(readFileSync(join(import.meta.dirname, 'fixtures/api/debug-bar.json')))
    if (!r.ok) throw new Error(r.error)
    expect(r.sets).toHaveLength(208)
    expect(findSet(r.sets, { slug: 'af', set: 'default' })?.lastModified).toBe('')
  })
  it('refuses something that is not the API shape', () => {
    expect(parseProjectApi(Buffer.from('<html>')).ok).toBe(false)
    expect(parseProjectApi(Buffer.from('{"x":1}')).ok).toBe(false)
  })
})
