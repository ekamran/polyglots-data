import { join } from 'node:path'
import { expect, it } from 'vitest'
import { loadRepo } from '../src/config/load.js'
import { loadWpLocales } from '../src/locales.js'

it('the committed data files are valid', () => {
  const root = join(import.meta.dirname, '..')
  const { repo, issues } = loadRepo(root, loadWpLocales(root))
  expect(issues).toEqual([])
  expect(repo.core.length).toBeGreaterThan(0)
  expect(repo.locales.get('tr_TR')?.tm?.projects.length).toBeGreaterThan(0)
})
