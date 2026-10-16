import { describe, expect, it } from 'vitest'
import { buildArgErrors, localesFromChanges, parseList, parseSmokeMax } from '../src/cli/args.js'

it('parses lists', () => expect(parseList(['tr_TR,es_ES', ' el ', ''])).toEqual(['tr_TR', 'es_ES', 'el']))
it('rebuilds all on a core change', () => expect(localesFromChanges(['core/tm.yaml'], ['tr_TR', 'es_ES'])).toEqual(['es_ES', 'tr_TR']))
it('rebuilds changed locales only', () => expect(localesFromChanges(['locales/tr_TR/tm.yaml', 'locales/el/rules.yaml', 'README.md'], ['tr_TR', 'es_ES'])).toEqual(['tr_TR']))

it('accepts a smoke max of 1 to 3', () => {
  expect(parseSmokeMax(undefined)).toBe(3)
  expect(parseSmokeMax('1')).toBe(1)
  expect(parseSmokeMax('3')).toBe(3)
})
it('rejects other smoke max values', () => {
  for (const v of ['-1', '0', '4', 'abc', '', '1.5']) expect(() => parseSmokeMax(v)).toThrow('--max must be 1, 2 or 3')
})

describe('buildArgErrors', () => {
  const base = { root: '/repo', out: 'dist', locales: [], accept: [], withTm: ['tr_TR', 'el'] }
  it('accepts good arguments', () => {
    expect(buildArgErrors({ ...base, locales: ['tr_TR'], accept: ['tr_TR:wp-plugins/a/dev'], changedFrom: '0'.repeat(40) })).toEqual([])
    expect(buildArgErrors({ ...base, changedFrom: 'a'.repeat(40) })).toEqual([])
    expect(buildArgErrors({ ...base, out: '..dist' })).toEqual([])
    expect(buildArgErrors({ ...base, out: '/repo/tmp/out' })).toEqual([])
  })
  it('refuses an --out that is the root, a parent or outside the repo', () => {
    for (const out of ['.', '..', '/', '/repo', '/elsewhere', '../sibling', 'dist/../..']) {
      expect(buildArgErrors({ ...base, out })).toEqual([expect.stringMatching(/^--out /)])
    }
  })
  it('refuses a locale that is not a TM locale', () => {
    expect(buildArgErrors({ ...base, locales: ['xx'] })).toEqual(['--locale xx is not a TM locale; TM locales: el, tr_TR'])
  })
  it('refuses a malformed --accept', () => {
    expect(buildArgErrors({ ...base, accept: ['wp/dev', 'xx:wp/dev', 'tr_TR:../x', 'tr_TR:'] })).toEqual([
      '--accept wp/dev must be locale:path',
      '--accept xx:wp/dev: xx is not a TM locale; TM locales: el, tr_TR',
      '--accept tr_TR:../x: ../x is not a project path',
      '--accept tr_TR: must be locale:path',
    ])
  })
  it('refuses a --changed-from that is not a full sha or zeros', () => {
    for (const c of ['HEAD', 'abc123', '--output=x', 'A'.repeat(40)]) expect(buildArgErrors({ ...base, changedFrom: c })).toHaveLength(1)
  })
})
