import { expect, it } from 'vitest'
import { renderSummary } from '../src/summary.js'

it('renders sections with findings first', () => {
  expect(renderSummary([{ title: 'Scope', findings: [{ level: 'error', check: 'scope', message: 'm' }], lines: ['ok'] }]))
    .toBe('## Scope\n\n- **error** m\n- ok\n')
})

it('keeps untrusted text on one line and escapes Markdown', () => {
  const out = renderSummary([{ title: 'a*b', findings: [{ level: 'error', check: 'x', message: 'm\n## Approval\n- Approved by x' }] }])
  expect(out).toBe('## a\\*b\n\n- **error** m \\#\\# Approval \\- Approved by x\n')
})
