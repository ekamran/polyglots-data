export const USER_AGENT = 'polyglots-data (+https://github.com/emreerkan/polyglots-data)'

export type HttpResult = { ok: true; status: number; body: Buffer } | { ok: false; status?: number; error: string }
export interface HttpClient { get(url: string): Promise<HttpResult> }
/** host: named in the circuit-breaker error. */
export interface ClientOptions { host?: string; delayMs?: number; timeoutMs?: number; backoffMs?: number[]; maxRetryAfterMs?: number; attempts?: number }
export interface ClientDeps { fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>; now?: () => number }

const MAX_RETRY_AFTER = 300_000
export const MAX_NETWORK_FAILURES = 5
export const unreachable = (host = 'translate.wordpress.org') => `${host} unreachable; stopped after ${MAX_NETWORK_FAILURES} network failures`
export const UNREACHABLE = unreachable()

export function parseRetryAfter(value: string | null, nowMs: number, cap = MAX_RETRY_AFTER): number | undefined {
  if (value === null) return undefined
  const v = value.trim()
  let ms: number
  if (/^\d+$/.test(v)) ms = Number(v) * 1000
  else {
    const at = Date.parse(v)
    if (Number.isNaN(at)) return undefined
    ms = Math.max(0, at - nowMs)
  }
  return Math.min(ms, cap)
}

/**
 * One client per host. Requests never overlap: every get() waits for the
 * previous one and keeps delayMs between the end of one and the start of the
 * next. This is the whole politeness budget towards translate.wordpress.org.
 */
export function createClient(opts: ClientOptions = {}, deps: ClientDeps = {}): HttpClient {
  const delayMs = opts.delayMs ?? 3000
  const timeoutMs = opts.timeoutMs ?? 120_000
  const backoff = opts.backoffMs ?? [10_000, 30_000, 90_000]
  const attempts = opts.attempts ?? 4
  const cap = opts.maxRetryAfterMs ?? MAX_RETRY_AFTER
  const doFetch = deps.fetch ?? ((input: string, init?: RequestInit) => globalThis.fetch(input, init))
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const now = deps.now ?? Date.now
  let lastEnd = Number.NEGATIVE_INFINITY
  // Consecutive attempts that got no HTTP response at all. A host that is down would otherwise
  // cost every remaining request four attempts and two minutes of backoff each.
  let networkFailures = 0
  let queue: Promise<unknown> = Promise.resolve()

  async function attempt(url: string): Promise<HttpResult> {
    let last: HttpResult = { ok: false, error: 'not attempted' }
    for (let i = 0; i < attempts; i++) {
      if (networkFailures >= MAX_NETWORK_FAILURES) return { ok: false, error: unreachable(opts.host) }
      const wait = lastEnd + delayMs - now()
      if (wait > 0) await sleep(wait)
      let retryAfter: number | undefined
      try {
        const res = await doFetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) })
        networkFailures = 0
        const body = Buffer.from(await res.arrayBuffer())
        lastEnd = now()
        if (res.ok) return { ok: true, status: res.status, body }
        if (res.status !== 429 && res.status < 500) return { ok: false, status: res.status, error: `HTTP ${res.status}` }
        last = { ok: false, status: res.status, error: `HTTP ${res.status} after ${attempts} attempts` }
        retryAfter = parseRetryAfter(res.headers.get('retry-after'), now(), cap)
      } catch (err) {
        lastEnd = now()
        networkFailures++
        last = { ok: false, error: `${err instanceof Error ? err.message : String(err)} after ${attempts} attempts` }
      }
      if (i < attempts - 1) await sleep(retryAfter ?? backoff[Math.min(i, backoff.length - 1)] ?? 0)
    }
    return last
  }

  return {
    get(url) {
      const run = queue.then(() => attempt(url))
      queue = run.catch(() => undefined)
      return run
    },
  }
}
