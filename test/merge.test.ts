import { describe, expect, it } from 'vitest'
import { compareUnits, mergeUnits } from '../src/build/merge.js'

const unit = (source: string, target = 't', context = '') => ({ source, context, target })

describe('mergeUnits', () => {
  it('keeps projects in list order and marks low only when every project is long text', () => {
    const out = mergeUnits([
      { path: 'wp-plugins/a/dev', units: [unit('Shared')] },
      { path: 'wp-plugins/a/dev-readme', units: [unit('Shared'), unit('Readme only')] },
    ])
    expect(out).toEqual([
      { ...unit('Readme only'), projects: ['wp-plugins/a/dev-readme'], low: true },
      { ...unit('Shared'), projects: ['wp-plugins/a/dev', 'wp-plugins/a/dev-readme'], low: false },
    ])
  })
  it('keeps two targets of one source apart', () => {
    expect(mergeUnits([{ path: 'p', units: [unit('A', 'x'), unit('A', 'y')] }])).toHaveLength(2)
  })
  it('sorts by code units', () => {
    // localeCompare would put "é" next to "e"; code units put it after "z".
    const out = mergeUnits([{ path: 'p', units: [unit('é'), unit('z'), unit('e'), unit('Z')] }])
    expect(out.map((u) => u.source)).toEqual(['Z', 'e', 'z', 'é'])
    expect(compareUnits(unit('a', 'b', 'c'), unit('a', 'b', 'd'))).toBeLessThan(0)
  })
})
