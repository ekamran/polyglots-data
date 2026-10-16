import { check } from 'recheck'
import type { Finding } from '../findings.js'
import type { RegexItem } from './items.js'

export const MAX_REGEX = 1000
type Checker = (source: string, flags: string) => Promise<{ status: string }>

export function staticRegexFindings(items: RegexItem[], file: string): Finding[] {
  const out: Finding[] = []
  for (const r of items) {
    if (r.source.length > MAX_REGEX) {
      out.push({ level: 'error', check: 'regex', file, message: `${r.where}: ${r.source.length} characters, the limit is ${MAX_REGEX}` })
      continue
    }
    try {
      new RegExp(r.source, r.flags)
    } catch (err) {
      out.push({ level: 'error', check: 'regex', file, message: `${r.where}: does not compile with the ${r.flags} flags (${err instanceof Error ? err.message : String(err)})` })
    }
  }
  return out
}

const defaultChecker: Checker = (source, flags) => check(source, flags, { timeout: 10_000 })

/** recheck's verdict per regex: vulnerable fails; unknown fails unless the maintainer allowlisted that exact pattern. */
export async function recheckFindings(items: RegexItem[], allowlist: Set<string>, file: string, checker: Checker = defaultChecker): Promise<Finding[]> {
  const out: Finding[] = []
  for (const r of items) {
    const { status } = await checker(r.source, r.flags)
    if (status === 'safe') continue
    if (status === 'unknown' && allowlist.has(r.source)) continue
    const tail = status === 'unknown' ? ' (not in data/regex-allowlist.json)' : ''
    out.push({ level: 'error', check: 'redos', file, message: `${r.where}: ReDoS check says ${status}${tail}` })
  }
  return out
}
