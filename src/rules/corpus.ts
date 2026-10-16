import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

const unescape = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')

/** Test strings for rules: every seg of a .tmx.gz, every line of a .txt. */
export function loadCorpus(files: string[]): string[] {
  const out = new Set<string>()
  for (const f of files) {
    if (f.endsWith('.tmx.gz')) {
      const xml = gunzipSync(readFileSync(f)).toString('utf8')
      for (const m of xml.matchAll(/<seg>([\s\S]*?)<\/seg>/g)) out.add(unescape(m[1] ?? ''))
    } else {
      for (const line of readFileSync(f, 'utf8').split('\n')) if (line.trim()) out.add(line)
    }
  }
  return [...out]
}
