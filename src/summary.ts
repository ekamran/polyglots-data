import type { Finding } from './findings.js'

export interface Section { title: string; findings?: Finding[]; lines?: string[] }

/** Makes untrusted text safe to place in one line of Markdown. */
export function esc(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ').replace(/[\\`*_{}[\]()#+\-.!|<>~]/g, '\\$&')
}

export function renderSummary(sections: Section[]): string {
  return sections.map((s) => [
    `## ${esc(s.title)}`, '',
    ...(s.findings ?? []).map((f) => `- **${f.level}** ${f.file ? `${esc(f.file)}: ` : ''}${esc(f.message)}`),
    ...(s.lines ?? []).map((l) => `- ${esc(l)}`),
    '',
  ].join('\n')).join('\n')
}
