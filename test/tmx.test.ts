import { XMLValidator } from 'fast-xml-parser'
import { expect, it } from 'vitest'
import { escapeXml, writeTmx } from '../src/tmx/write.js'

it('writes the agreed TMX shape', () => {
  const xml = writeTmx(
    [
      { source: 'Post', context: 'verb', target: 'Yayınla', projects: ['wp/dev', 'wp/dev/admin'], low: false },
      { source: 'A & <b>"c"</b>', context: '', target: 'x', projects: ['wp-plugins/a/dev-readme'], low: true },
    ],
    { lang: 'tr-TR', toolVersion: 'abc123def456', created: new Date('2026-10-16T03:00:00Z') },
  )
  expect(XMLValidator.validate(xml)).toBe(true)
  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<tmx version="1.4">')).toBe(true)
  expect(xml).toContain('creationtool="polyglots-data" creationtoolversion="abc123def456"')
  expect(xml).toContain('creationdate="20261016T030000Z"')
  expect(xml).toContain([
    '    <tu>',
    '      <prop type="x-context">verb</prop>',
    '      <prop type="x-project">wp/dev</prop>',
    '      <prop type="x-project">wp/dev/admin</prop>',
    '      <tuv xml:lang="en"><seg>Post</seg></tuv>',
    '      <tuv xml:lang="tr-TR"><seg>Yayınla</seg></tuv>',
    '    </tu>',
  ].join('\n'))
  expect(xml).toContain('<prop type="x-project">wp-plugins/a/dev-readme</prop>\n      <prop type="x-weight">low</prop>')
  expect(xml).not.toContain('<note>')
  expect(escapeXml('A & <b>"c"</b>')).toBe('A &amp; &lt;b&gt;&quot;c&quot;&lt;/b&gt;')
})
