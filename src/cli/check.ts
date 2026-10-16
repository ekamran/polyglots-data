import { appendFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import YAML from 'yaml'
import { approvalLines } from '../check/approval.js'
import { changedFiles, showFile } from '../check/git.js'
import { getFileAtRef, listPrFiles, listReviews } from '../check/github.js'
import { addedPaths, newPathFindings } from '../check/new-paths.js'
import { diffItems } from '../check/rules-diff.js'
import { scopeFindings } from '../check/scope.js'
import { loadRepo, parseLocaleMeta } from '../config/load.js'
import { hasErrors, type Finding } from '../findings.js'
import { loadWpLocales } from '../locales.js'
import { checkRulesFile, loadRulesContext } from '../rules/check.js'
import { fixSamples } from '../rules/fix-safety.js'
import { extractItems } from '../rules/items.js'
import { renderSummary, type Section } from '../summary.js'
import { createClient } from '../wporg/client.js'

const { values } = parseArgs({ options: {
  base: { type: 'string' }, head: { type: 'string' }, author: { type: 'string' },
  approval: { type: 'boolean', default: false }, repo: { type: 'string' }, pr: { type: 'string' },
} })
const write = (md: string) => (process.env.GITHUB_STEP_SUMMARY ? appendFileSync(process.env.GITHUB_STEP_SUMMARY, md) : process.stdout.write(md))
const root = process.cwd()

if (values.approval) {
  const token = process.env.GITHUB_TOKEN ?? ''
  const repo = values.repo!, pr = Number(values.pr), base = values.base!
  const files = await listPrFiles(repo, pr, token)
  const { locale } = scopeFindings(files, '')
  const lines: string[] = []
  if (locale) {
    const text = await getFileAtRef(repo, `locales/${locale}/locale.yaml`, base, token)
    const meta = text ? parseLocaleMeta(text, 'locale.yaml').meta : undefined
    lines.push(...approvalLines(await listReviews(repo, pr, token), meta?.maintainers ?? [], locale))
  } else {
    lines.push('No single locale changed; the repository maintainer reviews it.')
  }
  write(renderSummary([{ title: 'Approval', lines }]))
  process.exit(0)
}

const base = values.base!, head = values.head!, author = values.author ?? ''
const files = changedFiles(base, head)
const sections: Section[] = []
const wp = loadWpLocales(root)

// 2. Scope
const scope = scopeFindings(files, author)
sections.push({ title: 'Scope', findings: scope.findings, lines: [`Changed files: ${files.length}.`] })

// 1. Schema (whole tree at head)
const { repo, issues } = loadRepo(root, wp)
sections.push({ title: 'Data files', findings: issues.map((i) => ({ level: 'error', check: 'schema', file: i.file.replace(root + '/', ''), message: i.message })) })

// 3. New paths
const tmLocales = [...repo.locales.values()].filter((l) => l.tm).map((l) => ({ code: l.code, ...wp.get(l.code)! }))
const added: Array<{ path: string; locales: typeof tmLocales }> = []
for (const f of files) {
  const m = /^locales\/([^/]+)\/tm\.yaml$/.exec(f)
  if (f === 'core/tm.yaml') for (const p of addedPaths(showFile(base, f), readFileSync(join(root, f), 'utf8'))) added.push({ path: p, locales: tmLocales })
  else if (m?.[1] && wp.has(m[1])) for (const p of addedPaths(showFile(base, f), readFileSync(join(root, f), 'utf8'))) added.push({ path: p, locales: tmLocales.filter((l) => l.code === m[1]) })
}
const client = createClient()
const np: { findings: Finding[]; lines: string[] } = { findings: [], lines: [] }
if (added.length > 20) np.findings.push({ level: 'error', check: 'new-paths', message: `${added.length} new paths; at most 20 per pull request, split it` })
else for (const a of added) { const r = await newPathFindings([a.path], a.locales, client); np.findings.push(...r.findings); np.lines.push(...r.lines) }
sections.push({ title: 'New projects', findings: np.findings, lines: np.lines.length ? np.lines : added.length ? [] : ['No new project.'] })

// 4, 5, 7. Rules
const ctx = loadRulesContext(root)
for (const f of files.filter((x) => /^locales\/[^/]+\/rules\.yaml$/.test(x))) {
  let headText: string
  try { headText = readFileSync(join(root, f), 'utf8') } catch { sections.push({ title: `Rules: ${f}`, lines: ['Removed.'] }); continue }
  const r = await checkRulesFile(join(root, f), ctx)
  const baseText = showFile(base, f)
  let baseItems
  try { baseItems = baseText ? extractItems(YAML.parse(baseText)) : undefined } catch { baseItems = undefined }
  const changes = diffItems(baseItems, extractItems(YAML.parse(headText)))
  const lines = changes.map((c) => `${c.change} ${c.kind} \`${c.where}\`: ${'`'}${c.text.replace(/`/g, "'").replace(/\n/g, ' ').slice(0, 300)}${'`'}`)
  for (const fx of r.items.fixes) for (const s of fixSamples(fx, ctx.corpus)) lines.push(`sample ${fx.where}: "${s.before}" → "${s.after}"`)
  sections.push({ title: `Rules: ${f}`, findings: r.findings.map((x) => ({ ...x, file: f })), lines })
}

write(renderSummary(sections))
const all = sections.flatMap((s) => s.findings ?? [])
process.exit(hasErrors(all) ? 1 : 0)
