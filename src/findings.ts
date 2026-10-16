export type Level = 'error' | 'warning' | 'info'

export interface Finding {
  level: Level
  check: string
  message: string
  file?: string
}

export function hasErrors(findings: Finding[]): boolean {
  return findings.some((f) => f.level === 'error')
}
