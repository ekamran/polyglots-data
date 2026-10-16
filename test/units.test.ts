import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { poToUnits } from '../src/po/units.js'

const po = (name: string) => readFileSync(join(import.meta.dirname, 'fixtures/po', name))

describe('poToUnits', () => {
  it('adds the plural unit only with nplurals=2', () => {
    const r = poToUnits(po('plural2.po'))
    if (!r.ok) throw new Error(r.error)
    expect(r.units).toEqual(expect.arrayContaining([
      { source: '%d post', context: '', target: '%d yazı' },
      { source: '%d posts', context: '', target: '%d yazı' },
      { source: 'Post', context: 'verb', target: 'Yayınla' },
      { source: 'Post', context: '', target: 'Yazı' },
    ]))
    expect(r.units).toHaveLength(4)
  })

  it('keeps only msgstr[0] with three forms', () => {
    const r = poToUnits(po('plural3.po'))
    expect(r).toEqual({ ok: true, units: [{ source: '%d file', context: '', target: '%d plik' }] })
  })

  it('fails on a character XML 1.0 cannot hold', () => {
    const r = poToUnits(po('mixed.po'))
    expect(r).toMatchObject({ ok: false })
    if (!r.ok) expect(r.error).toMatch(/not allowed in XML/)
  })

  it('rejects an HTML page', () => {
    expect(poToUnits(po('error.html'))).toEqual({ ok: false, error: 'not a .po file' })
  })

  it('accepts an export with no entries', () => {
    expect(poToUnits(po('empty.po'))).toEqual({ ok: true, units: [] })
  })

  it('skips fuzzy and blank entries', () => {
    expect(poToUnits(po('fuzzy-blank.po'))).toEqual({ ok: true, units: [{ source: 'Good', context: '', target: 'İyi' }] })
  })
})

describe('poToUnits input checks', () => {
  it('rejects a text page that starts with # and parses without a header', () => {
    expect(poToUnits(Buffer.from('# Maintenance\n'))).toEqual({ ok: false, error: 'not a .po file' })
    expect(poToUnits(Buffer.from('# note\n\nmsgid "a"\nmsgstr "b"\n'))).toEqual({ ok: false, error: 'not a .po file' })
    expect(poToUnits(Buffer.from('# Error\nSomething went wrong\n'))).toMatchObject({ ok: false })
  })
})
