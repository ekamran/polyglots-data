import { RegExpParser, visitRegExpAST, type AST } from '@eslint-community/regexpp'
import type { Finding } from '../findings.js'
import type { FixItem } from './items.js'
import { URL_TOKEN } from './url-tokens.js'

export const MAX_REPLACE = 200
const UNSAFE = new RegExp(`<|>|${URL_TOKEN.source}`, 'gi')
const REF = /\$\$|\$(\d{1,2})|\$<([^>]*)>/g
const FORBIDDEN_CHARS = new Set(['<', '>', '/', ':', '.'])
const ADDS = 'adds <, >, ://, www. or a domain'
const NOT_SAFE_GROUP = 'refers to a group that is not a character class or a list of plain words'

export function countUnsafe(s: string): number {
  return s.match(UNSAFE)?.length ?? 0
}

function tokenCounts(s: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const t of s.match(UNSAFE) ?? []) {
    const k = t.toLowerCase()
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return counts
}

/** True when `after` holds an unsafe token occurrence that `before` does not. */
function addsToken(before: string, after: string): boolean {
  const b = tokenCounts(before)
  for (const [t, n] of tokenCounts(after)) if (n > (b.get(t) ?? 0)) return true
  return false
}

/** Splits a replacement into its literal text (`$$` becomes `$`) and its capture references. */
function parseReplace(replace: string): { literal: string; refs: RegExpMatchArray[] } {
  const refs = [...replace.matchAll(REF)].filter((m) => m[0] !== '$$')
  return { literal: replace.replace(REF, (m) => (m === '$$' ? '$' : '')), refs }
}

/** A group whose every possible match is a short, known-harmless text. */
function safeGroup(g: AST.CapturingGroup): boolean {
  return g.alternatives.every((alt) => {
    if (alt.elements.every((e) => e.type === 'Character')) {
      return alt.elements.every((e) => e.type === 'Character' && !FORBIDDEN_CHARS.has(String.fromCodePoint(e.value)))
    }
    if (alt.elements.length !== 1) return false
    const e = alt.elements[0]!
    if (e.type !== 'CharacterClass' || e.negate) return false
    return e.elements.every((c) => {
      if (c.type === 'Character') return !FORBIDDEN_CHARS.has(String.fromCodePoint(c.value))
      if (c.type === 'CharacterClassRange') {
        for (let cp = c.min.value; cp <= c.max.value; cp++) if (FORBIDDEN_CHARS.has(String.fromCodePoint(cp))) return false
        return true
      }
      return false
    })
  })
}

function groups(find: string): AST.CapturingGroup[] {
  const ast = new RegExpParser({ ecmaVersion: 2025 }).parsePattern(find, 0, find.length, { unicode: true })
  const out: AST.CapturingGroup[] = []
  visitRegExpAST(ast, { onCapturingGroupEnter: (g) => { out.push(g) } })
  return out.sort((a, b) => a.start - b.start)
}

export function staticFixFindings(fixes: FixItem[], file: string): Finding[] {
  const out: Finding[] = []
  const err = (where: string, message: string) => out.push({ level: 'error', check: 'fix', file, message: `${where}: ${message}` })
  for (const f of fixes) {
    if (f.replace.length > MAX_REPLACE) { err(f.where, `the replacement is ${f.replace.length} characters, the limit is ${MAX_REPLACE}`); continue }
    if (/\$[&`']/.test(f.replace)) { err(f.where, '$&, $` and $\' are not allowed in a replacement'); continue }
    // A text fix uses split and join, so its replacement has no capture references.
    const { literal, refs } = f.find ? parseReplace(f.replace) : { literal: f.replace, refs: [] as RegExpMatchArray[] }
    if (countUnsafe(literal) > 0) { err(f.where, `the replacement ${ADDS}`); continue }
    if (refs.length > 0 && /[./:]/.test(literal)) {
      err(f.where, "a replacement with a capture reference must not contain '.', '/' or ':'")
      continue
    }
    if (!f.find) continue
    let gs: AST.CapturingGroup[]
    try { gs = groups(f.find) } catch { continue } // the regex check reports it
    for (const ref of refs) {
      // A duplicate group name (ES2025) gives several groups; every one must be safe.
      const found = ref[1] !== undefined ? [gs[Number(ref[1]) - 1]] : gs.filter((x) => x.name === ref[2])
      if (found.length === 0 || !found.every((g) => g !== undefined && safeGroup(g))) err(f.where, `${ref[0]} ${NOT_SAFE_GROUP}`)
    }
  }
  return out
}

export function applyFix(fix: FixItem, text: string): string {
  if (fix.find) return text.replace(new RegExp(fix.find, 'gu'), fix.replace)
  if (fix.text) return text.split(fix.text).join(fix.replace)
  return text
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/**
 * Runs every fix over the strings. A fix may never add an unsafe token that the
 * input does not already hold, and a fix that throws is reported, not skipped.
 */
export function dynamicFixFindings(fixes: FixItem[], strings: string[], file: string): Finding[] {
  const out: Finding[] = []
  for (const f of fixes) {
    for (const s of strings) {
      let after: string
      try { after = applyFix(f, s) } catch (e) {
        out.push({ level: 'error', check: 'fix', file, message: `${f.where}: the fix cannot run (${errorMessage(e)})` })
        break
      }
      if (addsToken(s, after)) {
        out.push({ level: 'error', check: 'fix', file, message: `${f.where}: turns "${s.slice(0, 60)}" into "${after.slice(0, 60)}", which ${ADDS}` })
        break
      }
    }
  }
  return out
}

export function fixSamples(fix: FixItem, corpus: string[], n = 5): Array<{ before: string; after: string }> {
  const out: Array<{ before: string; after: string }> = []
  try {
    for (const s of corpus) {
      const after = applyFix(fix, s)
      if (after !== s) out.push({ before: s, after })
      if (out.length >= n) break
    }
  } catch {
    return [] // a fix that cannot run has no samples; dynamicFixFindings reports it
  }
  return out
}
