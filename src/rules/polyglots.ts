import { execFile } from 'node:child_process'
import { join } from 'node:path'
import type { Finding } from '../findings.js'

export interface PolyglotsResult { exitCode: number; json?: { valid: boolean; schema?: number; error?: string; line?: number }; stderr: string }

export function polyglotsBin(root: string): string {
  return process.env.POLYGLOTS_BIN ?? join(root, 'node_modules', '.bin', 'polyglots')
}

/** `polyglots rules check --file <f> --json`: exit 0 valid, 1 invalid, 2 usage. */
export function runPolyglotsCheck(file: string, bin: string): Promise<PolyglotsResult> {
  const [cmd, pre] = /\.[cm]?js$/.test(bin) ? [process.execPath, [bin]] : [bin, []]
  return new Promise((resolve) => {
    execFile(cmd, [...pre, 'rules', 'check', '--file', file, '--json'], { timeout: 60_000 }, (err, stdout, stderr) => {
      const exitCode = err ? (typeof err.code === 'number' ? err.code : 2) : 0
      let json: PolyglotsResult['json']
      try { json = JSON.parse(stdout) } catch { json = undefined }
      resolve({ exitCode, json, stderr: String(stderr) })
    })
  })
}

export function polyglotsFindings(r: PolyglotsResult, file: string): Finding[] {
  if (r.exitCode === 0 && r.json?.valid) return []
  if (r.exitCode === 1 && r.json) {
    const line = r.json.line !== undefined ? `line ${r.json.line}: ` : ''
    return [{ level: 'error', check: 'polyglots', file, message: `${line}${r.json.error ?? 'invalid'}` }]
  }
  return [{ level: 'error', check: 'polyglots', file, message: `polyglots rules check failed to run (exit ${r.exitCode}) ${r.stderr.trim().slice(0, 200)}` }]
}
