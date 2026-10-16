import { describe, expect, it } from 'vitest'
import { decideProject } from '../src/build/decide.js'

const u = (n: number) => Array.from({ length: n }, (_, i) => ({ source: `s${i}`, context: '', target: `t${i}` }))
const last = (n: number) => ({ built: '2026-10-09T03:00:00Z', units: u(n), lastModified: 'x', currentCount: n })

describe('decideProject', () => {
  it('uses fresh with no last good', () => expect(decideProject({ ok: true, units: u(5) }, undefined, false)).toEqual({ kind: 'fresh', units: u(5) }))
  it('uses fresh at exactly 80%', () => expect(decideProject({ ok: true, units: u(80) }, last(100), false).kind).toBe('fresh'))
  it('goes stale below 80%', () => expect(decideProject({ ok: true, units: u(79) }, last(100), false)).toMatchObject({ kind: 'stale', reason: expect.stringMatching(/79 units, last good 100/) }))
  it('accepts a shrink when asked', () => expect(decideProject({ ok: true, units: u(10) }, last(100), true).kind).toBe('fresh'))
  it('ignores the drop rule under 50 units', () => expect(decideProject({ ok: true, units: u(9) }, last(49), false).kind).toBe('fresh'))
  it('goes stale on failure with last good', () => expect(decideProject({ ok: false, error: 'HTTP 503' }, last(100), false)).toMatchObject({ kind: 'stale', reason: 'HTTP 503' }))
  it('is missing on failure without last good', () => expect(decideProject({ ok: false, error: 'HTTP 404' }, undefined, false)).toEqual({ kind: 'missing', reason: 'HTTP 404' }))
})
