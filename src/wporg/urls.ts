import type { WpLocale } from '../locales.js'

const BASE = 'https://translate.wordpress.org'

/** The trailing slash matters: without it the API answers 301. */
export function apiUrl(path: string): string {
  return `${BASE}/api/projects/${path}/`
}

export function exportUrl(path: string, l: WpLocale): string {
  return `${BASE}/projects/${path}/${l.slug}/${l.set}/export-translations/?filters%5Bstatus%5D=current&format=po`
}
