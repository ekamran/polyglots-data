import { expect, it } from 'vitest'
import { needsDownload } from '../src/build/cache.js'

const now = Date.parse('2026-10-16T03:00:00Z')
const cached = { units: 84, built: '2026-10-01T03:00:00Z', lastModified: '2026-09-27 21:47:28', currentCount: 84 }
const set = { locale: 'tr', slug: 'default', wpLocale: 'tr_TR', currentCount: 84, allCount: 84, percent: 100, lastModified: '2026-09-27 21:47:28' }

it('reuses the cache when nothing changed', () => expect(needsDownload(cached, set, now, false)).toBe(false))
it('downloads with no cache', () => expect(needsDownload(undefined, set, now, false)).toBe(true))
it('downloads when last_modified changed', () => expect(needsDownload(cached, { ...set, lastModified: '2026-10-15 00:00:00' }, now, false)).toBe(true))
it('downloads when current_count changed', () => expect(needsDownload(cached, { ...set, currentCount: 80 }, now, false)).toBe(true))
it('downloads after 90 days', () => expect(needsDownload({ ...cached, built: '2026-07-17T02:00:00Z' }, set, now, false)).toBe(true))
it('downloads with force', () => expect(needsDownload(cached, set, now, true)).toBe(true))
it('downloads when the API gave nothing', () => expect(needsDownload(cached, undefined, now, false)).toBe(true))
