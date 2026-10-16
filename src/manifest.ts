export const REPO = 'emreerkan/polyglots-data'
export const LATEST = `https://github.com/${REPO}/releases/latest/download/`

export function releaseUrl(tag: string, file: string): string {
  return `https://github.com/${REPO}/releases/download/${tag}/${file}`
}

export interface ManifestProject { path: string; units: number; stale?: string; kind?: 'long-text' }
export interface TmEntry {
  locale: string; slug: string; url: string; bytes: number; bytesUncompressed: number
  sha512: string; units: number; built: string; projects: ManifestProject[]
}
export interface RulesEntry {
  locale: string; slug: string; url: string; sha512: string; schema: number
  minPolyglots: string; status: 'maintained' | 'draft'; maintainers: string[]
}
export interface Manifest { schema: 1; generated: string; tm: TmEntry[]; rules: RulesEntry[] }
