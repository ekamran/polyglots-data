export function parseList(values: string[] | undefined): string[] {
  return (values ?? []).flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean)
}

export function localesFromChanges(files: string[], withTm: string[]): string[] {
  if (files.includes('core/tm.yaml')) return [...withTm].sort()
  const changed = new Set(files.map((f) => /^locales\/([^/]+)\/tm\.yaml$/.exec(f)?.[1]).filter((x): x is string => !!x))
  return withTm.filter((c) => changed.has(c)).sort()
}
