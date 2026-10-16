import { z } from 'zod'
import type { WpLocale } from '../locales.js'

export interface SetInfo { locale: string; slug: string; wpLocale: string; currentCount: number; allCount: number; percent: number; lastModified: string }

const ApiSchema = z.object({
  translation_sets: z.array(z.object({
    locale: z.string(),
    slug: z.string(),
    wp_locale: z.string().nullable().optional(),
    current_count: z.number(),
    all_count: z.number(),
    percent_translated: z.number(),
    // The live API answers `false` for a set that was never modified.
    last_modified: z.union([z.string(), z.literal(false), z.null()]).optional(),
  })),
})

export function parseProjectApi(body: Buffer): { ok: true; sets: SetInfo[] } | { ok: false; error: string } {
  let json: unknown
  try {
    json = JSON.parse(body.toString('utf8'))
  } catch {
    return { ok: false, error: 'API answer is not JSON' }
  }
  const r = ApiSchema.safeParse(json)
  if (!r.success) return { ok: false, error: 'API answer has no translation_sets' }
  return {
    ok: true,
    sets: r.data.translation_sets.map((s) => ({
      locale: s.locale, slug: s.slug, wpLocale: s.wp_locale ?? '', currentCount: s.current_count,
      allCount: s.all_count, percent: s.percent_translated, lastModified: typeof s.last_modified === 'string' ? s.last_modified : '',
    })),
  }
}

export function findSet(sets: SetInfo[], l: WpLocale): SetInfo | undefined {
  return sets.find((s) => s.locale === l.slug && s.slug === l.set)
}
