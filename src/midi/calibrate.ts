/** Calibration: the drummer hits along to clicks they hear. Offset = median of (hit − nearest click), ignoring the first
 *  `skip` clicks while they lock in and any hit more than half a click from every click. Null when too few hits agree. */
export interface Calibration { offset: number; spread: number; used: number }
export function calibrate(clicks: number[], hits: number[], skip = 4, minUsed = 8): Calibration | null {
  if (clicks.length < 2) return null
  const gap = clicks[1] - clicks[0], from = clicks[Math.min(skip, clicks.length - 1)] - gap / 2
  const errs: number[] = []
  for (const h of hits) {
    if (h < from) continue
    let d = Infinity
    for (const c of clicks) if (Math.abs(h - c) < Math.abs(d)) d = h - c
    if (Math.abs(d) < gap / 2) errs.push(d)
  }
  if (errs.length < minUsed) return null
  const offset = median(errs), spread = median(errs.map(e => Math.abs(e - offset)))
  return { offset: Math.round(offset), spread: Math.round(spread), used: errs.length }
}
export function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
