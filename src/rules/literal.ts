// A port of how polyglots (app/src/rules/custom.ts) turns a `text` pattern
// into a regex, so a text fix is checked and sampled exactly as polyglots
// applies it: case-insensitive in the locale's own casing, matching every
// encoding of each letter, keeping the capital of what it replaced.

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

let precomposed: Map<string, string[]> | undefined

function precomposedOf(decomposed: string): readonly string[] {
  if (!precomposed) {
    precomposed = new Map()
    for (let cp = 0; cp <= 0x2fa1f; cp++) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue
      const ch = String.fromCodePoint(cp)
      const nfd = ch.normalize('NFD')
      if (nfd === ch) continue
      const list = precomposed.get(nfd)
      if (list) list.push(ch)
      else precomposed.set(nfd, [ch])
    }
  }
  return precomposed.get(decomposed) ?? []
}

function spellings(cluster: string): string[] {
  const nfd = [...cluster.normalize('NFD')]
  const forms = new Set([cluster.normalize('NFC'), nfd.join('')])
  for (let end = 2; end <= nfd.length; end++) {
    const rest = nfd.slice(end).join('')
    for (const ch of precomposedOf(nfd.slice(0, end).join(''))) forms.add(ch + rest)
  }
  return [...forms]
}

/** The source of polyglots' literal regex for `text` (flags 'gu'). */
export function literalSource(text: string, tag: string): string {
  return (text.normalize('NFC').match(/\P{M}\p{M}*|\p{M}+/gu) ?? [])
    .map((letter) => {
      const forms = new Set([letter, letter.toLocaleLowerCase(tag), letter.toLocaleUpperCase(tag)].flatMap(spellings))
      if (forms.size === 1) return escapeRegExp(letter)
      return `(?:${[...forms].map(escapeRegExp).join('|')})`
    })
    .join('')
}

export function capitaliseLike(matched: string, replacement: string, tag: string): string {
  const first = [...matched][0]
  if (!first || first === first.toLocaleLowerCase(tag)) return replacement
  const [head = '', ...rest] = [...replacement]
  return head.toLocaleUpperCase(tag) + rest.join('')
}

/**
 * polyglots' intlTag: a tag toLocaleLowerCase and Intl accept, tried from the
 * translate.wordpress.org slug, then its language, else 'und'.
 */
export function intlTag(slug: string): string {
  const language = slug.toLowerCase().split(/[-_]/)[0] ?? slug
  for (const candidate of [slug, language]) {
    try {
      Intl.getCanonicalLocales(candidate)
      'a'.toLocaleLowerCase(candidate)
      return candidate
    } catch {
      // try the next
    }
  }
  return 'und'
}
