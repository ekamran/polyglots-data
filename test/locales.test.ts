import { describe, expect, it } from 'vitest'
import { manifestSlug, parsePolyglotsTable, parseStats, targetLang } from '../src/locales.js'

describe('locale mapping', () => {
  it('builds the manifest slug with the set only when it is not default', () => {
    expect(manifestSlug({ slug: 'tr', set: 'default' })).toBe('tr')
    expect(manifestSlug({ slug: 'nl', set: 'formal' })).toBe('nl/formal')
  })
  it('builds xml:lang from the WP code without the set', () => {
    expect(targetLang('tr_TR', { slug: 'tr', set: 'default' })).toBe('tr-TR')
    expect(targetLang('nl_NL_formal', { slug: 'nl', set: 'formal' })).toBe('nl-NL')
    expect(targetLang('el', { slug: 'el', set: 'default' })).toBe('el')
  })
})

describe('parsers', () => {
  it('reads the stats page rows', () => {
    const html = '<tr><td><a href="/locale/nl/formal/">nl_NL_formal</a></td></tr><tr><td><a href="/locale/tr/default/"><strong>tr_TR</strong></a></td></tr>'
    expect(parseStats(html)).toEqual([
      { wp: 'nl_NL_formal', slug: 'nl', set: 'formal' },
      { wp: 'tr_TR', slug: 'tr', set: 'default' },
    ])
  })
  it('reads the polyglots table', () => {
    const ts = "export const WPORG_LOCALES = [\n  { wp: 'tr_TR', slug: 'tr', set: 'default' },\n  { wp: 'el', slug: 'el', set: 'default' },\n]"
    expect(parsePolyglotsTable(ts)).toEqual([
      { wp: 'el', slug: 'el', set: 'default' },
      { wp: 'tr_TR', slug: 'tr', set: 'default' },
    ])
  })
})
