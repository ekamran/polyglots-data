import type { Manifest } from '../manifest.js'
import { LATEST, RELEASE_DOWNLOAD } from '../manifest.js'
import type { Unit } from '../types.js'
import type { HttpClient } from '../wporg/client.js'
import { decodeUnitsFile, sha512, type State, type StateLocale } from './state.js'

export interface Previous {
  first: boolean
  index?: Manifest
  state: State
  units: Map<string, Map<string, { built: string; units: Unit[] }>>
  problems: string[]
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isManifest(v: unknown): v is Manifest {
  return isObject(v) && v.schema === 1 && Array.isArray(v.tm) && Array.isArray(v.rules)
}

function isStateLocale(v: unknown): v is StateLocale {
  return isObject(v) && typeof v.units === 'string' && typeof v.sha512 === 'string' && isObject(v.projects)
}

export interface PreviousOptions { firstRun: boolean; base?: string; unitsPrefix?: string }

/**
 * The latest release's manifest, state and units files. Only with firstRun
 * (the workflow saw no release at all) does a 404 on index.json mean the
 * first run; otherwise a 404 is a problem like any other, so a release that
 * lost its index.json can never be taken for a fresh start. Anything missing
 * or malformed is a problem the run reports (red); the build then runs as if
 * there were no cache. Nothing here throws on bad release data.
 */
export async function loadPrevious(client: HttpClient, opts: PreviousOptions): Promise<Previous> {
  const base = opts.base ?? LATEST
  const unitsPrefix = opts.unitsPrefix ?? RELEASE_DOWNLOAD
  const out: Previous = { first: false, state: { schema: 1, locales: {} }, units: new Map(), problems: [] }
  const idx = await client.get(base + 'index.json')
  if (!idx.ok) {
    if (idx.status === 404 && opts.firstRun) return { ...out, first: true }
    out.problems.push(`index.json: ${idx.error}`)
    return out
  }
  let index: unknown
  try {
    index = JSON.parse(idx.body.toString('utf8'))
  } catch {
    out.problems.push('index.json: not JSON')
    return out
  }
  if (!isManifest(index)) {
    out.problems.push('index.json: not a manifest of schema 1')
    return out
  }
  out.index = index

  const st = await client.get(base + 'state.json')
  if (!st.ok) {
    out.problems.push(`state.json: ${st.error}`)
    return out
  }
  let state: unknown
  try {
    state = JSON.parse(st.body.toString('utf8'))
  } catch {
    out.problems.push('state.json: not JSON')
    return out
  }
  if (!isObject(state) || state.schema !== 1 || !isObject(state.locales) || Array.isArray(state.locales)) {
    out.problems.push('state.json: not a state file of schema 1')
    return out
  }

  for (const [code, loc] of Object.entries(state.locales)) {
    try {
      if (!isStateLocale(loc)) {
        out.problems.push(`${code}: state entry malformed`)
        continue
      }
      if (!loc.units.startsWith(unitsPrefix)) {
        out.problems.push(`${code}: units URL outside the release`)
        continue
      }
      const r = await client.get(loc.units)
      if (!r.ok) {
        out.problems.push(`${code}: units file ${r.error}`)
        continue
      }
      if (sha512(r.body) !== loc.sha512) {
        out.problems.push(`${code}: units file sha512 mismatch`)
        continue
      }
      const f = decodeUnitsFile(r.body)
      out.units.set(code, new Map(Object.entries(f.projects).map(([path, p]) => [path, {
        built: p.built, units: p.units.map(([source, context, target]) => ({ source, context, target })),
      }])))
      out.state.locales[code] = loc
    } catch (err) {
      out.problems.push(`${code}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return out
}
