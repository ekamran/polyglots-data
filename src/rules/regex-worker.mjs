// Runs in a worker thread: a JS regex cannot be stopped in its own thread,
// so the parent kills this worker when it takes too long.
import { parentPort, workerData } from 'node:worker_threads'

const { source, flags, strings } = workerData
// The flags polyglots uses: 'gu'/'gui' patterns scan every match, 'u' sentenceEnd regexes run once.
const re = new RegExp(source, flags)
const global = re.global
let worst = { ms: 0, length: 0 }
for (const [index, text] of strings.entries()) {
  parentPort.postMessage({ kind: 'progress', index })
  let best = Infinity
  // Twice, keeping the faster run, so JIT warm-up does not count.
  for (let i = 0; i < 2; i++) {
    const t0 = performance.now()
    if (global) for (const _ of text.matchAll(re)) { /* scan like polyglots does */ }
    else re.exec(text)
    best = Math.min(best, performance.now() - t0)
  }
  if (best > worst.ms) worst = { ms: best, length: text.length }
}
parentPort.postMessage({ kind: 'done', ...worst })
