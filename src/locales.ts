import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface WpLocale {
  slug: string
  set: string
}
export type WpLocales = Map<string, WpLocale>
interface Row { wp: string; slug: string; set: string }

const WP_RE = /^[a-z]{2,3}(?:_[A-Za-z0-9]+)*$/
const PART_RE = /^[a-z0-9-]+$/

export function loadWpLocales(root: string): WpLocales {
  const data = JSON.parse(readFileSync(join(root, 'data', 'wp-locales.json'), 'utf8')) as { locales: Record<string, WpLocale> }
  return new Map(Object.entries(data.locales))
}

/** The translate.wordpress.org locale id with its set, as polyglots keys TM rows. */
export function manifestSlug(l: WpLocale): string {
  return l.set === 'default' ? l.slug : `${l.slug}/${l.set}`
}

/** BCP 47 for the TMX target: the WP code without the set suffix. */
export function targetLang(code: string, l: WpLocale): string {
  const base = l.set !== 'default' && code.endsWith(`_${l.set}`) ? code.slice(0, -(l.set.length + 1)) : code
  return base.replaceAll('_', '-')
}

function sorted(rows: Row[]): Row[] {
  const byCode = new Map(rows.filter((r) => WP_RE.test(r.wp) && PART_RE.test(r.slug) && PART_RE.test(r.set)).map((r) => [r.wp, r]))
  return [...byCode.values()].sort((a, b) => (a.wp < b.wp ? -1 : a.wp > b.wp ? 1 : 0))
}

/** Same parsing as polyglots' scripts/update-locales.mjs. */
export function parseStats(html: string): Row[] {
  const rows: Row[] = []
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
    const link = /href="\/locale\/([^/"]+)\/([^/"]+)\/"[^>]*>([\s\S]*?)<\/a>/.exec(row[1] ?? '')
    if (!link) continue
    rows.push({ wp: (link[3] ?? '').replace(/<[^>]+>/g, '').trim(), slug: link[1] ?? '', set: link[2] ?? '' })
  }
  return sorted(rows)
}

/** polyglots' committed src/wporg/locales-data.ts, for an offline seed. */
export function parsePolyglotsTable(ts: string): Row[] {
  const rows: Row[] = []
  for (const m of ts.matchAll(/\{\s*wp:\s*'([^']+)',\s*slug:\s*'([^']+)',\s*set:\s*'([^']+)'\s*\}/g)) {
    rows.push({ wp: m[1] ?? '', slug: m[2] ?? '', set: m[3] ?? '' })
  }
  return sorted(rows)
}

export function renderTable(rows: Row[], source: string, generated: string): string {
  const locales = Object.fromEntries(rows.map((r) => [r.wp, { slug: r.slug, set: r.set }]))
  return JSON.stringify({ source, generated, locales }, null, 2) + '\n'
}
