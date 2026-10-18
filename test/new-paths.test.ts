import { describe, expect, it } from 'vitest'
import { addedPaths, newPathFindings, newPathsCap } from '../src/check/new-paths.js'
import type { HttpClient } from '../src/wporg/client.js'
import { apiUrl } from '../src/wporg/urls.js'

const yaml = (paths: string[]) => 'projects:\n' + paths.map((p) => `  - path: ${p}\n    added: 2026-10-16\n    by: emre\n    reviewed: r\n`).join('')
const sets = (current: number, all: number) => Buffer.from(JSON.stringify({ translation_sets: [{ locale: 'tr', slug: 'default', wp_locale: 'tr_TR', current_count: current, all_count: all, percent_translated: Math.floor((current / all) * 100), last_modified: 'x' }] }))
const client = (files: Record<string, Buffer>): HttpClient => ({ async get(u) { const b = files[u]; return b ? { ok: true, status: 200, body: b } : { ok: false, status: 404, error: 'HTTP 404' } } })
const tr = [{ code: 'tr_TR', slug: 'tr', set: 'default' }]

describe('new paths', () => {
  it('finds only added paths', () => expect(addedPaths(yaml(['a/dev']), yaml(['a/dev', 'b/dev']))).toEqual(['b/dev']))
  it('treats a missing base as empty', () => expect(addedPaths(undefined, yaml(['a/dev']))).toEqual(['a/dev']))
  it('drops paths that fail PATH_RE before they count', () => {
    const bad = Array.from({ length: 30 }, (_, i) => `../x${i}`)
    expect(addedPaths(undefined, yaml([...bad, 'https://evil.test/x', 'Wp/Dev', 'ok/dev']))).toEqual(['ok/dev'])
  })
  it('reports counts and enforces 90% except for long text', async () => {
    const r = await newPathFindings(['wp-plugins/acf/dev', 'wp-plugins/low/dev', 'wp-plugins/low/dev-readme', 'wp-plugins/none/dev'], tr, client({
      [apiUrl('wp-plugins/acf/dev')]: sets(1746, 1790),
      [apiUrl('wp-plugins/low/dev')]: sets(50, 100),
      [apiUrl('wp-plugins/low/dev-readme')]: sets(5, 100),
    }))
    expect(r.lines).toContain('wp-plugins/acf/dev, tr_TR: 1,746 approved of 1,790 (97%)')
    expect(r.findings.map((f) => f.message)).toEqual([
      'wp-plugins/low/dev, tr_TR: 50% approved, at least 90% is needed',
      'wp-plugins/none/dev: not found on translate.wordpress.org (HTTP 404)',
    ])
  })
  it('refuses more than 20 new paths without a request', async () => {
    const paths = Array.from({ length: 21 }, (_, i) => `p/${i}`)
    const r = await newPathFindings(paths, tr, client({}))
    expect(r.findings).toEqual([{ level: 'error', check: 'new-paths', message: '21 new paths; at most 20 per pull request, split it' }])
  })
  it('lets the repository maintainer add more than 20 new paths', async () => {
    const paths = Array.from({ length: 21 }, (_, i) => `wp-plugins/p${i}/dev`)
    const files = Object.fromEntries(paths.map((p) => [apiUrl(p), sets(100, 100)]))
    const r = await newPathFindings(paths, tr, client(files), 'emreerkan')
    expect(r.findings).toEqual([])
    expect(r.lines).toHaveLength(21)
  })
  it('caps everyone but the repository maintainer', () => {
    expect(newPathsCap(20, 'someone')).toBeUndefined()
    expect(newPathsCap(21, 'someone')?.message).toBe('21 new paths; at most 20 per pull request, split it')
    expect(newPathsCap(21, '')).toBeDefined()
    expect(newPathsCap(200, 'emreerkan')).toBeUndefined()
  })
})
