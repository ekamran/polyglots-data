import { expect, it } from 'vitest'
it('blocks live fetches', async () => {
  await expect(fetch('https://translate.wordpress.org/')).rejects.toThrow('live network call in a test')
})
