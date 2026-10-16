// Tests never reach translate.wordpress.org or GitHub: any fetch to a host
// other than localhost throws, so a missing fake shows up as a failure.
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const { hostname } = new URL(href)
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') throw new Error(`live network call in a test: ${href}`)
  return realFetch(input, init)
}) as typeof fetch
