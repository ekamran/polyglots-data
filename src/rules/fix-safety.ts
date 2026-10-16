import { RegExpParser, visitRegExpAST, type AST } from '@eslint-community/regexpp'
import type { Finding } from '../findings.js'
import type { FixItem } from './items.js'

export const MAX_REPLACE = 200
const UNSAFE = /<|>|:\/\/|www\.|\b[a-z0-9-]+\.[a-z]{2,}\b/gi
const FORBIDDEN_CHARS = new Set(['<', '>', '/', ':', '.'])
const ADDS = 'adds <, >, ://, www. or a domain'

export function countUnsafe(s: string): number {
  return s.match(UNSAFE)?.length ?? 0
}

function literalPart(replace: string): string {
  return replace.replace(/\$(?:\d{1,2}|<[^>]*>|\$)/g, '')
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
    if (countUnsafe(literalPart(f.replace)) > 0) { err(f.where, `the replacement ${ADDS}`); continue }
    if (!f.find) continue
    let gs: AST.CapturingGroup[]
    try { gs = groups(f.find) } catch { continue } // the regex check reports it
    for (const ref of f.replace.matchAll(/\$(\d{1,2})|\$<([^>]*)>/g)) {
      const g = ref[1] !== undefined ? gs[Number(ref[1]) - 1] : gs.find((x) => x.name === ref[2])
      if (!g || !safeGroup(g)) err(f.where, `${ref[0]} refers to a group that is not a character class or a list of plain words`)
    }
  }
  return out
}

export function applyFix(fix: FixItem, text: string): string {
  if (fix.find) return text.replace(new RegExp(fix.find, 'gu'), fix.replace)
  if (fix.text) return text.split(fix.text).join(fix.replace)
  return text
}

/** Runs every fix over the strings; the output may never hold more unsafe tokens than the input. */
export function dynamicFixFindings(fixes: FixItem[], strings: string[], file: string): Finding[] {
  const out: Finding[] = []
  for (const f of fixes) {
    for (const s of strings) {
      let after: string
      try { after = applyFix(f, s) } catch { break }
      if (countUnsafe(after) > countUnsafe(s)) {
        out.push({ level: 'error', check: 'fix', file, message: `${f.where}: turns "${s.slice(0, 60)}" into "${after.slice(0, 60)}", which ${ADDS}` })
        break
      }
    }
  }
  return out
}

export function fixSamples(fix: FixItem, corpus: string[], n = 5): Array<{ before: string; after: string }> {
  const out: Array<{ before: string; after: string }> = []
  for (const s of corpus) {
    const after = applyFix(fix, s)
    if (after !== s) out.push({ before: s, after })
    if (out.length >= n) break
  }
  return out
}
