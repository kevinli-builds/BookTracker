// Sample-size (power) calculations for the two designs a reading study
// actually runs: comparing a proportion between two groups (e.g. % who hit a
// goal) and comparing a mean (e.g. minutes read). Pure functions, unit-tested.
//
// Statistical honesty notes, mirrored in the UI:
// - Two-sided tests, equal group sizes, normal approximation. For means the
//   z-approximation runs ~1 participant/group below the exact t-based answer
//   at typical sizes; the UI says "plan for a few extra for dropout" anyway.
// - Proportions report both the uncorrected (Fleiss) n and the
//   continuity-corrected n; the corrected figure is the conservative one that
//   matches published tables.

// Inverse standard-normal CDF (quantile), Acklam's rational approximation —
// relative error < 1.2e-9 across (0,1). Good far beyond what sample-size
// planning needs.
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) return NaN
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const pl = 0.02425
  let q: number, r: number
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p > 1 - pl) {
    q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  q = p - 0.5
  r = q * q
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

export interface ProportionsResult {
  nPerGroup: number // uncorrected (Fleiss), rounded up
  nPerGroupCorrected: number // with continuity correction — the conservative figure
  total: number // 2 × corrected
}

// n per group to detect p1 vs p2 (two-sided, equal groups).
// Uncorrected: n = (z_{1−α/2}·√(2·p̄·(1−p̄)) + z_{power}·√(p1(1−p1)+p2(1−p2)))² / (p1−p2)²
// Corrected (Fleiss): n_cc = n/4 · (1 + √(1 + 4/(n·|p1−p2|)))²
// Returns null when the inputs can't power a test (p1 = p2, out of range).
export function nTwoProportions(p1: number, p2: number, alpha: number, power: number): ProportionsResult | null {
  if (!(p1 > 0 && p1 < 1) || !(p2 > 0 && p2 < 1) || p1 === p2) return null
  if (!(alpha > 0 && alpha < 1) || !(power > 0 && power < 1)) return null
  const zA = normalQuantile(1 - alpha / 2)
  const zB = normalQuantile(power)
  const pBar = (p1 + p2) / 2
  const delta = Math.abs(p1 - p2)
  const raw = Math.pow(zA * Math.sqrt(2 * pBar * (1 - pBar)) + zB * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)), 2) / (delta * delta)
  const corrected = (raw / 4) * Math.pow(1 + Math.sqrt(1 + 4 / (raw * delta)), 2)
  const nPerGroupCorrected = Math.ceil(corrected)
  return { nPerGroup: Math.ceil(raw), nPerGroupCorrected, total: 2 * nPerGroupCorrected }
}

export interface MeansResult {
  nPerGroup: number // rounded up
  total: number
}

// n per group to detect a standardized mean difference d (Cohen's d),
// two-sided, equal groups: n = 2 · ((z_{1−α/2} + z_{power}) / d)².
// Returns null for d ≤ 0 or out-of-range alpha/power.
export function nTwoMeans(d: number, alpha: number, power: number): MeansResult | null {
  if (!(d > 0) || !(alpha > 0 && alpha < 1) || !(power > 0 && power < 1)) return null
  const zA = normalQuantile(1 - alpha / 2)
  const zB = normalQuantile(power)
  const nPerGroup = Math.ceil(2 * Math.pow((zA + zB) / d, 2))
  return { nPerGroup, total: 2 * nPerGroup }
}
