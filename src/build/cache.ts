import type { SetInfo } from '../wporg/api.js'

export interface CachedProject { units: number; built: string; lastModified: string; currentCount: number }

export const REFRESH_DAYS = 90
const DAY = 86_400_000

/**
 * Whether an export must be downloaded again. The API's last_modified is the
 * newest translation in the set; a plugin that removes strings changes
 * current_count but not last_modified, and the 90-day refresh catches what
 * both miss.
 */
export function needsDownload(cached: CachedProject | undefined, set: SetInfo | undefined, nowMs: number, force: boolean): boolean {
  if (force || !cached || !set) return true
  if (set.lastModified !== cached.lastModified || set.currentCount !== cached.currentCount) return true
  return nowMs - Date.parse(cached.built) > REFRESH_DAYS * DAY
}
