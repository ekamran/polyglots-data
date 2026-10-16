import { expect, it } from 'vitest'
import { resolveProjects } from '../src/resolve.js'

it('puts core first, drops excluded, then adds the locale list', () => {
  const tm = { projects: [{ path: 'wp-plugins/a/dev', added: '', by: '', reviewed: '' }], exclude: ['wp/dev/cc'] }
  expect(resolveProjects(['wp/dev', 'wp/dev/cc'], tm)).toEqual(['wp/dev', 'wp-plugins/a/dev'])
})
