import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import YAML from 'yaml'
import type { Finding } from '../findings.js'
import { adversarialStrings } from './adversarial.js'
import { loadCorpus } from './corpus.js'
import { dynamicFixFindings, staticFixFindings } from './fix-safety.js'
import { extractItems, type RulesItems } from './items.js'
import { polyglotsBin, polyglotsFindings, runPolyglotsCheck } from './polyglots.js'
import { promptFindings } from './prompt-text.js'
import { recheckFindings, staticRegexFindings } from './regex-safety.js'
import { timeRegexes } from './regex-timing.js'

export interface RulesContext { corpus: string[]; allowlist: Set<string>; bin: string }
export interface RulesCheckResult { file: string; findings: Finding[]; items: RulesItems; schema?: number }

export function loadRulesContext(root: string): RulesContext {
  const files = [join(root, 'test', 'fixtures', 'tr_TR.tmx.gz')]
  const extra = join(root, 'test', 'fixtures', 'corpus')
  if (existsSync(extra)) for (const f of readdirSync(extra)) if (f.endsWith('.txt')) files.push(join(extra, f))
  const allowlist = new Set(JSON.parse(readFileSync(join(root, 'data', 'regex-allowlist.json'), 'utf8')) as string[])
  return { corpus: loadCorpus(files), allowlist, bin: polyglotsBin(root) }
}

/** Spec 7, checks 4 and 5, for one rules file. Used by PR CI and by the build before publishing. */
export async function checkRulesFile(file: string, ctx: RulesContext): Promise<RulesCheckResult> {
  const empty: RulesItems = { regexes: [], fixes: [], prompts: [], whens: [] }
  let doc: unknown
  try {
    doc = YAML.parse(readFileSync(file, 'utf8'))
  } catch (err) {
    return { file, items: empty, findings: [{ level: 'error', check: 'yaml', file, message: err instanceof Error ? err.message : String(err) }] }
  }
  const pg = await runPolyglotsCheck(file, ctx.bin)
  const findings: Finding[] = polyglotsFindings(pg, file)
  const items = extractItems(doc)
  const staticRegex = staticRegexFindings(items.regexes, file)
  findings.push(...staticRegex)
  const broken = new Set(staticRegex.map((f) => f.message.split(':')[0]))
  const runnable = items.regexes.filter((r) => !broken.has(r.where))
  findings.push(...(await recheckFindings(runnable, ctx.allowlist, file)))
  findings.push(...(await timeRegexes(runnable, ctx.corpus, file)))
  findings.push(...staticFixFindings(items.fixes, file))
  // A fix whose regex failed the ReDoS or time check is not run again here.
  const slow = new Set(findings.filter((f) => f.check === 'regex-time' || f.check === 'redos').map((f) => f.message.split(':')[0]))
  const runnableFixes = items.fixes.filter((f) => !f.find || runnable.some((r) => r.source === f.find && !slow.has(r.where)))
  const fixStrings = [...ctx.corpus, ...runnableFixes.flatMap((f) => adversarialStrings(f.find ?? f.text ?? ''))]
  findings.push(...dynamicFixFindings(runnableFixes, fixStrings, file))
  findings.push(...promptFindings(items.prompts, file))
  return { file, findings, items, ...(pg.json?.schema !== undefined ? { schema: pg.json.schema } : {}) }
}
