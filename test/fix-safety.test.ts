import { describe, expect, it } from 'vitest'
import { applyFix, countUnsafe, dynamicFixFindings, fixSamples, staticFixFindings } from '../src/rules/fix-safety.js'

const tr = { where: 'patterns[5]', find: "(?<![\\p{L}\\p{M}'’])([Yy])ada(?![\\p{L}\\p{M}])", replace: '$1a da' }

describe('staticFixFindings', () => {
  it('accepts the tr_TR fix', () => expect(staticFixFindings([tr], 'r')).toEqual([]))
  it('refuses unsafe literals', () => {
    const msgs = staticFixFindings([
      { where: 'a', text: 'x', replace: '<b>' },
      { where: 'b', text: 'x', replace: 'see example.com' },
      { where: 'c', text: 'x', replace: 'y'.repeat(201) },
      { where: 'd', find: 'x', replace: '$&$&' },
    ], 'r').map((f) => f.message)
    expect(msgs).toEqual([
      'a: the replacement adds <, >, ://, www. or a domain',
      'b: the replacement adds <, >, ://, www. or a domain',
      'c: the replacement is 201 characters, the limit is 200',
      'd: $&, $` and $\' are not allowed in a replacement',
    ])
  })
  it('refuses a capture of a group that can hold anything', () => {
    expect(staticFixFindings([{ where: 'e', find: '(.+)x', replace: '$1' }], 'r')[0]?.message)
      .toBe('e: $1 refers to a group that is not a character class or a list of plain words')
    expect(staticFixFindings([{ where: 'f', find: '(?<w>foo|bar)x', replace: '$<w>' }], 'r')).toEqual([])
    expect(staticFixFindings([{ where: 'g', find: '([!-~])', replace: '$1' }], 'r')[0]?.message).toMatch(/^g: \$1 refers/)
  })
})

describe('dynamic', () => {
  it('applies a find fix and a text fix', () => {
    expect(applyFix(tr, 'Yada bu')).toBe('Ya da bu')
    expect(applyFix({ where: 'x', text: 'a  b', replace: 'a b' }, 'a  b a  b')).toBe('a b a b')
  })
  it('fails a fix that adds a URL token', () => {
    const f = dynamicFixFindings([{ where: 'x', find: '(foo)', replace: 'www.$1' }], ['foo'], 'r')
    expect(f[0]?.message).toBe('x: turns "foo" into "www.foo", which adds <, >, ://, www. or a domain')
  })
  it('counts tokens', () => expect(countUnsafe('<a href="https://x.org">')).toBe(4))
  it('gives samples', () => expect(fixSamples(tr, ['yada', 'no', 'Yada'])).toEqual([{ before: 'yada', after: 'ya da' }, { before: 'Yada', after: 'Ya da' }]))
})

describe('round 1: a capture reference does not hide a URL', () => {
  it('refuses a literal dot, slash or colon next to a capture reference', () => {
    expect(staticFixFindings([
      { where: 'x', find: '(a)', replace: '$1.com' },
      { where: 'y', find: '(w)', replace: '$1$1$1.' },
      { where: 'z', find: '(w)', replace: '$1/x' },
    ], 'r').map((f) => f.message)).toEqual([
      "x: a replacement with a capture reference must not contain '.', '/' or ':'",
      "y: a replacement with a capture reference must not contain '.', '/' or ':'",
      "z: a replacement with a capture reference must not contain '.', '/' or ':'",
    ])
  })
  it('accepts a capture reference with plain letters', () => {
    expect(staticFixFindings([{ where: 'ok', find: '(w)', replace: '$1 x' }], 'r')).toEqual([])
  })
})

describe('round 1: every group with a duplicate name must be safe', () => {
  it('refuses a name when one of its groups can hold anything', () => {
    expect(staticFixFindings([{ where: 'h', find: '(?<w>a)|(?<w>.+)', replace: '$<w>' }], 'r').map((f) => f.message)).toEqual([
      'h: $<w> refers to a group that is not a character class or a list of plain words',
    ])
  })
  it('accepts a name whose groups are all safe', () => {
    expect(staticFixFindings([{ where: 'i', find: '(?<w>a|b)|(?<w>c)', replace: '$<w>' }], 'r')).toEqual([])
  })
})

describe('round 1: the dynamic check compares tokens, not counts', () => {
  it('refuses a fix that swaps one unsafe token for another', () => {
    expect(dynamicFixFindings([{ where: 't', text: 'a.com', replace: '<' }], ['a.com'], 'r').map((f) => f.message)).toEqual([
      't: turns "a.com" into "<", which adds <, >, ://, www. or a domain',
    ])
  })
  it('accepts a fix that removes an unsafe token', () => {
    expect(dynamicFixFindings([{ where: 's', text: 'a.com', replace: 'a' }], ['a.com x'], 'r')).toEqual([])
  })
  it('accepts a fix that keeps the same token in a different case', () => {
    expect(dynamicFixFindings([{ where: 'c', text: 'A.COM', replace: 'a.com' }], ['A.COM'], 'r')).toEqual([])
  })
  it('accepts the tr_TR fix on Turkish words', () => {
    expect(dynamicFixFindings([tr], ['Yada bu', 'yada'], 'r')).toEqual([])
  })
})

describe('round 1: a fix that cannot run is reported', () => {
  it('reports a throwing fix once', () => {
    const f = dynamicFixFindings([{ where: 'p', find: '(', replace: 'y' }], ['foo', 'bar'], 'r')
    expect(f).toHaveLength(1)
    expect(f[0]?.message).toMatch(/^p: the fix cannot run \(.+\)$/)
  })
  it('gives no samples for a throwing fix', () => {
    expect(fixSamples({ where: 'p', find: '(', replace: 'y' }, ['foo'])).toEqual([])
  })
})
