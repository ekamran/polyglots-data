import type { MergedUnit } from '../build/merge.js'

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function tmxDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

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
