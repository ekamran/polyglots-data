import { Worker } from 'node:worker_threads'
import type { Finding } from '../findings.js'
import { adversarialStrings } from './adversarial.js'
import type { RegexItem } from './items.js'

export const BUDGET_MS = 20
export const HARD_MS = 5000
const WORKER = new URL('./regex-worker.mjs', import.meta.url)

function runOne(source: string, strings: string[], hardMs: number): Promise<{ ms: number; length: number } | 'timeout' | Error> {
  return new Promise((resolve) => {
    const w = new Worker(WORKER, { workerData: { source, strings } })
    const timer = setTimeout(() => { void w.terminate(); resolve('timeout') }, hardMs)
    w.once('message', (m: { ms: number; length: number }) => { clearTimeout(timer); void w.terminate(); resolve(m) })
    w.once('error', (e: Error) => { clearTimeout(timer); resolve(e) })
  })
}

export async function timeRegexes(items: RegexItem[], corpus: string[], file: string, o: { budgetMs?: number; hardMs?: number; adversarial?: boolean } = {}): Promise<Finding[]> {
  const budget = o.budgetMs ?? BUDGET_MS
  const hard = o.hardMs ?? HARD_MS
  const out: Finding[] = []
  for (const r of items) {
    const strings = o.adversarial === false ? corpus : [...corpus, ...adversarialStrings(r.source)]
    const res = await runOne(r.source, strings, hard)
    if (res === 'timeout') out.push({ level: 'error', check: 'regex-time', file, message: `${r.where}: did not finish within ${hard} ms` })
    else if (res instanceof Error) out.push({ level: 'error', check: 'regex-time', file, message: `${r.where}: ${res.message}` })
    else if (res.ms > budget) out.push({ level: 'error', check: 'regex-time', file, message: `${r.where}: ${res.ms.toFixed(1)} ms on a string of ${res.length} characters, the budget is ${budget} ms` })
  }
  return out
}
