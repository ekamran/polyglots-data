import type { LocaleTm } from './config/load.js'

/** The locale's TM projects: core minus exclude, then its own, in list order. */
export function resolveProjects(core: string[], tm: LocaleTm): string[] {
  const excluded = new Set(tm.exclude)
  const out = core.filter((p) => !excluded.has(p))
  for (const p of tm.projects) if (!out.includes(p.path)) out.push(p.path)
  return out
}
