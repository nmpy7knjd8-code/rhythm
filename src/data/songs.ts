declare const __BUILD_ID__: string
import raw from './songs.json'
import type { Fill, Pattern, Track, Voice } from '../engine/types'
import { registerPatterns } from './rhythms'

/** Shape of research/song-patterns.json entries. Velocities 0–1 per step. */
export interface SongEntryRaw {
  id: string; song: string; artist: string; drummer: string; bpm: number; timeSig: string; bpmDisplay?: number; bpmNote?: string; sound?: import('../engine/audio').SoundProfile; drift?: number
  stepsPerBar: number; bars: number; voices: Record<string, number[]>
  feel?: string; whyItWorks?: string; source?: string; confidence?: string; label?: string
  sections?: { name: string; repeat: number; confidence?: string; timeSig?: string; ticksPerStep?: number; bars: Record<string, string>[] }[]
  ticksPerStep?: number; meterSource?: string; lengthCheck?: { seconds: number | null; source: string; modelSeconds: number }
  tuning?: { status: string; note: string; source?: string; shift: Record<string, number> }
  form?: { section: string; bars: number }[]; formSource?: string; formNote?: string
  fills?: { name: string; stepsPerBar: number; bars: number; voices: Record<string, number[]> }[]
}
/** Map research voice names onto the app's abstract voices. Unknown names are dropped (and reported in dev). */
export const VOICE_ALIASES: Record<string, Voice> = {
  kick: 'low', snare: 'back', closedHat: 'tick', hihat: 'tick', openHat: 'open', pedalHat: 'pedal',
  ride: 'ride', rideBell: 'rideBell', crash: 'crash1', crash1: 'crash1', crash2: 'crash2', china: 'china', splash: 'china',
  tomHi: 'tomHi', tomMid: 'tomMid', tomFloor: 'tomLo', tomLo: 'tomLo', crossStick: 'accent', rim: 'accent',
  cowbell: 'bell', bell: 'bell', agogo: 'bell', shaker: 'shaker',
}

export interface SongSection { name: string; start: number; bars: number; confidence?: string; timeSig?: string }
export interface Song { raw: SongEntryRaw & { form?: { section: string; bars: number; timeSig?: string[] }[]; category?: string; firstDrumBar?: number; transcription?: { source: string; songId: number; revisionId: number; track: string; bars: number } }
  pattern: Pattern; fills: Fill[]; bars: Pattern[]; sections: SongSection[] }
function stringTracks(b: Record<string, string>): Track {
  const t: Track = {}
  for (const [k, str] of Object.entries(b)) { const v = VOICE_ALIASES[k]; if (!v) continue
    t[v] = t[v] ? [...str].map((c, i) => (c !== '.' && (t[v]![i] === '.' || c > t[v]![i]) ? c : t[v]![i])).join('') : str }
  return t
}
interface SectionFile { humanize?: { lateMs: number; jitterMs: number }; name: string; bars: (Record<string, string> & { _sub?: Record<string, Record<string, [number | string, number][]>>; _var?: Record<string, Record<string, string>> })[]; ticksPerStep: number[]; timeSig: string[]; bpm: number[]; confidence?: string }
/** Fetch the full bar-by-bar part for a song (kept out of the main bundle). */
export async function loadSongBars(song: Song): Promise<Song> {
  if (song.bars.length) return song
  const r = await fetch(`${import.meta.env.BASE_URL}songs/${song.raw.id}.json?v=${__BUILD_ID__}`)
  const data = (await r.json()) as { sections: SectionFile[] }
  const bars: Pattern[] = []
  data.sections.forEach((sec, si) => sec.bars.forEach((b, i) => {
    const { _sub, _var, _tempo, _feel, _grace, ...strs } = b as Record<string, string> & { _grace?: Record<string, Record<string, number>>; _feel?: '8th' | '16th'; _tempo?: [string, number][]; _sub?: Record<string, Record<string, [number | string, number][]>>; _var?: Record<string, Record<string, string>> }
    const variant = _var ? Object.fromEntries(Object.entries(_var).flatMap(([k, m]) => VOICE_ALIASES[k] ? [[VOICE_ALIASES[k], m]] : [])) : undefined
    const steps = Object.values(strs)[0]?.length ?? 16
    const sub = _sub ? Object.fromEntries(Object.entries(_sub).flatMap(([k, m]) => VOICE_ALIASES[k] ? [[VOICE_ALIASES[k], m]] : [])) : undefined
    const grace = _grace ? Object.fromEntries(Object.entries(_grace).flatMap(([k, m]) => VOICE_ALIASES[k] ? [[VOICE_ALIASES[k], m]] : [])) : undefined
    const [num] = (sec.timeSig[i] ?? '4/4').split('/').map(Number)
    const spb = Math.max(1, Math.round(steps / (sec.timeSig[i]?.endsWith('/8') ? num / (num % 3 === 0 ? 3 : 1) : num)))
    bars.push({ id: `song-${song.raw.id}-b${bars.length}`, name: song.raw.song, steps, stepsPerBeat: spb, ticksPerStep: sec.ticksPerStep[i], suggestedBpm: sec.bpm[i], timeSig: sec.timeSig[i], humanize: sec.humanize, sub, grace, variant, tempoAt: _tempo, feel: _feel, tracks: stringTracks(strs as Record<string, string>) })
    void si
  }))
  song.bars = bars
  return song
}

