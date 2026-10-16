import { gzipSync } from 'node:zlib'
import type { LocaleData, Repo } from '../config/load.js'
import { manifestSlug, targetLang, type WpLocale, type WpLocales } from '../locales.js'
import { releaseUrl, type Manifest, type ManifestProject, type RulesEntry, type TmEntry } from '../manifest.js'
import { isLongText } from '../paths.js'
import { poToUnits } from '../po/units.js'
import { resolveProjects } from '../resolve.js'
import type { RulesCheckResult } from '../rules/check.js'
import { TMX_FORMAT_VERSION, writeTmx } from '../tmx/write.js'
import type { Unit } from '../types.js'
import { findSet, parseProjectApi, type SetInfo } from '../wporg/api.js'
import type { HttpClient } from '../wporg/client.js'
import { apiUrl, exportUrl } from '../wporg/urls.js'
import { needsDownload, type CachedProject } from './cache.js'
import { decideProject, type Fresh } from './decide.js'
import { compareUnits, mergeUnits } from './merge.js'
import type { Previous } from './previous.js'
import { encodeUnitsFile, sha512, type State, type UnitsFile } from './state.js'

export const MAX_UNCOMPRESSED = 157_286_400
export const STALE_RED_DAYS = 28
const DAY = 86_400_000

export interface BuildInput {
  repo: Repo; wp: WpLocales; previous: Previous; rebuild: string[]; force: boolean; accept: Set<string>
  tag: string; toolVersion: string; minPolyglots: string
  rules: Map<string, { bytes: Buffer; check: RulesCheckResult }>; now: Date
}
export interface ProjectLog { locale: string; path: string; action: 'cached' | 'downloaded' | 'stale' | 'missing'; units: number; note?: string }
export interface BuildResult { assets: Map<string, Buffer>; manifest: Manifest; state: State; log: ProjectLog[]; red: string[]; publish: boolean; downloads: number; toolVersion: string }

const byLocale = (a: { locale: string }, b: { locale: string }) => (a.locale < b.locale ? -1 : a.locale > b.locale ? 1 : 0)
const json = (v: unknown) => Buffer.from(JSON.stringify(v, null, 2) + '\n')

interface Ctx {
  input: BuildInput; api: Map<string, SetInfo[] | undefined>; wporg: HttpClient
  assets: Map<string, Buffer>; log: ProjectLog[]; red: string[]; downloads: number
}

/** One API request per distinct path across the rebuilt locales (spec 5.2 step 1). */
async function askApi(locales: LocaleData[], core: string[], wporg: HttpClient): Promise<Map<string, SetInfo[] | undefined>> {
  const api = new Map<string, SetInfo[] | undefined>()
  for (const l of locales) {
    for (const path of resolveProjects(core, l.tm!)) {
      if (api.has(path)) continue
      const r = await wporg.get(apiUrl(path))
      const parsed = r.ok ? parseProjectApi(r.body) : undefined
      api.set(path, parsed?.ok ? parsed.sets : undefined)
    }
  }
  return api
}

function sameUnits(a: Unit[], b: Unit[]): boolean {
  if (a.length !== b.length) return false
  const x = [...a].sort(compareUnits)
  const y = [...b].sort(compareUnits)
  return x.every((u, i) => compareUnits(u, y[i]!) === 0)
}

/** State with sorted keys, so key order never counts as a change. */
function stableState(s: State): string {
  return JSON.stringify(Object.keys(s.locales).sort().map((code) => {
    const l = s.locales[code]!
    return [code, l.units, l.sha512, Object.keys(l.projects).sort().map((p) => [p, l.projects[p]])]
  }))
}

