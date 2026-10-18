import type { Voice } from '../engine/types'

/** Practice choices for one song. */
export interface PracticeMemory {
  countIn: boolean
  click: boolean
  voice: boolean
  limb: 'all' | 'hands' | 'feet'
  muted: Voice[]
  solo: Voice[]
  stepOn: boolean
  step: number
  trainer: boolean
  /** speed trainer: start and end tempo (percent of the recording), the climb, and full loops per climb */
  from: number
  to: number
  by: number
  every: 1 | 2 | 4 | 8
  loops: number
  pin: number | null
}

/** Highest tempo (percent of the recording) at which a full loop of the section was played through, and when. */
export interface Best { pct: number; at: number; last: number }

/**
 * Kept in localStorage so a reload or a new day picks up where you were:
 * count-in, click, voice and the speed-trainer settings are habits (every song); limb, mutes, solos and the step are per song;
 * best tempos are per section. The pinned bar, loop count and trainer switch belong to one sitting (memory only,
 * cleared when the song is loaded again).
 */
const KEY = 'pulse.learn.v1'
type Prefs = Pick<PracticeMemory, 'countIn' | 'click' | 'voice' | 'from' | 'to' | 'by' | 'every'>
type SongPractice = Pick<PracticeMemory, 'limb' | 'muted' | 'solo' | 'stepOn' | 'step'>
type Sitting = Pick<PracticeMemory, 'trainer' | 'loops' | 'pin'>
interface Stored { prefs?: Partial<Prefs>; songs?: Record<string, { practice?: Partial<SongPractice>; best?: Record<string, Best> }> }

const read = (): Stored => {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} }
}
const write = (s: Stored) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* storage full or blocked: keep going without it */ } }
const sitting = new Map<string, Sitting>()

export const recallPractice = (id: string): Partial<PracticeMemory> => {
  const s = read()
  return { ...s.prefs, ...s.songs?.[id]?.practice, ...sitting.get(id) }
}
export const savePractice = (id: string, m: PracticeMemory) => {
  sitting.set(id, { trainer: m.trainer, loops: m.loops, pin: m.pin })
  const s = read(), songs = (s.songs ??= {})
  s.prefs = { countIn: m.countIn, click: m.click, voice: m.voice, from: m.from, to: m.to, by: m.by, every: m.every }
  songs[id] = { ...songs[id], practice: { limb: m.limb, muted: m.muted, solo: m.solo, stepOn: m.stepOn, step: m.step } }
  write(s)
}
export const forgetPractice = (id: string) => { sitting.delete(id) }

/** Section key: index and name, so a renamed or reordered section starts fresh instead of inheriting another's record. */
export const sectionKey = (index: number, name: string) => `${index}:${name}`

export const bests = (id: string): Record<string, Best> => read().songs?.[id]?.best ?? {}

/** A full loop was played at `pct`: raise the best if it's higher, and note the time either way. */
export const recordLoop = (id: string, key: string, pct: number, now = Date.now()) => {
  const s = read(), songs = (s.songs ??= {}), song = (songs[id] ??= {}), best = (song.best ??= {})
  const was = best[key]
  best[key] = !was || pct > was.pct ? { pct, at: now, last: now } : { ...was, last: now }
  write(s)
}

const DAY = 86_400_000
export function ago(t: number, now = Date.now()): string {
  const days = Math.floor((startOfDay(now) - startOfDay(t)) / DAY)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}
const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }

/** The section worth a revisit: practised before, not today, the longest ago (ties: the slower best). */
export function reviewPick(records: Record<string, Best>, keys: string[], current: string, now = Date.now()): string | null {
  const due = keys.filter(k => k !== current && records[k] && ago(records[k].last, now) !== 'today')
  due.sort((a, b) => records[a].last - records[b].last || records[a].pct - records[b].pct)
  return due[0] ?? null
}
