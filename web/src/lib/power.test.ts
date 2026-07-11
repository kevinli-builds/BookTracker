import { describe, it, expect } from 'vitest'
import { normalQuantile, nTwoProportions, nTwoMeans } from './power'

// Canonical values a researcher would check this tool against.

describe('normalQuantile', () => {
  it('matches the standard z table', () => {
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 5)
    expect(normalQuantile(0.995)).toBeCloseTo(2.575829, 5)
    expect(normalQuantile(0.9)).toBeCloseTo(1.281552, 5)
    expect(normalQuantile(0.8)).toBeCloseTo(0.841621, 5)
    expect(normalQuantile(0.5)).toBeCloseTo(0, 9)
  })

  it('is symmetric and guards its domain', () => {
    expect(normalQuantile(0.025)).toBeCloseTo(-normalQuantile(0.975), 9)
    expect(normalQuantile(0)).toBeNaN()
    expect(normalQuantile(1)).toBeNaN()
  })
})

describe('nTwoProportions', () => {
  it('reproduces the classic 20% vs 30% textbook case', () => {
    // α=.05 two-sided, power=.80: uncorrected ≈ 293.2 → 294; Fleiss-corrected 313.
    const r = nTwoProportions(0.2, 0.3, 0.05, 0.8)!
    expect(r.nPerGroup).toBe(294)
    expect(r.nPerGroupCorrected).toBe(313)
    expect(r.total).toBe(626)
  })

  it('needs fewer people for bigger effects and more power costs more', () => {
    const small = nTwoProportions(0.2, 0.5, 0.05, 0.8)!
    const big = nTwoProportions(0.2, 0.3, 0.05, 0.8)!
    expect(small.nPerGroupCorrected).toBeLessThan(big.nPerGroupCorrected)
    const p80 = nTwoProportions(0.2, 0.3, 0.05, 0.8)!
    const p90 = nTwoProportions(0.2, 0.3, 0.05, 0.9)!
    expect(p90.nPerGroupCorrected).toBeGreaterThan(p80.nPerGroupCorrected)
  })

  it('rejects unpowerable inputs', () => {
    expect(nTwoProportions(0.3, 0.3, 0.05, 0.8)).toBeNull()
    expect(nTwoProportions(0, 0.3, 0.05, 0.8)).toBeNull()
    expect(nTwoProportions(0.2, 1, 0.05, 0.8)).toBeNull()
    expect(nTwoProportions(0.2, 0.3, 0, 0.8)).toBeNull()
  })

  it('is symmetric in p1/p2', () => {
    const a = nTwoProportions(0.2, 0.3, 0.05, 0.8)!
    const b = nTwoProportions(0.3, 0.2, 0.05, 0.8)!
    expect(a.nPerGroupCorrected).toBe(b.nPerGroupCorrected)
  })
})

describe('nTwoMeans', () => {
  it('reproduces the classic medium-effect case', () => {
    // d=0.5, α=.05, power=.80 → z-approx 62.8 → 63/group (t-exact is 64;
    // the UI notes the approximation and advises planning for dropout).
    const r = nTwoMeans(0.5, 0.05, 0.8)!
    expect(r.nPerGroup).toBe(63)
    expect(r.total).toBe(126)
  })

  it('scales inversely with the square of the effect', () => {
    const d05 = nTwoMeans(0.5, 0.05, 0.8)!
    const d10 = nTwoMeans(1.0, 0.05, 0.8)!
    // Quarter the n (within rounding) for double the effect.
    expect(Math.abs(d10.nPerGroup - d05.nPerGroup / 4)).toBeLessThanOrEqual(1)
  })

  it('rejects unpowerable inputs', () => {
    expect(nTwoMeans(0, 0.05, 0.8)).toBeNull()
    expect(nTwoMeans(-0.5, 0.05, 0.8)).toBeNull()
    expect(nTwoMeans(0.5, 0.05, 1)).toBeNull()
  })
})
