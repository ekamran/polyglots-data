import { expect, it } from 'vitest'
import { approvalLines } from '../src/check/approval.js'

const m = [{ wporg: 'emre', github: 'emreerkan', role: 'Locale Manager' as const }, { wporg: 'gte2', role: 'General Translation Editor' as const }]

it('uses the latest review per reviewer', () => {
  expect(approvalLines([
    { login: 'emreerkan', state: 'APPROVED', submittedAt: '2026-10-16T01:00:00Z' },
    { login: 'emreerkan', state: 'CHANGES_REQUESTED', submittedAt: '2026-10-16T02:00:00Z' },
  ], m, 'tr_TR')).toEqual(['No approval from a tr_TR maintainer.', 'gte2 (General Translation Editor) approves outside GitHub; the repository maintainer notes it in the pull request.'])
})
it('reports an approval', () => {
  expect(approvalLines([{ login: 'emreerkan', state: 'APPROVED', submittedAt: '2026-10-16T01:00:00Z' }], m, 'tr_TR')[0]).toBe('Approved by emre (@emreerkan, tr_TR maintainer).')
})
it('ignores comments', () => {
  expect(approvalLines([{ login: 'emreerkan', state: 'APPROVED', submittedAt: '1' }, { login: 'emreerkan', state: 'COMMENTED', submittedAt: '2' }], m, 'tr_TR')[0]).toMatch(/^Approved/)
})
it('does not count an approval on an earlier commit', () => {
  const r = approvalLines([{ login: 'emreerkan', state: 'APPROVED', submittedAt: '1', commitId: 'old' }], m, 'tr_TR', 'new')
  expect(r[0]).toBe('Approved by emre (@emreerkan) on an earlier commit; not counted.')
  expect(r[1]).toBe('No approval from a tr_TR maintainer.')
})
it('counts an approval on the head commit', () => {
  expect(approvalLines([{ login: 'emreerkan', state: 'APPROVED', submittedAt: '1', commitId: 'new' }], m, 'tr_TR', 'new')[0]).toBe('Approved by emre (@emreerkan, tr_TR maintainer).')
})
