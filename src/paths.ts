export const PATH_RE = /^[a-z0-9-]+(?:\/(?!\.+(?:\/|$))[a-z0-9._-]+)*$/

const LONG_TEXT = new Set(['dev-readme', 'stable-readme', 'release-notes'])
// Translation set names on translate.wordpress.org; Task 2 Step 6 checks this
// list against data/wp-locales.json.
const SETS = new Set(['default', 'formal', 'informal', 'ao90'])

/** Readme and release-notes projects: long prose, weighted low in the TM. */
export function isLongText(path: string): boolean {
  return LONG_TEXT.has(path.split('/').at(-1) ?? '')
}

/**
 * A project path as the YAML files hold it. A pasted translate.wordpress.org
 * URL is refused with the path to write instead, so the file stays in one
 * form and CI can say exactly what to change.
 */
export function normalizePath(input: string):
  | { ok: true; path: string }
  | { ok: false; error: string; suggestion?: string } {
  if (/^https?:\/\//.test(input)) {
    const m = /^https?:\/\/translate\.wordpress\.org\/projects\/(.+?)\/?$/.exec(input)
    if (!m?.[1]) return { ok: false, error: 'a URL, not a path' }
    const segments = m[1].split('/')
    // .../<path>/<locale>/<set>: strip the last two segments only when the
    // last one is a translation set name, so wp/dev/admin keeps "admin" even
    // though "dev" looks like a locale code.
    const set = segments.at(-1) ?? ''
    const locale = segments.at(-2) ?? ''
    const hasLocale = segments.length > 2 && SETS.has(set) && /^[a-z]{2,3}(?:-[a-z0-9]+)*$/.test(locale)
    const path = (hasLocale ? segments.slice(0, -2) : segments).join('/')
    return { ok: false, error: 'a URL, not a path', suggestion: path }
  }
  if (!PATH_RE.test(input)) return { ok: false, error: `not a project path: ${input}` }
  return { ok: true, path: input }
}
