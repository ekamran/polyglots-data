// Refreshes data/wp-locales.json. Default: translate.wordpress.org/stats/,
// one request. --from-polyglots <locales-data.ts> seeds it offline from
// polyglots' committed table. Fails open: on any problem the committed file
// stays.
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { parsePolyglotsTable, parseStats, renderTable } from '../locales.js'
import { USER_AGENT } from '../wporg/client.js'

const MIN_LOCALES = 100
const OUT = 'data/wp-locales.json'
const STATS_URL = 'https://translate.wordpress.org/stats/'

const { values } = parseArgs({ options: { 'from-polyglots': { type: 'string' } } })
const today = new Date().toISOString().slice(0, 10)
let rows
let source
try {
  if (values['from-polyglots']) {
    rows = parsePolyglotsTable(readFileSync(values['from-polyglots'], 'utf8'))
    source = 'polyglots src/wporg/locales-data.ts'
  } else {
    const res = await fetch(STATS_URL, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(120_000) })
    if (!res.ok) throw new Error(`answered ${res.status}`)
    rows = parseStats(await res.text())
    source = STATS_URL
  }
  if (rows.length < MIN_LOCALES) throw new Error(`only ${rows.length} locales parsed`)
} catch (err) {
  console.warn(`update-locales: kept ${OUT} (${err instanceof Error ? err.message : String(err)})`)
  process.exit(0)
}
writeFileSync(OUT, renderTable(rows, source, today))
console.log(`update-locales: wrote ${rows.length} locales`)
