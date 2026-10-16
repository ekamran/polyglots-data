import type { RulesItems } from '../rules/items.js'

export interface ItemChange { kind: 'regex' | 'fix' | 'prompt' | 'when'; where: string; change: 'added' | 'removed'; text: string }

function flat(items: RulesItems | undefined): Array<Omit<ItemChange, 'change'>> {
  if (!items) return []
  return [
    ...items.regexes.filter((r) => !r.derived).map((r) => ({ kind: 'regex' as const, where: r.where, text: `/${r.source}/${r.flags}` })),
    ...items.fixes.map((f) => ({ kind: 'fix' as const, where: f.where, text: `${f.find !== undefined ? `/${f.find}/${f.flags}` : f.text ?? ''} → ${f.replace}` })),
    ...items.prompts.map((p) => ({ kind: 'prompt' as const, where: p.where, text: p.text })),
    ...items.whens.map((w) => ({ kind: 'when' as const, where: w.where, text: [w.source !== undefined ? `source: ${w.source}` : '', w.notSource !== undefined ? `notSource: ${w.notSource}` : ''].filter(Boolean).join(', ') })),
  ]
}

export function diffItems(base: RulesItems | undefined, head: RulesItems): ItemChange[] {
  const key = (i: Omit<ItemChange, 'change'>) => `${i.kind}\u0000${i.where}\u0000${i.text}`
  const b = flat(base)
  const h = flat(head)
  const bk = new Set(b.map(key))
  const hk = new Set(h.map(key))
  const out: ItemChange[] = []
  for (const kind of ['regex', 'fix', 'prompt', 'when'] as const) {
    for (const i of b.filter((x) => x.kind === kind && !hk.has(key(x)))) out.push({ ...i, change: 'removed' })
    for (const i of h.filter((x) => x.kind === kind && !bk.has(key(x)))) out.push({ ...i, change: 'added' })
  }
  return out
}
