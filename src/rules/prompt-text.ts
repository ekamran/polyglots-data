import type { Finding } from '../findings.js'
import type { PromptItem } from './items.js'

const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+\.(?:com|org|net|io|dev|app|info|me|co|tr|de|fr|es|it|nl|se|ru|cn|jp|uk)\b(?:\/\S*)?/i
const FUNCTION_WORDS = new Set('the a an of to in on for and or not is are be with as by that this it at from use do does when if than then its your you write no but only which one'.split(' '))
const QUOTED = /"[^"]*"|“[^”]*”|«[^»]*»|`[^`]*`/g
const MIN_WORDS = 12
const MIN_RATIO = 0.12
const MAX_NON_LATIN = 0.1

/**
 * Prompt text reaches the AI reviewer of every user of the locale. A URL is
 * refused outright. "Is it English" is a heuristic, so it only warns: quoted
 * examples in the locale's language are removed first, and texts too short
 * to judge are skipped.
 */
export function promptFindings(prompts: PromptItem[], file: string): Finding[] {
  const out: Finding[] = []
  for (const p of prompts) {
    const url = URL_RE.exec(p.text)
    if (url) {
      out.push({ level: 'error', check: 'prompt', file, message: `${p.where}: prompt text must not contain a URL (${url[0].replace(/[.,;)]+$/, '')})` })
      continue
    }
    const bare = p.text.replace(QUOTED, ' ')
    const words = bare.toLowerCase().match(/\p{L}+/gu) ?? []
    if (words.length < MIN_WORDS) continue
    const letters = bare.match(/\p{L}/gu) ?? []
    const nonLatin = letters.filter((c) => !/\p{Script=Latin}/u.test(c)).length / letters.length
    const ratio = words.filter((w) => FUNCTION_WORDS.has(w)).length / words.length
    if (ratio < MIN_RATIO || nonLatin > MAX_NON_LATIN) {
      out.push({ level: 'warning', check: 'prompt', file, message: `${p.where}: prompt text does not look like English` })
    }
  }
  return out
}
