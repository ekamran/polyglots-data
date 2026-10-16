// Runs in a worker thread: a JS regex cannot be stopped in its own thread,
// so the parent kills this worker when it takes too long.
import { parentPort, workerData } from 'node:worker_threads'

const { source, strings } = workerData
const re = new RegExp(source, 'gu')
let worst = { ms: 0, length: 0 }
for (const [index, text] of strings.entries()) {
  parentPort.postMessage({ kind: 'progress', index })
  let best = Infinity
  // Twice, keeping the faster run, so JIT warm-up does not count.
  for (let i = 0; i < 2; i++) {
    const t0 = performance.now()
    for (const _ of text.matchAll(re)) { /* scan like polyglots does */ }
    best = Math.min(best, performance.now() - t0)
  }
  if (best > worst.ms) worst = { ms: best, length: text.length }
}
parentPort.postMessage({ kind: 'done', ...worst })
