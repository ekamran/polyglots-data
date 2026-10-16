import { RegExpParser, visitRegExpAST } from '@eslint-community/regexpp'

const LENGTH = 10_000
const SAMPLE: Record<string, string> = { digit: '1', space: ' ', word: 'a', any: 'a', property: 'a' }
const GENERIC = ['a', ' ', '.', '%', '\'', '1', 'İ', 'ı', '…', '<', '-']

/**
 * Long runs of each character the pattern mentions, plus a generic set,
 * each followed by a character that rarely matches, so a backtracking regex
 * has to explore every split before it fails.
 */
export function adversarialStrings(source: string): string[] {
  const chars = new Set<string>(GENERIC)
  try {
    const ast = new RegExpParser({ ecmaVersion: 2025 }).parsePattern(source, 0, source.length, { unicode: true })
    visitRegExpAST(ast, {
      onCharacterEnter: (n) => { chars.add(String.fromCodePoint(n.value)) },
      onCharacterSetEnter: (n) => { const s = SAMPLE[n.kind]; if (s) chars.add(s) },
      onCharacterClassRangeEnter: (n) => { chars.add(String.fromCodePoint(n.min.value)) },
    })
  } catch {
    // A pattern that does not parse fails the static check; the generic set still runs.
  }
  const out: string[] = []
  for (const c of [...chars].slice(0, 40)) {
    const run = c.repeat(Math.ceil(LENGTH / c.length)).slice(0, LENGTH)
    out.push(run, run + '\u0000', (c + ' ').repeat(LENGTH / 2).slice(0, LENGTH))
  }
  return out
}
