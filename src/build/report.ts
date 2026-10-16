import type { BuildResult } from './run.js'

export function renderReport(r: BuildResult, tag: string): string {
  const lines = [`# Build ${tag}`, '', r.publish ? 'Published.' : 'Nothing changed; no release.', '']
  if (r.red.length) lines.push('## Needs attention', '', ...r.red.map((x) => `- ${x}`), '')
  lines.push('## TM', '', '| Locale | Units | Built | Stale projects |', '|---|---:|---|---|')
  for (const e of r.manifest.tm) lines.push(`| ${e.locale} | ${e.units.toLocaleString('en')} | ${e.built} | ${e.projects.filter((p) => p.stale).map((p) => p.path).join(', ') || '–'} |`)
  lines.push('', `Exports downloaded: ${r.downloads}.`, '', '## Projects', '', '| Locale | Path | Action | Units | Note |', '|---|---|---|---:|---|')
  for (const p of r.log) lines.push(`| ${p.locale} | ${p.path} | ${p.action} | ${p.units} | ${p.note ?? ''} |`)
  lines.push('', '## Rules', '', ...r.manifest.rules.map((e) => `- ${e.locale}: schema ${e.schema}, ${e.status}`), '')
  return lines.join('\n')
}
