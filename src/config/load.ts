import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import YAML from 'yaml'
import type { z } from 'zod'
import type { WpLocales } from '../locales.js'
import { normalizePath } from '../paths.js'
import { CoreTmSchema, LocaleMetaSchema, LocaleTmSchema } from './schemas.js'

export interface LocaleProject { path: string; added: string; by: string; reviewed: string }
export interface Maintainer { wporg: string; github?: string; role: 'Locale Manager' | 'General Translation Editor' }
export interface LocaleMeta { locale: string; maintainers: Maintainer[]; rules: { status: 'maintained' | 'draft' } }
export interface LocaleTm { projects: LocaleProject[]; exclude: string[] }
export interface LocaleData { code: string; tm?: LocaleTm; meta?: LocaleMeta; rulesFile?: string }
export interface Repo { root: string; core: string[]; locales: Map<string, LocaleData> }
export interface ConfigIssue { file: string; message: string }

function parse<T>(schema: z.ZodType<T>, text: string, file: string, issues: ConfigIssue[]): T | undefined {
  let doc: unknown
  try {
    doc = YAML.parse(text)
  } catch (err) {
    issues.push({ file, message: `YAML: ${err instanceof Error ? err.message : String(err)}` })
    return undefined
  }
  const r = schema.safeParse(doc ?? {})
  if (r.success) return r.data
  for (const i of r.error.issues) {
    const where = i.path.join('.')
    const keys = 'keys' in i && Array.isArray(i.keys) ? ` (${i.keys.join(', ')})` : ''
    issues.push({ file, message: `${where ? where + ': ' : ''}${i.message}${keys}` })
  }
  return undefined
}

function checkPaths(paths: string[], file: string, issues: ConfigIssue[]): void {
  const seen = new Set<string>()
  for (const p of paths) {
    const n = normalizePath(p)
    if (!n.ok) issues.push({ file, message: n.suggestion ? `${p}: ${n.error}; write ${n.suggestion}` : n.error })
    if (seen.has(p)) issues.push({ file, message: `${p} is listed twice` })
    seen.add(p)
  }
}

/** The raw document, for checks that must run even when the schema fails. */
function raw(text: string): Record<string, unknown> {
  try {
    const doc = YAML.parse(text) as unknown
    return typeof doc === 'object' && doc !== null ? (doc as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}
const strings = (v: unknown, key?: string): string[] =>
  Array.isArray(v) ? v.map((x) => (key ? (x as Record<string, unknown> | null)?.[key] : x)).filter((x): x is string => typeof x === 'string') : []

export function parseLocaleTm(text: string, file: string, core: string[] = []): { tm?: LocaleTm; issues: ConfigIssue[] } {
  const issues: ConfigIssue[] = []
  const doc = raw(text)
  const paths = strings(doc.projects, 'path')
  checkPaths(paths, file, issues)
  const coreSet = new Set(core)
  for (const p of paths) if (coreSet.has(p)) issues.push({ file, message: `${p} is already a core project` })
  if (core.length > 0) for (const e of strings(doc.exclude)) if (!coreSet.has(e)) issues.push({ file, message: `exclude ${e} is not a core project` })
  const tm = parse(LocaleTmSchema, text, file, issues)
  return { tm, issues }
}

export function parseLocaleMeta(text: string, file: string, code?: string): { meta?: LocaleMeta; issues: ConfigIssue[] } {
  const issues: ConfigIssue[] = []
  const locale = raw(text).locale
  if (code && locale !== code) issues.push({ file, message: `locale must be ${code}, the folder name` })
  const meta = parse(LocaleMetaSchema, text, file, issues)
  return { meta, issues }
}

export function loadRepo(root: string, wp: WpLocales): { repo: Repo; issues: ConfigIssue[] } {
  const issues: ConfigIssue[] = []
  const coreFile = join(root, 'core', 'tm.yaml')
  let core: string[] = []
  if (existsSync(coreFile)) core = parse(CoreTmSchema, readFileSync(coreFile, 'utf8'), coreFile, issues)?.projects.map((p) => p.path) ?? []
  else issues.push({ file: coreFile, message: 'core/tm.yaml is missing' })
  checkPaths(core, coreFile, issues)

  const locales = new Map<string, LocaleData>()
  const dir = join(root, 'locales')
  const codes = existsSync(dir) ? readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory()).sort() : []
  for (const code of codes) {
    const folder = join(dir, code)
    if (!wp.has(code)) issues.push({ file: folder, message: `${code} is not a WordPress locale in data/wp-locales.json` })
    const data: LocaleData = { code }
    const tmFile = join(folder, 'tm.yaml')
    if (existsSync(tmFile)) {
      const r = parseLocaleTm(readFileSync(tmFile, 'utf8'), tmFile, core)
      issues.push(...r.issues)
      if (r.tm) data.tm = r.tm
    }
    const metaFile = join(folder, 'locale.yaml')
    if (existsSync(metaFile)) {
      const r = parseLocaleMeta(readFileSync(metaFile, 'utf8'), metaFile, code)
      issues.push(...r.issues)
      if (r.meta) data.meta = r.meta
    } else {
      issues.push({ file: folder, message: 'locale.yaml is missing' })
    }
    const rulesFile = join(folder, 'rules.yaml')
    if (existsSync(rulesFile)) data.rulesFile = rulesFile
    for (const name of readdirSync(folder)) {
      if (name.startsWith('.')) continue // .DS_Store and the like are git-ignored
      if (!['tm.yaml', 'locale.yaml', 'rules.yaml'].includes(name)) issues.push({ file: join(folder, name), message: 'unexpected file' })
    }
    locales.set(code, data)
  }
  return { repo: { root, core, locales }, issues }
}
