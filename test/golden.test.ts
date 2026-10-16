// Spec 10: a fixed small build gives a byte-identical TMX and the agreed manifest shape.
// Regenerate the golden file on purpose only: UPDATE_GOLDEN=1 npx vitest run test/golden.test.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { expect, it } from 'vitest'
import type { Repo } from '../src/config/load.js'
import type { Previous } from '../src/build/previous.js'
import { runBuild } from '../src/build/run.js'
import type { HttpClient } from '../src/wporg/client.js'
import { apiUrl, exportUrl } from '../src/wporg/urls.js'

const TR = { slug: 'tr', set: 'default' }
const GOLDEN = join(import.meta.dirname, 'fixtures', 'golden', 'tr_TR.tmx')
const head = 'msgid ""\nmsgstr ""\n"Content-Type: text/plain; charset=UTF-8\\n"\n"Plural-Forms: nplurals=2; plural=n > 1;\\n"\n\n'
const files: Record<string, Buffer> = {
  [apiUrl('wp/dev')]: Buffer.from(JSON.stringify({ translation_sets: [{ locale: 'tr', slug: 'default', wp_locale: 'tr_TR', current_count: 4, all_count: 4, percent_translated: 100, last_modified: '2026-10-15 00:00:00' }] })),
  [exportUrl('wp/dev', TR)]: Buffer.from(head + [
    'msgid "Post"\nmsgstr "Yazı"\n',
    'msgctxt "verb"\nmsgid "Post"\nmsgstr "Yayınla"\n',
    'msgid "%d post"\nmsgid_plural "%d posts"\nmsgstr[0] "%d yazı"\nmsgstr[1] "%d yazı"\n',
    'msgid "Shared & <b>"\nmsgstr "Ortak & <b>"\n',
  ].join('\n')),
  [apiUrl('wp-plugins/a/dev-readme')]: Buffer.from(JSON.stringify({ translation_sets: [{ locale: 'tr', slug: 'default', wp_locale: 'tr_TR', current_count: 2, all_count: 2, percent_translated: 100, last_modified: '2026-10-15 00:00:00' }] })),
  [exportUrl('wp-plugins/a/dev-readme', TR)]: Buffer.from(head + [
    'msgid "Shared & <b>"\nmsgstr "Ortak & <b>"\n',
    'msgid "A long readme paragraph."\nmsgstr "Uzun bir benioku paragrafı."\n',
  ].join('\n')),
}
const client: HttpClient = { async get(url) { const b = files[url]; return b ? { ok: true, status: 200, body: b } : { ok: false, status: 404, error: 'HTTP 404' } } }
const repo: Repo = {
  root: '/x', core: ['wp/dev'],
  locales: new Map([['tr_TR', {
    code: 'tr_TR',
    tm: { projects: [{ path: 'wp-plugins/a/dev-readme', added: '2026-10-16', by: 'emre', reviewed: 'r' }], exclude: [] },
    meta: { locale: 'tr_TR', maintainers: [{ wporg: 'emre', github: 'emreerkan', role: 'Locale Manager' }], rules: { status: 'maintained' } },
  }]]),
}
const first: Previous = { first: true, state: { schema: 1, locales: {} }, units: new Map(), problems: [] }
// Not in test/fixtures/index.json (its rules[] is empty): the rules entry keys of spec 5.9.
const RULES_KEYS = ['locale', 'maintainers', 'minPolyglots', 'schema', 'sha512', 'slug', 'status', 'url']

const keys = (o: object) => Object.keys(o).sort()

it('builds the golden TMX byte for byte and the agreed manifest shape', async () => {
  const rulesBytes = Buffer.from('schema: 2\n')
  const r = await runBuild({
    repo, wp: new Map([['tr_TR', TR]]), previous: first, rebuild: ['tr_TR'], force: false, accept: new Set(),
    tag: 'data-20261016-030000', toolVersion: 'golden', minPolyglots: '1.0.0', now: new Date('2026-10-16T03:00:00Z'),
    rules: new Map([['tr_TR', { bytes: rulesBytes, check: { file: 'x', items: { regexes: [], fixes: [], prompts: [], whens: [] }, findings: [], schema: 2 } }]]),
  }, client)
  expect(r.red).toEqual([])
  const xml = gunzipSync(r.assets.get('tr_TR.tmx.gz')!)
  if (process.env.UPDATE_GOLDEN === '1') writeFileSync(GOLDEN, xml)
  expect(xml.equals(readFileSync(GOLDEN))).toBe(true)

  const agreed = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'index.json'), 'utf8')) as { tm: Array<Record<string, unknown> & { projects: object[] }> }
  const manifest = JSON.parse(r.assets.get('index.json')!.toString('utf8')) as { tm: Array<Record<string, unknown> & { projects: object[] }>; rules: object[] }
  expect(keys(manifest)).toEqual(keys(agreed))
  const tmKeys = keys(agreed.tm[0]!)
  for (const e of manifest.tm) expect(keys(e)).toEqual(tmKeys)
  const projectShapes = new Set(agreed.tm.flatMap((e) => e.projects.map((p) => keys(p).join(','))))
  for (const p of manifest.tm.flatMap((e) => e.projects)) expect(projectShapes).toContain(keys(p).join(','))
  expect(manifest.rules).toHaveLength(1)
  for (const e of manifest.rules) expect(keys(e)).toEqual(RULES_KEYS)
})
