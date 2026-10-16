import { execFileSync } from 'node:child_process'

export function changedFiles(base: string, head: string): string[] {
  return execFileSync('git', ['diff', '-z', '--name-only', '--no-renames', `${base}...${head}`], { encoding: 'utf8' }).split('\0').filter(Boolean)
}

export function showFile(rev: string, path: string): string | undefined {
  try {
    return execFileSync('git', ['show', `${rev}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return undefined
  }
}
