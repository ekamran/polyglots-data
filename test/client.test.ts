import { describe, expect, it } from 'vitest'
import { createClient, parseRetryAfter, USER_AGENT } from '../src/wporg/client.js'

function harness(responses: Array<Response | Error>) {
  let clock = 0
  const waits: number[] = []
  const calls: Array<{ url: string; ua: string | null; at: number }> = []
  const fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, ua: new Headers(init?.headers).get('user-agent'), at: clock })
    clock += 100 // each request takes 100 ms
    const r = responses.shift()
    if (r instanceof Error) throw r
    return r!
  }) as unknown as typeof globalThis.fetch
  const sleep = async (ms: number) => { waits.push(ms); clock += ms }
  return { client: createClient({}, { fetch, sleep, now: () => clock }), waits, calls }
}

describe('createClient', () => {
  it('sends the User-Agent and spaces requests by 3 s', async () => {
    const h = harness([new Response('a'), new Response('b')])
    expect((await h.client.get('https://x.test/1')).ok).toBe(true)
    expect((await h.client.get('https://x.test/2')).ok).toBe(true)
    expect(h.calls[0]!.ua).toBe(USER_AGENT)
    expect(h.calls[1]!.at - 100).toBeGreaterThanOrEqual(3000)
  })

  it('retries 503 with backoff and gives up after 4 attempts', async () => {
    const h = harness([1, 2, 3, 4].map(() => new Response('', { status: 503 })))
    const r = await h.client.get('https://x.test/')
    expect(r).toEqual({ ok: false, status: 503, error: 'HTTP 503 after 4 attempts' })
    expect(h.calls.length).toBe(4)
    expect(h.waits.filter((w) => w >= 10_000)).toEqual([10_000, 30_000, 90_000])
  })

  it('does not retry 404', async () => {
    const h = harness([new Response('', { status: 404 })])
    expect(await h.client.get('https://x.test/')).toEqual({ ok: false, status: 404, error: 'HTTP 404' })
    expect(h.calls.length).toBe(1)
  })

  it('retries a network error', async () => {
    const h = harness([new Error('ECONNRESET'), new Response('ok')])
    const r = await h.client.get('https://x.test/')
    expect(r.ok).toBe(true)
  })

  it('honours Retry-After seconds on 429', async () => {
    const h = harness([new Response('', { status: 429, headers: { 'retry-after': '42' } }), new Response('ok')])
    await h.client.get('https://x.test/')
    expect(h.waits).toContain(42_000)
  })
})

describe('parseRetryAfter', () => {
  it('retry-after date', () => {
    const now = Date.parse('2026-10-16T03:00:00Z')
    expect(parseRetryAfter('Fri, 16 Oct 2026 03:01:00 GMT', now)).toBe(60_000)
  })
  it('retry-after cap', () => {
    expect(parseRetryAfter('3600', 0)).toBe(300_000)
    expect(parseRetryAfter(null, 0)).toBeUndefined()
    expect(parseRetryAfter('soon', 0)).toBeUndefined()
  })
})
