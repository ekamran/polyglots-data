import type { Review } from './approval.js'

const API = 'https://api.github.com'
const headers = (token: string) => ({ Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' })

async function pages<T>(url: string, token: string): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; ; page++) {
    const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}per_page=100&page=${page}`, { headers: headers(token) })
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
    const batch = (await res.json()) as T[]
    out.push(...batch)
    if (batch.length < 100) return out
  }
}

export async function listReviews(repo: string, pr: number, token: string): Promise<Review[]> {
  const raw = await pages<{ user: { login: string } | null; state: string; submitted_at: string; commit_id?: string }>(`${API}/repos/${repo}/pulls/${pr}/reviews`, token)
  return raw.filter((r) => r.user).map((r) => ({ login: r.user!.login, state: r.state, submittedAt: r.submitted_at, commitId: r.commit_id }))
}

export async function listPrFiles(repo: string, pr: number, token: string): Promise<string[]> {
  return (await pages<{ filename: string }>(`${API}/repos/${repo}/pulls/${pr}/files`, token)).map((f) => f.filename)
}

export async function getFileAtRef(repo: string, path: string, ref: string, token: string): Promise<string | undefined> {
  const res = await fetch(`${API}/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`, { headers: { ...headers(token), Accept: 'application/vnd.github.raw+json' } })
  if (res.status === 404) return undefined
  if (!res.ok) throw new Error(`${path}@${ref}: HTTP ${res.status}`)
  return res.text()
}
