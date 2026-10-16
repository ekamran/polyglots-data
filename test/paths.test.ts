import { describe, expect, it } from 'vitest'
import { isLongText, normalizePath } from '../src/paths.js'

describe('isLongText', () => {
  it('matches the three long-text segments only as the last segment', () => {
    expect(isLongText('wp-plugins/acf/dev-readme')).toBe(true)
    expect(isLongText('wp-plugins/acf/stable-readme')).toBe(true)
    expect(isLongText('meta/release-notes')).toBe(true)
    expect(isLongText('wp-plugins/acf/dev')).toBe(false)
    expect(isLongText('wp-plugins/dev-readme/dev')).toBe(false)
  })
})

describe('normalizePath', () => {
  it('accepts a plain path', () => {
    expect(normalizePath('wp-plugins/advanced-custom-fields/dev')).toEqual({ ok: true, path: 'wp-plugins/advanced-custom-fields/dev' })
  })
  it('turns a pasted project URL into a suggestion', () => {
    const r = normalizePath('https://translate.wordpress.org/projects/wp-plugins/advanced-custom-fields/dev/tr/default/')
    expect(r).toEqual({ ok: false, error: 'a URL, not a path', suggestion: 'wp-plugins/advanced-custom-fields/dev' })
  })
  it('suggests for a URL without locale', () => {
    const r = normalizePath('https://translate.wordpress.org/projects/wp/dev/admin/')
    expect(r).toMatchObject({ ok: false, suggestion: 'wp/dev/admin' })
  })
  it('rejects dot-only segments', () => {
    expect(normalizePath('wp/../x').ok).toBe(false)
    expect(normalizePath('wp/./x').ok).toBe(false)
    expect(normalizePath('wp/x/..').ok).toBe(false)
  })
  it('keeps a dot inside a segment', () => {
    expect(normalizePath('wp-plugins/a.b/dev')).toEqual({ ok: true, path: 'wp-plugins/a.b/dev' })
  })
  it('rejects slashes at the ends and upper case', () => {
    expect(normalizePath('/wp/dev').ok).toBe(false)
    expect(normalizePath('wp/dev/').ok).toBe(false)
    expect(normalizePath('WP/dev').ok).toBe(false)
  })
})

describe('normalizePath with translation sets', () => {
  it('strips the latin set from a pasted URL', () => {
    const r = normalizePath('https://translate.wordpress.org/projects/wp-plugins/advanced-custom-fields/dev/sr/latin/')
    expect(r).toMatchObject({ ok: false, suggestion: 'wp-plugins/advanced-custom-fields/dev' })
  })
})
