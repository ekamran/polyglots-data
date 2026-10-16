import { expect, it } from 'vitest'
import { renderSummary } from '../src/summary.js'

it('renders sections with findings first', () => {
  expect(renderSummary([{ title: 'Scope', findings: [{ level: 'error', check: 'scope', message: 'm' }], lines: ['ok'] }]))
    .toBe('## Scope\n\n- **error** m\n- ok\n')
})