const velChar = (v: number) => (v <= 0 ? '.' : String(Math.max(1, Math.min(9, Math.round(v * 9)))))

export function toTracks(voices: Record<string, number[]>): Track {
  const t: Track = {}
  const len = Math.max(...Object.values(voices).map(a => a.length))
  voices = Object.fromEntries(Object.entries(voices).map(([k, a]) => [k, [...a, ...Array(len - a.length).fill(0)]]))
  for (const [k, arr] of Object.entries(voices)) {
    const v = VOICE_ALIASES[k]; if (!v) continue
    const s = arr.map(velChar).join('')
    // merge if two source voices map to one app voice (keep louder)
    t[v] = t[v] ? [...s].map((c, i) => (c > t[v]![i] && c !== '.' ? c : t[v]![i])).join('') : s
  }
  return t
}

/** ticks per step from time signature: bar length in 12-ticks-per-quarter units / steps per bar. */
export function ticksPerStepFor(timeSig: string, stepsPerBar: number): number {
  const [num, den] = timeSig.split('/').map(Number)
  return Math.round((12 * num * 4) / den / stepsPerBar)
}



export const SONGS: Song[] = (raw as unknown as SongEntryRaw[]).map(s => {
  const tps = s.ticksPerStep ?? ticksPerStepFor(s.timeSig, s.stepsPerBar)
  const [num, den] = s.timeSig.split('/').map(Number)
  const spb = Math.max(1, Math.round(s.stepsPerBar / (den === 8 && num % 3 === 0 ? num / 3 : num)))
  const pattern: Pattern = {
    id: `song-${s.id}`, name: s.song, steps: Math.max(...Object.values(s.voices).map(a => a.length)), stepsPerBeat: spb, ticksPerStep: tps,
    suggestedBpm: s.bpm, bpmNote: `${s.bpm} BPM from the song-pattern research (approximate tempo of the recording).`,
    swingable: s.stepsPerBar % 2 === 0 && s.stepsPerBar !== 12, tracks: toTracks(s.voices),
  }
  const fills: Fill[] = (s.fills ?? []).map((f, i) => ({
    pattern: { id: `song-${s.id}-fill${i}`, name: `${s.song}: ${f.name}`, steps: f.stepsPerBar * f.bars, stepsPerBeat: Math.max(1, f.stepsPerBar / 4), tracks: toTracks(f.voices) },
    crashAfter: true, description: `From the ${s.song} research entry (approximate transcription).`,
  }))
  const sections: SongSection[] = []; let start = 0
  for (const f of (s as Song['raw']).form ?? []) { sections.push({ name: f.section, start, bars: f.bars, timeSig: f.timeSig?.join(' · ') }); start += f.bars }
  const bars: Pattern[] = []
  return { raw: s, pattern, fills, bars, sections }
})
registerPatterns(SONGS.flatMap(s => [s.pattern, ...s.fills.map(f => f.pattern)]))

/** Displayed BPM for a song: the record's counted beat (e.g. cut-time tabs show half the written quarter tempo). */
export const shownBpm = (s: Song | null | undefined, bpm: number) => Math.round(bpm * (s?.raw.bpmDisplay ?? 1))
