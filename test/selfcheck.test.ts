import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { selfCheck } from '../src/build/selfcheck.js'
import { sha512, type State } from '../src/build/state.js'
import { releaseUrl, type Manifest } from '../src/manifest.js'

const TAG = 'data-20261016-030000'
const xml = Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n<tmx version="1.4"><body><tu></tu></body></tmx>\n')

function setup(gz: Buffer) {
  const manifest: Manifest = {
    schema: 1, generated: 'g',
    tm: [{ locale: 'tr_TR', slug: 'tr', url: releaseUrl(TAG, 'tr_TR.tmx.gz'), bytes: gz.length, bytesUncompressed: xml.length, sha512: sha512(gz), units: 1, built: 'b', projects: [] }],
    rules: [{ locale: 'el', slug: 'el', url: releaseUrl('data-20261001-030000', 'el.rules.yaml'), sha512: 'old', schema: 1, minPolyglots: '1.0.0', status: 'draft', maintainers: [] }],
  }
  const state: State = { schema: 1, locales: {} }
  const assets = new Map<string, Buffer>([
    ['tr_TR.tmx.gz', gz],
    ['index.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n')],
    ['state.json', Buffer.from(JSON.stringify(state, null, 2) + '\n')],
  ])
  return { manifest, state, assets }
}

describe('selfCheck', () => {
  it('passes good assets and skips entries carried over from an older release', () => {
    const { manifest, state, assets } = setup(gzipSync(xml))
    expect(selfCheck(assets, manifest, state, TAG)).toEqual([])
  })

  it('reports a TMX that is not gzip instead of throwing', () => {
    const { manifest, state, assets } = setup(Buffer.from('not gzip'))
    const p = selfCheck(assets, manifest, state, TAG)
    expect(p).toHaveLength(1)
    expect(p[0]).toMatch(/^tr_TR: TMX: /)
  })

  it('reports index.json and state.json that do not match the objects', () => {
    const { manifest, state, assets } = setup(gzipSync(xml))
    assets.set('index.json', Buffer.from(JSON.stringify({ ...manifest, generated: 'other' })))
    assets.set('state.json', Buffer.from('{'))
    const p = selfCheck(assets, manifest, state, TAG)
    expect(p[0]).toBe('index.json does not match the manifest')
    expect(p[1]).toMatch(/^state\.json: /)
  })
})
