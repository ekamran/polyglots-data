import { describe, expect, it } from 'vitest'
import { polyglotsFindings, runPolyglotsCheck } from '../src/rules/polyglots.js'

describe('polyglots spawn failure', () => {
  it('names the spawn error when stderr is empty', async () => {
    const r = await runPolyglotsCheck('rules.yaml', '/nonexistent/polyglots-bin')
    expect(r.stderr).toBe('')
    expect(r.error).toMatch(/^ENOENT: /)
    expect(polyglotsFindings(r, 'f')[0]?.message).toMatch(/^polyglots rules check failed to run \(exit 2\) ENOENT: /)
  })

  it('prefers stderr when there is one', () => {
    expect(polyglotsFindings({ exitCode: 2, stderr: 'boom\n', error: 'x' }, 'f')[0]?.message).toBe('polyglots rules check failed to run (exit 2) boom')
  })
})
