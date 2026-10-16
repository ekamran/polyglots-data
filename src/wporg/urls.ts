import type { WpLocale } from '../locales.js'
import { PATH_RE } from '../paths.js'

const BASE = 'https://translate.wordpress.org'

/** Defence in depth: a path that is not a project path never reaches a URL. */
function checked(path: string): string {
  if (!PATH_RE.test(path)) throw new Error(`not a project path: ${JSON.stringify(path.slice(0, 200))}`)
  return path
}

/** The trailing slash matters: without it the API answers 301. */
export function apiUrl(path: string): string {
  checked(path)
  return `${BASE}/api/projects/${path}/`
}

export function exportUrl(path: string, l: WpLocale): string {
  checked(path)
  return `${BASE}/projects/${path}/${l.slug}/${l.set}/export-translations/?filters%5Bstatus%5D=current&format=po`
}
