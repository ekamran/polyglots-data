import { expect, it } from 'vitest'
import { localesFromChanges, parseList, parseSmokeMax } from '../src/cli/args.js'

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
