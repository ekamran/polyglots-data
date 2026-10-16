// A manual live run against translate.wordpress.org: at most 3 projects of
// one locale, one request at a time. Never in CI, never in tests.
import { mkdirSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { parseArgs } from 'node:util'
import { mergeUnits } from '../build/merge.js'
import { loadRepo } from '../config/load.js'
import { loadWpLocales, targetLang } from '../locales.js'
import { poToUnits } from '../po/units.js'
import { resolveProjects } from '../resolve.js'
import { writeTmx } from '../tmx/write.js'
import { findSet, parseProjectApi } from '../wporg/api.js'
import { createClient } from '../wporg/client.js'
import { apiUrl, exportUrl } from '../wporg/urls.js'

const { values } = parseArgs({ options: { locale: { type: 'string' }, max: { type: 'string', default: '3' }, path: { type: 'string', multiple: true } } })
const max = Math.min(3, Number(values.max))
const root = process.cwd()
const wp = loadWpLocales(root)
const { repo } = loadRepo(root, wp)
const code = values.locale ?? 'tr_TR'
const l = repo.locales.get(code)
const loc = wp.get(code)
if (!l?.tm || !loc) throw new Error(`${code} has no TM list`)
const paths = (values.path?.length ? values.path : resolveProjects(repo.core, l.tm)).slice(0, max)
const client = createClient()
const projects = []
for (const path of paths) {
  const a = await client.get(apiUrl(path))
  const sets = a.ok ? parseProjectApi(a.body) : undefined
  const set = sets?.ok ? findSet(sets.sets, loc) : undefined
  const e = await client.get(exportUrl(path, loc))
  const r = e.ok ? poToUnits(e.body) : { ok: false as const, error: e.error }
  console.log(`${path}: api current_count=${set?.currentCount ?? '?'} last_modified=${set?.lastModified ?? '?'}; export ${r.ok ? `${r.units.length} units` : r.error}`)
  if (r.ok) projects.push({ path, units: r.units })
}
const xml = writeTmx(mergeUnits(projects), { lang: targetLang(code, loc), toolVersion: 'smoke', created: new Date() })
mkdirSync('dist/smoke', { recursive: true })
writeFileSync(`dist/smoke/${code}.tmx.gz`, gzipSync(Buffer.from(xml), { level: 9 }))
console.log(`wrote dist/smoke/${code}.tmx.gz`)
