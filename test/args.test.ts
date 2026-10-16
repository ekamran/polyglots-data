import { expect, it } from 'vitest'
import { localesFromChanges, parseList } from '../src/cli/args.js'

it('parses lists', () => expect(parseList(['tr_TR,es_ES', ' el ', ''])).toEqual(['tr_TR', 'es_ES', 'el']))
it('rebuilds all on a core change', () => expect(localesFromChanges(['core/tm.yaml'], ['tr_TR', 'es_ES'])).toEqual(['es_ES', 'tr_TR']))
it('rebuilds changed locales only', () => expect(localesFromChanges(['locales/tr_TR/tm.yaml', 'locales/el/rules.yaml', 'README.md'], ['tr_TR', 'es_ES'])).toEqual(['tr_TR']))
