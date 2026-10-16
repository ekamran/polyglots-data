import { execFile } from 'node:child_process'
import { join } from 'node:path'
import type { Finding } from '../findings.js'

/** error: why the process failed to run or was stopped (spawn error code, signal), when there is no exit status. */
export interface PolyglotsResult { exitCode: number; json?: { valid: boolean; schema?: number; error?: string; line?: number }; stderr: string; error?: string }

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
      const detail = err && typeof err.code !== 'number'
        ? [err.code !== undefined && err.code !== null ? String(err.code) : '', err.signal ? `signal ${err.signal}` : '', err.message].filter(Boolean).join(': ')
        : err?.signal ? `signal ${err.signal}` : undefined
      resolve({ exitCode, json, stderr: String(stderr), ...(detail ? { error: detail } : {}) })
    })
  })
}

export function polyglotsFindings(r: PolyglotsResult, file: string): Finding[] {
  if (r.exitCode === 0 && r.json?.valid) return []
  if (r.exitCode === 1 && r.json) {
    const line = r.json.line !== undefined ? `line ${r.json.line}: ` : ''
    return [{ level: 'error', check: 'polyglots', file, message: `${line}${r.json.error ?? 'invalid'}` }]
  }
  const why = r.stderr.trim() || r.error || ''
  return [{ level: 'error', check: 'polyglots', file, message: `polyglots rules check failed to run (exit ${r.exitCode}) ${why.slice(0, 200)}`.trimEnd() }]
}
