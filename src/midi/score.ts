import type { Voice } from '../engine/types'
import { drumOf, sameDrum } from './map'

/** Within ON_MS of the note is on time; up to WINDOW_MS early or late still counts as that note (Rock Band's whole window is ±50 ms,
 *  osu! at OD 5 gives ±50 / ±100 / ±150). A window never reaches past halfway to the same drum's next or previous note. */
export const ON_MS = 30
export const WINDOW_MS = 100

export type Verdict = 'on' | 'early' | 'late'
/** A note to play. `at` is when it is heard (performance.now ms), `t` its audio-context time (s). */
export interface Note { id: string; voice: Voice; at: number; t: number; bar: number; step: number; frac: number }
export interface Result { note: Note; verdict: Verdict | 'miss'; err: number }
export type HitResult =
  | { kind: 'hit'; note: Note; verdict: Verdict; err: number }
  | { kind: 'wrong'; voice: Voice; want: Voice }
  | { kind: 'extra'; voice: Voice }

export const verdictOf = (err: number): Verdict => Math.abs(err) <= ON_MS ? 'on' : err < 0 ? 'early' : 'late'

export interface Tally { on: number; early: number; late: number; miss: number; total: number; score: number }
/** On time counts whole, early or late half, a miss nothing. */
export function tally(rs: Result[]): Tally {
  const t = { on: 0, early: 0, late: 0, miss: 0, total: rs.length, score: 0 }
  for (const r of rs) t[r.verdict]++
  t.score = t.total ? (t.on + 0.5 * (t.early + t.late)) / t.total : 0
  return t
}

type Held = Note & { win: number }

/** Matches drum hits to the notes they were meant for. Pure: the caller feeds notes, hits and the clock. */
export class Scorer {
  pending: Held[] = []
  results: Result[] = []
  private last = new Map<string, Held>()

  add(n: Note) {
    const prev = this.last.get(drumOf(n.voice)), gap = prev ? n.at - prev.at : Infinity
    const held: Held = { ...n, win: Math.min(WINDOW_MS, gap / 2) }
    if (prev) prev.win = Math.min(prev.win, gap / 2)
    this.last.set(drumOf(n.voice), held)
    this.pending.push(held)
  }

  /** A hit at `at` (performance.now ms, already corrected by the calibrated offset). */
  hit(voice: Voice, at: number): HitResult {
    let best: Held | null = null, near: Held | null = null
    for (const n of this.pending) {
      const d = Math.abs(at - n.at)
      if (sameDrum(n.voice, voice)) { if (d <= n.win && (!best || d < Math.abs(at - best.at))) best = n }
      else if (d <= WINDOW_MS && (!near || d < Math.abs(at - near.at))) near = n
    }
    if (best) {
      this.pending.splice(this.pending.indexOf(best), 1)
      const err = at - best.at, verdict = verdictOf(err)
      this.keep({ note: best, verdict, err })
      return { kind: 'hit', note: best, verdict, err }
    }
    return near ? { kind: 'wrong', voice, want: near.voice } : { kind: 'extra', voice }
  }

  /** Notes whose window has closed by `now` are missed. */
  sweep(now: number): Result[] {
    const out: Result[] = []
    this.pending = this.pending.filter(n => {
      if (now - n.at <= n.win) return true
      const r: Result = { note: n, verdict: 'miss', err: 0 }; this.keep(r); out.push(r); return false
    })
    return out
  }

  /** Judged notes with audio time in [from, to). */
  between(from: number, to: number) { return this.results.filter(r => r.note.t >= from && r.note.t < to) }

  reset() { this.pending = []; this.results = []; this.last.clear() }

  private keep(r: Result) { this.results.push(r); if (this.results.length > 4000) this.results.splice(0, 2000) }
}
