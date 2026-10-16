import { isAbsolute, relative, resolve, sep } from 'node:path'
import { isFullSha } from '../check/git.js'
import { PATH_RE } from '../paths.js'

export function parseList(values: string[] | undefined): string[] {
  return (values ?? []).flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean)
}

export function localesFromChanges(files: string[], withTm: string[]): string[] {
  if (files.includes('core/tm.yaml')) return [...withTm].sort()
  const changed = new Set(files.map((f) => /^locales\/([^/]+)\/tm\.yaml$/.exec(f)?.[1]).filter((x): x is string => !!x))
  return withTm.filter((c) => changed.has(c)).sort()
}

/** The smoke command downloads at most 3 projects: accept only 1, 2 or 3 (default 3). */
export function parseSmokeMax(v: string | undefined): number {
  const n = v === undefined ? 3 : /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN
  if (!Number.isInteger(n) || n < 1 || n > 3) throw new Error('--max must be 1, 2 or 3')
  return n
}

export interface BuildArgs { root: string; out: string; locales: string[]; accept: string[]; changedFrom?: string; withTm: string[] }

/**
 * Checks the build CLI arguments before any network work. --out must be a
 * directory strictly inside the repository (the CLI deletes it first), so
 * neither the root, a parent, nor a path outside the repo is ever removed.
 */
export function buildArgErrors(a: BuildArgs): string[] {
  const errors: string[] = []
  const rel = relative(resolve(a.root), resolve(a.root, a.out))
  if (rel === '' || rel.split(sep)[0] === '..' || isAbsolute(rel)) errors.push(`--out ${a.out} must be a directory inside the repository, not the root, a parent or an outside path`)
  const tm = new Set(a.withTm)
  const list = [...a.withTm].sort().join(', ')
  for (const l of a.locales) if (!tm.has(l)) errors.push(`--locale ${l} is not a TM locale; TM locales: ${list}`)
  for (const x of a.accept) {
    const i = x.indexOf(':')
    const code = i > 0 ? x.slice(0, i) : ''
    const path = i > 0 ? x.slice(i + 1) : ''
    if (!code || !path) errors.push(`--accept ${x} must be locale:path`)
    else if (!tm.has(code)) errors.push(`--accept ${x}: ${code} is not a TM locale; TM locales: ${list}`)
    else if (!PATH_RE.test(path)) errors.push(`--accept ${x}: ${path} is not a project path`)
  }
  if (a.changedFrom !== undefined && !/^0+$/.test(a.changedFrom) && !isFullSha(a.changedFrom)) errors.push('--changed-from must be a full commit sha or all zeros')
  return errors
}
