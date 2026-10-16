import { expect, it, vi } from 'vitest'

// A UTF-8 Buffer cannot carry a lone surrogate, so the parser is faked to hand one over,
// as a future charset path in gettext-parser could.
const entries = vi.hoisted(() => ({ value: {} as Record<string, Record<string, unknown>> }))
vi.mock('gettext-parser', () => ({ po: { parse: () => ({ headers: {}, translations: entries.value }) } }))
const { poToUnits } = await import('../src/po/units.js')

const H = { msgid: '', msgstr: ['Content-Type: text/plain; charset=UTF-8\n'] }

it('rejects a lone surrogate in source, target or context as a parse failure', () => {
  const cases: Array<Record<string, Record<string, unknown>>> = [
    { '': { '': H, 'a\ud800': { msgid: 'a\ud800', msgstr: ['b'] } } },
    { '': { '': H, a: { msgid: 'a', msgstr: ['b\udc00'] } } },
    { '': { '': H }, '\ud800': { a: { msgid: 'a', msgstr: ['b'] } } },
  ]
  for (const c of cases) {
    entries.value = c
    expect(poToUnits(Buffer.from('msgid ""\n'))).toMatchObject({ ok: false, error: expect.stringMatching(/^parse: a lone surrogate/) })
  }
  entries.value = { '': { '': H, a: { msgid: 'a', msgstr: ['b'] } } }
  expect(poToUnits(Buffer.from('msgid ""\n'))).toEqual({ ok: true, units: [{ source: 'a', context: '', target: 'b' }] })
})
