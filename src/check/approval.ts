import type { Maintainer } from '../config/load.js'

export interface Review { login: string; state: string; submittedAt: string }

/** Check 6: reports, never fails. Maintainers come from the base branch. */
export function approvalLines(reviews: Review[], maintainers: Maintainer[], locale: string): string[] {
  const latest = new Map<string, Review>()
  for (const r of [...reviews].filter((x) => x.state !== 'COMMENTED').sort((a, b) => (a.submittedAt < b.submittedAt ? -1 : 1))) latest.set(r.login.toLowerCase(), r)
  const lines: string[] = []
  const approvers = maintainers.filter((m) => m.github && latest.get(m.github.toLowerCase())?.state === 'APPROVED')
  if (approvers.length) for (const m of approvers) lines.push(`Approved by ${m.wporg} (@${m.github}, ${locale} maintainer).`)
  else lines.push(`No approval from a ${locale} maintainer.`)
  for (const m of maintainers.filter((x) => !x.github)) lines.push(`${m.wporg} (${m.role}) approves outside GitHub; the repository maintainer notes it in the pull request.`)
  if (maintainers.length === 0) lines.push(`${locale} has no locale maintainer; the repository maintainer asks the locale's GTEs.`)
  return lines
}
