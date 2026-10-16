import { Worker } from 'node:worker_threads'
import type { Finding } from '../findings.js'
import { adversarialStrings } from './adversarial.js'
import type { RegexItem } from './items.js'

export const BUDGET_MS = 20
export const HARD_MS = 5000
const WORKER = new URL('./regex-worker.mjs', import.meta.url)

type Outcome = { ms: number; length: number } | { timeout: true; length?: number } | Error

/** The hard limit applies to each string: the timer restarts on every progress message from the worker. */
function runOne(source: string, flags: string, strings: string[], hardMs: number): Promise<Outcome> {
  return new Promise((resolve) => {
    const w = new Worker(WORKER, { workerData: { source, flags, strings } })
    let settled = false
    let length: number | undefined
    let timer: NodeJS.Timeout
    const finish = (r: Outcome) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void w.terminate()
      resolve(r)
    }
    const arm = () => {
      clearTimeout(timer)
      timer = setTimeout(() => finish({ timeout: true, ...(length === undefined ? {} : { length }) }), hardMs)
    }
    arm()
    w.on('message', (m: { kind: 'progress'; index: number } | { kind: 'done'; ms: number; length: number }) => {
      if (settled) return
      if (m.kind === 'progress') { length = strings[m.index]?.length; arm() }
      else finish({ ms: m.ms, length: m.length })
    })
    w.once('error', (e: Error) => finish(e))
    w.once('exit', (code) => finish(new Error(`worker exited with code ${code}`)))
  })
}

export async function timeRegexes(items: RegexItem[], corpus: string[], file: string, o: { budgetMs?: number; hardMs?: number; adversarial?: boolean } = {}): Promise<Finding[]> {
  const budget = o.budgetMs ?? BUDGET_MS
  const hard = o.hardMs ?? HARD_MS
  const out: Finding[] = []
  for (const r of items) {
    const strings = o.adversarial === false ? corpus : [...corpus, ...adversarialStrings(r.source)]
    const res = await runOne(r.source, r.flags, strings, hard)
    if ('timeout' in res) out.push({ level: 'error', check: 'regex-time', file, message: `${r.where}: did not finish within ${hard} ms${res.length === undefined ? '' : ` on a string of ${res.length} characters`}` })
    else if (res instanceof Error) out.push({ level: 'error', check: 'regex-time', file, message: `${r.where}: ${res.message}` })
    else if (res.ms > budget) out.push({ level: 'error', check: 'regex-time', file, message: `${r.where}: ${res.ms.toFixed(1)} ms on a string of ${res.length} characters, the budget is ${budget} ms` })
  }
  return out
}
