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

export function decodeUnitsFile(b: Buffer): UnitsFile {
  const f = JSON.parse(gunzipSync(b).toString('utf8')) as UnitsFile
  if (f.schema !== 1 || typeof f.projects !== 'object') throw new Error('not a units file of schema 1')
  return f
}
