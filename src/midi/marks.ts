import type { Note, Verdict } from './score'

/** Small stores so only the notation marks and the readout re-render on a hit, never the whole Learn tab. */
export function store<T>(init: T) {
  let v = init; const ws = new Set<() => void>()
  return {
    get: () => v, set: (n: T) => { v = n; ws.forEach(f => f()) },
    watch: (f: () => void) => { ws.add(f); return () => { ws.delete(f) } },
  }
}
export type Mark = Verdict | 'miss'
export const marks = store(new Map<number, Map<string, { m: Mark; main: boolean }>>())
/** A cell shows its on-the-step note's mark; an off-grid stroke of that drum in the step (roll, 32nd) never overwrites it. */
export const putMark = (n: Note, m: Mark) => {
  const key = `${n.step}:${n.voice}`, main = n.frac === 0, cur = marks.get().get(n.bar)?.get(key)
  if (cur?.main && !main) return
  const all = new Map(marks.get()); all.set(n.bar, new Map(all.get(n.bar)).set(key, { m, main })); marks.set(all)
}
export const clearMarks = (bar?: number) => { if (bar === undefined) marks.set(new Map()); else if (marks.get().has(bar)) { const all = new Map(marks.get()); all.delete(bar); marks.set(all) } }
