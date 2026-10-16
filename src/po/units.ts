import { po } from 'gettext-parser'
import type { Unit } from '../types.js'

export type PoResult = { ok: true; units: Unit[] } | { ok: false; error: string }

// XML 1.0 Char: tab, LF, CR and U+0020 upwards, minus U+FFFE/U+FFFF.
export const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/

/**
 * The units polyglots' `tm import` would make from this export: one per
 * msgid, plus msgid_plural → msgstr[1] only when the catalogue has exactly
 * two forms (with three or more, msgstr[1] is not "the plural").
 */
export function poToUnits(body: Buffer): PoResult {
  const head = body.subarray(0, 512).toString('utf8').replace(/^﻿/, '').trimStart()
  if (!head.startsWith('#') && !head.startsWith('msgid') && !head.startsWith('msgctxt')) return { ok: false, error: 'not a .po file' }
  let catalog
  try {
    catalog = po.parse(body)
  } catch (err) {
    return { ok: false, error: `parse: ${err instanceof Error ? err.message : String(err)}` }
  }
  // Every GlotPress export starts with the header entry (msgid "" with the headers in msgstr).
  // A text page that starts with '#' and happens to parse has none.
  if (catalog.translations['']?.['']?.msgstr?.[0] === undefined) return { ok: false, error: 'not a .po file' }
  const nplurals = /nplurals\s*=\s*(\d+)/.exec(catalog.headers['Plural-Forms'] ?? '')?.[1]
  const seen = new Set<string>()
  const units: Unit[] = []
  let entries = 0
  for (const [context, byId] of Object.entries(catalog.translations)) {
    for (const e of Object.values(byId)) {
      if (!e.msgid) continue
      entries++
      if ((e.comments?.flag ?? '').split(/[\s,]+/).includes('fuzzy')) continue
      const forms: Array<[string, string | undefined]> = [[e.msgid, e.msgstr[0]]]
      if (e.msgid_plural !== undefined && nplurals === '2') forms.push([e.msgid_plural, e.msgstr[1]])
      for (const [source, target] of forms) {
        if (!target || target.trim() === '') continue
        if (XML_INVALID.test(source) || XML_INVALID.test(target) || XML_INVALID.test(context)) {
          return { ok: false, error: `a character not allowed in XML in "${source.slice(0, 40)}"` }
        }
        // A lone surrogate would be written as U+FFFD in UTF-8: the TMX would not hold what the export said.
        if (!source.isWellFormed() || !target.isWellFormed() || !context.isWellFormed()) {
          return { ok: false, error: `parse: a lone surrogate (not well-formed UTF-16) in "${source.slice(0, 40).toWellFormed()}"` }
        }
        const key = JSON.stringify([source, context, target])
        if (seen.has(key)) continue
        seen.add(key)
        units.push({ source, context, target })
      }
    }
  }
  if (entries > 0 && units.length === 0) return { ok: false, error: 'the export has entries but no usable unit' }
  return { ok: true, units }
}
