import type { Unit } from '../types.js'

export interface LastGood { built: string; units: Unit[]; lastModified: string; currentCount: number }
export type Fresh = { ok: true; units: Unit[] } | { ok: false; error: string }
export type Outcome =
  | { kind: 'fresh'; units: Unit[] }
  | { kind: 'stale'; last: LastGood; reason: string }
  | { kind: 'missing'; reason: string }

export const DROP_RATIO = 0.8
export const DROP_FLOOR = 50

/** Spec 5.5: a broken download or a sudden shrink never replaces good units. */
export function decideProject(fresh: Fresh, last: LastGood | undefined, accepted: boolean): Outcome {
  if (!fresh.ok) return last ? { kind: 'stale', last, reason: fresh.error } : { kind: 'missing', reason: fresh.error }
  if (!last || accepted || last.units.length < DROP_FLOOR) return { kind: 'fresh', units: fresh.units }
  if (fresh.units.length < last.units.length * DROP_RATIO) {
    return { kind: 'stale', last, reason: `${fresh.units.length} units, last good ${last.units.length}` }
  }
  return { kind: 'fresh', units: fresh.units }
}