/** Spec 5.2–5.8 for one rebuilt locale. Returns its manifest and state entries, or undefined. */
async function buildLocale(c: Ctx, l: LocaleData, loc: WpLocale): Promise<{ entry?: TmEntry; state?: State['locales'][string] }> {
  const { input } = c
  const { previous } = input
  const nowIso = input.now.toISOString()
  const nowMs = input.now.getTime()
  const prevEntry = previous.index?.tm.find((e) => e.locale === l.code)
  const prevState = previous.state.locales[l.code]
  const kept: Array<{ path: string; units: Unit[]; built: string; stale?: string }> = []
  const projectsState: Record<string, CachedProject> = {}

  for (const path of resolveProjects(input.repo.core, l.tm!)) {
    const cached = prevState?.projects[path]
    const lastUnits = previous.units.get(l.code)?.get(path)
    const sets = c.api.get(path)
    const set = sets ? findSet(sets, loc) : undefined
    if (cached && lastUnits && sets && set && !needsDownload(cached, set, nowMs, input.force)) {
      kept.push({ path, units: lastUnits.units, built: lastUnits.built })
      projectsState[path] = cached
      c.log.push({ locale: l.code, path, action: 'cached', units: lastUnits.units.length })
      continue
    }
    let fresh: Fresh
    if (sets && !set) {
      fresh = { ok: false, error: 'no translation set for this locale' }
    } else {
      c.downloads++
      const r = await c.wporg.get(exportUrl(path, loc))
      fresh = r.ok ? poToUnits(r.body) : { ok: false, error: r.error }
    }
    const last = cached && lastUnits ? { ...lastUnits, lastModified: cached.lastModified, currentCount: cached.currentCount } : undefined
    const o = decideProject(fresh, last, input.accept.has(`${l.code}:${path}`))
    if (o.kind === 'fresh') {
      // Same content as last good: keep its build time so the TMX bytes stay identical.
      const same = last !== undefined && sameUnits(last.units, o.units)
      kept.push({ path, units: o.units, built: same ? last.built : nowIso })
      projectsState[path] = { units: o.units.length, built: nowIso, lastModified: set?.lastModified ?? '', currentCount: set?.currentCount ?? -1 }
      c.log.push({ locale: l.code, path, action: 'downloaded', units: o.units.length })
    } else if (o.kind === 'stale') {
      kept.push({ path, units: o.last.units, built: o.last.built, stale: o.last.built })
      projectsState[path] = cached!
      c.log.push({ locale: l.code, path, action: 'stale', units: o.last.units.length, note: o.reason })
      if (nowMs - Date.parse(o.last.built) > STALE_RED_DAYS * DAY) c.red.push(`${l.code} ${path}: stale since ${o.last.built} (${o.reason})`)
    } else {
      c.log.push({ locale: l.code, path, action: 'missing', units: 0, note: o.reason })
      c.red.push(`${l.code} ${path}: left out (${o.reason})`)
    }
  }

  if (kept.length === 0) {
    c.red.push(`${l.code}: no project left`)
    return {}
  }
  const merged = mergeUnits(kept)
  const created = new Date(Math.max(...kept.map((k) => Date.parse(k.built))))
  const xml = Buffer.from(writeTmx(merged, { lang: targetLang(l.code, loc), toolVersion: TMX_FORMAT_VERSION, created }))
  if (xml.length > MAX_UNCOMPRESSED) {
    c.red.push(`${l.code}: ${xml.length} bytes uncompressed, over the ${MAX_UNCOMPRESSED} limit; the previous TM stays`)
    return { entry: prevEntry, state: prevState }
  }
  const gz = gzipSync(xml, { level: 9 })
  const hash = sha512(gz)
  const projects: ManifestProject[] = kept.map((k) => ({
    path: k.path, units: k.units.length, ...(k.stale ? { stale: k.stale } : {}), ...(isLongText(k.path) ? { kind: 'long-text' as const } : {}),
  }))
  let entry: TmEntry
  if (prevEntry && prevEntry.sha512 === hash) {
    entry = { ...prevEntry, slug: manifestSlug(loc), units: merged.length, projects }
  } else {
    const name = `${l.code}.tmx.gz`
    c.assets.set(name, gz)
    entry = { locale: l.code, slug: manifestSlug(loc), url: releaseUrl(input.tag, name), bytes: gz.length, bytesUncompressed: xml.length, sha512: hash, units: merged.length, built: nowIso, projects }
  }
  const unitsFile: UnitsFile = { schema: 1, projects: Object.fromEntries(kept.map((k) => [k.path, { built: k.built, units: k.units.map((u) => [u.source, u.context, u.target] as [string, string, string]) }])) }
  const unitsBytes = encodeUnitsFile(unitsFile)
  const unitsHash = sha512(unitsBytes)
  if (prevState && prevState.sha512 === unitsHash) return { entry, state: { ...prevState, projects: projectsState } }
  const unitsName = `${l.code}.units.json.gz`
  c.assets.set(unitsName, unitsBytes)
  return { entry, state: { units: releaseUrl(input.tag, unitsName), sha512: unitsHash, projects: projectsState } }
}

