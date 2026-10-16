/**
 * A token that points at a site: `://`, `www.` or a domain-like word. Fixes
 * and prompt text use this one rule, so neither check can be looser.
 */
export const URL_TOKEN = /:\/\/|www\.|\b[a-z0-9-]+\.[a-z]{2,}\b/i
