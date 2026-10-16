import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadRepo } from '../src/config/load.js'

const wp = new Map([['tr_TR', { slug: 'tr', set: 'default' }], ['el', { slug: 'el', set: 'default' }]])
const fx = (name: string) => join(import.meta.dirname, 'fixtures', name)

describe('loadRepo', () => {
  it('loads a valid repository', () => {
    const { repo, issues } = loadRepo(fx('repo-ok'), wp)
    expect(issues).toEqual([])
    expect(repo.core).toEqual(['wp/dev', 'wp/dev/cc'])
    const tr = repo.locales.get('tr_TR')!
    expect(tr.tm?.exclude).toEqual(['wp/dev/cc'])
    expect(tr.meta?.maintainers[0]).toEqual({ wporg: 'emre', github: 'emreerkan', role: 'Locale Manager' })
    expect(tr.rulesFile).toMatch(/locales\/tr_TR\/rules\.yaml$/)
    expect(repo.locales.get('el')?.tm).toBeUndefined()
  })

  it('reports a missing core/tm.yaml instead of an empty core', () => {
    const { repo, issues } = loadRepo(fx('repo-nocore'), wp)
    expect(repo.core).toEqual([])
    expect(issues).toEqual([{ file: join(fx('repo-nocore'), 'core', 'tm.yaml'), message: 'core/tm.yaml is missing' }])
  })

  it('reports every problem with its file', () => {
    const { issues } = loadRepo(fx('repo-bad'), wp)
    const text = issues.map((i) => `${i.file.split('fixtures/repo-bad/')[1]}: ${i.message}`)
    expect(text).toEqual(expect.arrayContaining([
      expect.stringMatching(/^locales\/tr_TR\/tm\.yaml: .*wp\/dev.*already a core project/),
      expect.stringMatching(/^locales\/tr_TR\/tm\.yaml: .*a URL, not a path; write wp-plugins\/acf\/dev/),
      expect.stringMatching(/^locales\/tr_TR\/tm\.yaml: .*added/),
      expect.stringMatching(/^locales\/tr_TR\/tm\.yaml: .*typo/),
      expect.stringMatching(/^locales\/tr_TR\/tm\.yaml: .*exclude wp-plugins\/not-core\/dev is not a core project/),
      expect.stringMatching(/^locales\/tr_TR\/locale\.yaml: .*locale must be tr_TR/),
      expect.stringMatching(/^locales\/tr_TR\/locale\.yaml: .*wporg/),
      expect.stringMatching(/^locales\/xx_YY: .*not a WordPress locale/),
      expect.stringMatching(/^locales\/xx_YY: .*locale\.yaml is missing/),
    ]))
  })
})
