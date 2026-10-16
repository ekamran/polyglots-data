import { isLongText } from '../paths.js'
import type { Unit } from '../types.js'

export interface MergedUnit extends Unit { projects: string[]; low: boolean }

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** UTF-16 code-unit order: the same bytes on every Node and ICU version. */
export function compareUnits(a: Unit, b: Unit): number {
  return cmp(a.source, b.source) || cmp(a.context, b.context) || cmp(a.target, b.target)
}

export function mergeUnits(projects: Array<{ path: string; units: Unit[] }>): MergedUnit[] {
  const byKey = new Map<string, MergedUnit>()
  for (const p of projects) {
    for (const u of p.units) {
      const key = JSON.stringify([u.source, u.context, u.target])
      let m = byKey.get(key)
      if (!m) {
        m = { source: u.source, context: u.context, target: u.target, projects: [], low: false }
        byKey.set(key, m)
      }
      if (!m.projects.includes(p.path)) m.projects.push(p.path)
    }
  }
  const out = [...byKey.values()]
  for (const m of out) m.low = m.projects.every(isLongText)
  return out.sort(compareUnits)
}
