import { createHash } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'
import type { CachedProject } from './cache.js'

export interface StateLocale { units: string; sha512: string; projects: Record<string, CachedProject> }
export interface State { schema: 1; locales: Record<string, StateLocale> }
export interface UnitsFile { schema: 1; projects: Record<string, { built: string; units: Array<[string, string, string]> }> }

export function sha512(b: Buffer): string {
  return createHash('sha512').update(b).digest('hex')
}

export function encodeUnitsFile(f: UnitsFile): Buffer {
  const projects = Object.fromEntries(Object.keys(f.projects).sort().map((k) => [k, f.projects[k]]))
  return gzipSync(Buffer.from(JSON.stringify({ schema: 1, projects })), { level: 9 })
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isTriple(v: unknown): boolean {
  return Array.isArray(v) && v.length === 3 && v.every((s) => typeof s === 'string')
}

export function decodeUnitsFile(b: Buffer): UnitsFile {
  const f: unknown = JSON.parse(gunzipSync(b).toString('utf8'))
  if (!isObject(f) || f.schema !== 1 || !isObject(f.projects)) throw new Error('not a units file of schema 1')
  for (const [path, p] of Object.entries(f.projects)) {
    if (!isObject(p) || typeof p.built !== 'string' || !Array.isArray(p.units)) throw new Error(`units file: ${path} is malformed`)
    for (const u of p.units) {
      if (!isTriple(u)) throw new Error(`units file: ${path} has a malformed unit`)
    }
  }
  return f as unknown as UnitsFile
}
