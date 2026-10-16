import type { Manifest } from '../manifest.js'
import { LATEST } from '../manifest.js'
import type { Unit } from '../types.js'
import type { HttpClient } from '../wporg/client.js'
import { decodeUnitsFile, sha512, type State } from './state.js'

export interface Previous {
  first: boolean
  index?: Manifest
  state: State
  units: Map<string, Map<string, { built: string; units: Unit[] }>>
  problems: string[]
}

/**
 * The latest release's manifest, state and units files. A 404 on index.json
 * means no release exists yet: the first run. Anything else missing is a
 * problem the run reports (red), while building as if there were no cache.
 */
export async function loadPrevious(client: HttpClient, base = LATEST): Promise<Previous> {
  const empty: State = { schema: 1, locales: {} }
  const out: Previous = { first: false, state: empty, units: new Map(), problems: [] }
  const idx = await client.get(base + 'index.json')
  if (!idx.ok) {
    if (idx.status === 404) return { ...out, first: true }
    out.problems.push(`index.json: ${idx.error}`)
    return out
  }
  try {
    out.index = JSON.parse(idx.body.toString('utf8')) as Manifest
  } catch {
    out.problems.push('index.json: not JSON')
  }
  const st = await client.get(base + 'state.json')
  if (!st.ok) {
    out.problems.push(`state.json: ${st.error}`)
    return out
  }
  let state: State
  try {
    state = JSON.parse(st.body.toString('utf8')) as State
    if (state.schema !== 1 || typeof state.locales !== 'object' || state.locales === null) throw new Error('schema')
  } catch {
    out.problems.push('state.json: not a state file of schema 1')
    return out
  }
  out.state = { schema: 1, locales: {} }
  for (const [code, loc] of Object.entries(state.locales)) {
    const r = await client.get(loc.units)
    if (!r.ok) { out.problems.push(`${code}: units file ${r.error}`); continue }
    if (sha512(r.body) !== loc.sha512) { out.problems.push(`${code}: units file sha512 mismatch`); continue }
    try {
      const f = decodeUnitsFile(r.body)
      out.units.set(code, new Map(Object.entries(f.projects).map(([path, p]) => [path, {
        built: p.built, units: p.units.map(([source, context, target]) => ({ source, context, target })),
      }])))
      out.state.locales[code] = loc
    } catch (err) {
      out.problems.push(`${code}: units file ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return out
}
