import { gzipSync } from 'node:zlib'
import { expect, it } from 'vitest'
import { decodeUnitsFile, encodeUnitsFile, sha512 } from '../src/build/state.js'

it('round-trips a units file deterministically', () => {
  const a = encodeUnitsFile({ schema: 1, projects: { 'wp/z': { built: 'b', units: [['s', '', 't']] }, 'wp/a': { built: 'b', units: [] } } })
  const b = encodeUnitsFile({ schema: 1, projects: { 'wp/a': { built: 'b', units: [] }, 'wp/z': { built: 'b', units: [['s', '', 't']] } } })
  expect(sha512(a)).toBe(sha512(b))
  expect(Object.keys(decodeUnitsFile(a).projects)).toEqual(['wp/a', 'wp/z'])
})

it('rejects a units file with a malformed unit or null projects', () => {
  const bad = gzipSync(Buffer.from(JSON.stringify({ schema: 1, projects: { 'wp/dev': { built: 'b', units: [['s', 1, 't']] } } })))
  expect(() => decodeUnitsFile(bad)).toThrow('units file: wp/dev has a malformed unit')
  const nul = gzipSync(Buffer.from(JSON.stringify({ schema: 1, projects: null })))
  expect(() => decodeUnitsFile(nul)).toThrow('not a units file of schema 1')
})
