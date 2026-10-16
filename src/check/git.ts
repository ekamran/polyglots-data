import { execFileSync } from 'node:child_process'

export function changedFiles(base: string, head: string): string[] {
  return execFileSync('git', ['diff', '--name-only', '--no-renames', `${base}...${head}`], { encoding: 'utf8' }).split('\n').filter(Boolean)
}

export function showFile(rev: string, path: string): string | undefined {
  try {
    return execFileSync('git', ['show', `${rev}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return undefined
  }
}
