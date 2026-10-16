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
const json = (v: unknown) => Buffer.from(JSON.stringify(v))

describe('loadPrevious', () => {
  it('is the first run when no release exists', async () => {
    const p = await loadPrevious(fake({}), B)
    expect(p).toMatchObject({ first: true, problems: [] })
  })

  it('empty state is not a problem', async () => {
    const p = await loadPrevious(fake({ [B + 'index.json']: json({ schema: 1, generated: 'x', tm: [], rules: [] }), [B + 'state.json']: json({ schema: 1, locales: {} }) }), B)
    expect(p).toMatchObject({ first: false, problems: [] })
  })

  it('reports a missing state.json', async () => {
    const p = await loadPrevious(fake({ [B + 'index.json']: json({ schema: 1, generated: 'x', tm: [], rules: [] }) }), B)
    expect(p.problems).toEqual(['state.json: HTTP 404'])
  })

  it('reports a state.json without a locales object instead of rejecting', async () => {
    const p = await loadPrevious(fake({
      [B + 'index.json']: json({ schema: 1, generated: 'x', tm: [], rules: [] }),
      [B + 'state.json']: json({ schema: 1 }),
    }), B)
    expect(p).toMatchObject({ first: false, problems: ['state.json: not a state file of schema 1'] })
  })

  it('loads units and drops a locale whose units file has the wrong hash', async () => {
    const good = encodeUnitsFile({ schema: 1, projects: { 'wp/dev': { built: 'b', units: [['s', '', 't']] } } })
    const state = {
      schema: 1,
      locales: {
        tr_TR: { units: 'https://example.test/u/tr', sha512: sha512(good), projects: { 'wp/dev': { units: 1, built: 'b', lastModified: 'm', currentCount: 1 } } },
        el: { units: 'https://example.test/u/el', sha512: 'bad', projects: {} },
      },
    }
    const p = await loadPrevious(fake({
      [B + 'index.json']: json({ schema: 1, generated: 'x', tm: [], rules: [] }),
      [B + 'state.json']: json(state),
      'https://example.test/u/tr': good,
      'https://example.test/u/el': good,
    }), B)
    expect(p.units.get('tr_TR')?.get('wp/dev')?.units).toEqual([{ source: 's', context: '', target: 't' }])
    expect(p.state.locales.el).toBeUndefined()
    expect(p.problems).toEqual(['el: units file sha512 mismatch'])
  })
})