/** Spec 8: a rules file is published as read, or left out when a check fails. */
function rulesEntries(c: Ctx): RulesEntry[] {
  const { input } = c
  const out: RulesEntry[] = []
  for (const [code, r] of [...input.rules].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const error = r.check.findings.find((f) => f.level === 'error')
    if (error) { c.red.push(`${code} rules: ${error.message}`); continue }
    const meta = input.repo.locales.get(code)?.meta
    const loc = input.wp.get(code)
    if (!meta || !loc) { c.red.push(`${code} rules: locale.yaml or the locale mapping is missing`); continue }
    const name = `${code}.rules.yaml`
    c.assets.set(name, r.bytes)
    out.push({
      locale: code, slug: manifestSlug(loc), url: releaseUrl(input.tag, name), sha512: sha512(r.bytes), schema: r.check.schema ?? 0,
      minPolyglots: input.minPolyglots, status: meta.rules.status, maintainers: meta.maintainers.map((m) => m.wporg),
    })
  }
  return out
}

/** Everything that decides "changed": rules URLs always name the new tag, so they are left out. */
function comparable(m: Manifest | undefined): string {
  if (!m) return ''
  return JSON.stringify({ tm: m.tm, rules: m.rules.map(({ url: _url, ...rest }) => rest) })
}

export async function runBuild(input: BuildInput, wporg: HttpClient): Promise<BuildResult> {
  const { repo, previous } = input
  const withTm = [...repo.locales.values()].filter((l) => l.tm)
  const rebuild = new Set(input.rebuild)
  const c: Ctx = {
    input, wporg, assets: new Map(), log: [], downloads: 0,
    red: previous.first ? [] : previous.problems.map((p) => `previous release: ${p}`),
    api: await askApi(withTm.filter((l) => rebuild.has(l.code) && input.wp.has(l.code)), repo.core, wporg),
  }
  const tm: TmEntry[] = []
  const state: State = { schema: 1, locales: {} }
  for (const l of withTm) {
    const loc = input.wp.get(l.code)
    const r = rebuild.has(l.code) && loc
      ? await buildLocale(c, l, loc)
      : { entry: previous.index?.tm.find((e) => e.locale === l.code), state: previous.state.locales[l.code] }
    if (r.entry) tm.push(r.entry)
    if (r.state) state.locales[l.code] = r.state
  }
  const manifest: Manifest = { schema: 1, generated: input.now.toISOString(), tm: tm.sort(byLocale), rules: rulesEntries(c).sort(byLocale) }
  // A damaged previous release means non-rebuilt locales lost their entries: build and report, never publish.
  const damaged = !previous.first && previous.problems.length > 0
  const publish = previous.first || (!damaged && (comparable(manifest) !== comparable(previous.index) || stableState(state) !== stableState(previous.state)))
  c.assets.set('index.json', json(manifest))
  c.assets.set('state.json', json(state))
  return { assets: c.assets, manifest, state, log: c.log, red: c.red, publish, downloads: c.downloads, toolVersion: input.toolVersion }
}
