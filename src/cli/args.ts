export function parseList(values: string[] | undefined): string[] {
  return (values ?? []).flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean)
}

export function localesFromChanges(files: string[], withTm: string[]): string[] {
  if (files.includes('core/tm.yaml')) return [...withTm].sort()
  const changed = new Set(files.map((f) => /^locales\/([^/]+)\/tm\.yaml$/.exec(f)?.[1]).filter((x): x is string => !!x))
  return withTm.filter((c) => changed.has(c)).sort()
}

/** The smoke command downloads at most 3 projects: accept only 1, 2 or 3 (default 3). */
export function parseSmokeMax(v: string | undefined): number {
  const n = v === undefined ? 3 : /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN
  if (!Number.isInteger(n) || n < 1 || n > 3) throw new Error('--max must be 1, 2 or 3')
  return n
}
