import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { loadPrevious } from '../src/build/previous.js'
import { encodeUnitsFile, sha512 } from '../src/build/state.js'
import type { HttpClient } from '../src/wporg/client.js'

const fake = (files: Record<string, Buffer | number>): HttpClient => ({
  async get(url) {
    const f = files[url]
    if (f === undefined) return { ok: false, status: 404, error: 'HTTP 404' }
    if (typeof f === 'number') return { ok: false, status: f, error: `HTTP ${f}` }
    return { ok: true, status: 200, body: f }
  },
})
const B = 'https://example.test/latest/'
const U = 'https://example.test/u/'
const json = (v: unknown) => Buffer.from(JSON.stringify(v))
const gz = (v: unknown) => gzipSync(Buffer.from(JSON.stringify(v)))
const INDEX = json({ schema: 1, generated: 'x', tm: [], rules: [] })

describe('loadPrevious', () => {
  it('is the first run when no release exists', async () => {
    const p = await loadPrevious(fake({}), B, U)
    expect(p).toMatchObject({ first: true, problems: [] })
  })

  it('empty state is not a problem', async () => {
    const p = await loadPrevious(fake({ [B + 'index.json']: INDEX, [B + 'state.json']: json({ schema: 1, locales: {} }) }), B, U)
    expect(p).toMatchObject({ first: false, problems: [] })
  })

  it('reports a missing state.json', async () => {
    const p = await loadPrevious(fake({ [B + 'index.json']: INDEX }), B, U)
    expect(p.problems).toEqual(['state.json: HTTP 404'])
  })

  it('loads units and drops a locale whose units file has the wrong hash', async () => {
    const good = encodeUnitsFile({ schema: 1, projects: { 'wp/dev': { built: 'b', units: [['s', '', 't']] } } })
    const state = {
      schema: 1,
      locales: {
        tr_TR: { units: U + 'tr', sha512: sha512(good), projects: { 'wp/dev': { units: 1, built: 'b', lastModified: 'm', currentCount: 1 } } },
        el: { units: U + 'el', sha512: 'bad', projects: {} },
      },
    }
    const p = await loadPrevious(fake({
      [B + 'index.json']: INDEX,
      [B + 'state.json']: json(state),
      [U + 'tr']: good,
      [U + 'el']: good,
    }), B, U)
    expect(p.units.get('tr_TR')?.get('wp/dev')?.units).toEqual([{ source: 's', context: '', target: 't' }])
    expect(p.state.locales.el).toBeUndefined()
    expect(p.problems).toEqual(['el: units file sha512 mismatch'])
  })

  it('reports a state.json without a locales object instead of rejecting', async () => {
    const p = await loadPrevious(fake({
      [B + 'index.json']: INDEX,
      [B + 'state.json']: json({ schema: 1 }),
    }), B, U)
    expect(p).toMatchObject({ first: false, problems: ['state.json: not a state file of schema 1'] })
  })

  it('treats a parseable but wrong-shaped index as a problem with no index and no state load', async () => {
    for (const bad of [[], null, { schema: 2, tm: [], rules: [] }, { schema: 1, tm: {}, rules: [] }]) {
      const seen: string[] = []
      const base = fake({ [B + 'index.json']: json(bad), [B + 'state.json']: json({ schema: 1, locales: {} }) })
      const client: HttpClient = { get: (u) => { seen.push(u); return base.get(u) } }
      const p = await loadPrevious(client, B, U)
      expect(p).toMatchObject({ first: false, problems: ['index.json: not a manifest of schema 1'] })
      expect(p.index).toBeUndefined()
      expect(seen).toEqual([B + 'index.json'])
    }
  })

  it('reports a null locale entry or a locale missing units without throwing', async () => {
    const p = await loadPrevious(fake({
      [B + 'index.json']: INDEX,
      [B + 'state.json']: json({ schema: 1, locales: { a: null, b: { sha512: 'x', projects: {} } } }),
    }), B, U)
    expect(p.problems).toEqual(['a: state entry malformed', 'b: state entry malformed'])
    expect(p.state.locales).toEqual({})
  })

  it('reports a units file with a non-string unit field and a units file with projects null', async () => {
    const badUnit = gz({ schema: 1, projects: { 'wp/dev': { built: 'b', units: [['s', 1, 't']] } } })
    const nullProjects = gz({ schema: 1, projects: null })
    const p = await loadPrevious(fake({
      [B + 'index.json']: INDEX,
      [B + 'state.json']: json({
        schema: 1,
        locales: {
          tr_TR: { units: U + 'tr', sha512: sha512(badUnit), projects: {} },
          el: { units: U + 'el', sha512: sha512(nullProjects), projects: {} },
        },
      }),
      [U + 'tr']: badUnit,
      [U + 'el']: nullProjects,
    }), B, U)
    expect(p.problems).toEqual([
      'tr_TR: units file: wp/dev has a malformed unit',
      'el: not a units file of schema 1',
    ])
    expect(p.units.size).toBe(0)
  })

  it('makes no request for a units URL outside the release prefix', async () => {
    const base = fake({
      [B + 'index.json']: INDEX,
      [B + 'state.json']: json({ schema: 1, locales: { tr_TR: { units: 'https://evil.test/x', sha512: 'x', projects: {} } } }),
    })
    const seen: string[] = []
    const client: HttpClient = { get: (u) => { seen.push(u); return base.get(u) } }
    const p = await loadPrevious(client, B, U)
    expect(seen).toEqual([B + 'index.json', B + 'state.json'])
    expect(p.problems).toEqual(['tr_TR: units URL outside the release'])
  })
})
