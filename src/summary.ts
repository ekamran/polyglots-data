import type { Finding } from './findings.js'

export interface Section { title: string; findings?: Finding[]; lines?: string[] }

export function renderSummary(sections: Section[]): string {
  return sections.map((s) => [
    `## ${s.title}`, '',
    ...(s.findings ?? []).map((f) => `- **${f.level}** ${f.file ? `${f.file}: ` : ''}${f.message}`),
    ...(s.lines ?? []).map((l) => `- ${l}`),
    '',
  ].join('\n')).join('\n')
}
