export interface RegexItem { where: string; source: string }
export interface FixItem { where: string; find?: string; text?: string; replace: string }
export interface PromptItem { where: string; text: string }
export interface WhenItem { where: string; source?: string; notSource?: string }
export interface RulesItems { regexes: RegexItem[]; fixes: FixItem[]; prompts: PromptItem[]; whens: WhenItem[] }

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): v is string => typeof v === 'string'

/**
 * Everything in a rules file that runs as a regex, rewrites a translation, or
 * reaches the AI as prompt text. polyglots validates the shape; this only
 * reads strings where they are, so a malformed file yields fewer items, never
 * a crash.
 */
export function extractItems(doc: unknown): RulesItems {
  const out: RulesItems = { regexes: [], fixes: [], prompts: [], whens: [] }
  if (!isObj(doc)) return out
  for (const key of ['guidance', 'capitalization'] as const) if (str(doc[key])) out.prompts.push({ where: key, text: doc[key] })
  const reg = doc.register
  if (str(reg)) out.prompts.push({ where: 'register', text: reg })
  else if (isObj(reg)) for (const k of ['audit', 'translate']) if (str(reg[k])) out.prompts.push({ where: `register.${k}`, text: reg[k] as string })
  if (Array.isArray(doc.mistakes)) doc.mistakes.forEach((m, i) => {
    if (!isObj(m)) return
    for (const k of ['note', 'right']) if (str(m[k])) out.prompts.push({ where: `mistakes[${i}].${k}`, text: m[k] as string })
  })
  if (Array.isArray(doc.patterns)) doc.patterns.forEach((p, i) => {
    if (!isObj(p)) return
    if (str(p.find)) out.regexes.push({ where: `patterns[${i}].find`, source: p.find })
    if (str(p.note)) out.prompts.push({ where: `patterns[${i}].note`, text: p.note })
    if (p.level === 'fix' && str(p.replace)) {
      out.fixes.push({ where: `patterns[${i}]`, ...(str(p.find) ? { find: p.find } : {}), ...(str(p.text) ? { text: p.text } : {}), replace: p.replace })
    }
    if (isObj(p.when)) out.whens.push({ where: `patterns[${i}].when`, ...(str(p.when.source) ? { source: p.when.source } : {}), ...(str(p.when.notSource) ? { notSource: p.when.notSource } : {}) })
  })
  const se = doc.sentenceEnd
  if (isObj(se)) {
    if (Array.isArray(se.answers)) se.answers.forEach((a, i) => {
      if (!isObj(a)) return
      for (const k of ['text', 'source']) if (str(a[k])) out.regexes.push({ where: `sentenceEnd.answers[${i}].${k}`, source: a[k] as string })
    })
    if (str(se.notEnding)) out.regexes.push({ where: 'sentenceEnd.notEnding', source: se.notEnding })
  }
  return out
}
