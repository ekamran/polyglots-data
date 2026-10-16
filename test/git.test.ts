import { expect, it } from 'vitest'
import { isFullSha } from '../src/check/git.js'

it('accepts only full lowercase shas', () => {
  expect(isFullSha('a'.repeat(40))).toBe(true)
  expect(isFullSha('0'.repeat(64))).toBe(true)
  for (const bad of ['abcdef1', 'A'.repeat(40), '-x', '', undefined]) expect(isFullSha(bad)).toBe(false)
})
