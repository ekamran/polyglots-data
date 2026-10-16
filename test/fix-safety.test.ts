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
