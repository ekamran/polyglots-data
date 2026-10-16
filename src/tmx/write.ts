import type { MergedUnit } from '../build/merge.js'

export function escapeXml(s: string): string {
  // A raw CR would be normalised to LF by every XML parser (and in attributes to a space); &#13; keeps it.
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\r/g, '&#13;')
}

export function tmxDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Bumped by hand when the TMX layout changes; a git SHA here would change every file on every commit. */
export const TMX_FORMAT_VERSION = '1'

/** TMX 1.4b as agreed with polyglots (integration points 4 and 9). */
export function writeTmx(units: MergedUnit[], o: { lang: string; toolVersion: string; created: Date }): string {
  const parts: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<tmx version="1.4">',
    `  <header srclang="en" datatype="PlainText" segtype="sentence" creationtool="polyglots-data" creationtoolversion="${escapeXml(o.toolVersion)}" adminlang="en" o-tmf="po" creationdate="${tmxDate(o.created)}"/>`,
    '  <body>',
  ]
  for (const u of units) {
    parts.push('    <tu>')
    if (u.context) parts.push(`      <prop type="x-context">${escapeXml(u.context)}</prop>`)
    for (const p of u.projects) parts.push(`      <prop type="x-project">${escapeXml(p)}</prop>`)
    if (u.low) parts.push('      <prop type="x-weight">low</prop>')
    parts.push(`      <tuv xml:lang="en"><seg>${escapeXml(u.source)}</seg></tuv>`)
    parts.push(`      <tuv xml:lang="${escapeXml(o.lang)}"><seg>${escapeXml(u.target)}</seg></tuv>`)
    parts.push('    </tu>')
  }
  parts.push('  </body>', '</tmx>', '')
  return parts.join('\n')
}
