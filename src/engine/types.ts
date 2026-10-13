/** Abstract voices. Kits map these to concrete sounds, so one pattern plays on any kit. */
export type Voice =
  | 'low' | 'back' | 'tick' | 'open' | 'pedal' | 'ride' | 'rideBell' | 'crash1' | 'crash2' | 'china'
  | 'tomHi' | 'tomMid' | 'tomLo' | 'accent' | 'shaker' | 'bell'

export const VOICES: Voice[] = ['crash1', 'crash2', 'china', 'ride', 'rideBell', 'open', 'tick', 'pedal', 'tomHi', 'tomMid', 'tomLo', 'back', 'accent', 'low', 'bell', 'shaker']

/** Step grid string per voice. '.' rest; 'X' accent (1.0), 'x' normal (0.75), 'g' ghost (0.3);
 *  digits '1'–'9' set velocity n/9; 'f' = flam (grace + main), 'r' = ruff/drag (two graces + main). */
export type Track = Partial<Record<Voice, string>>

export interface Pattern {
  id: string
  name: string
  /** Steps per bar. Must divide 48 (4, 6, 8, 12, 16, 24, 48). */
  steps: number
  /** Steps per beat, for grid grouping (4 = 16ths in 4/4, 3 = 12/8). */
  stepsPerBeat: number
  tracks: Track
  suggestedBpm?: number
  /** Whether swing applies (only for even subdivisions). */
  swingable?: boolean
  /** Grid ticks per step (12 ticks = one quarter note). Defaults to 48/steps (one 4/4 bar per cycle).
   *  Set explicitly for odd meters (7/8 in 16ths: steps 14, ticksPerStep 3) and polymeter. */
  ticksPerStep?: number
  suggestedSwing?: number
  /** Explicit bar length in ticks (12 per quarter) when it differs from the pattern cycle. */
  barTicks?: number
  /** Display time signature, e.g. '7/8'. */
  timeSig?: string
  /** Sub-step hits: per voice, per step, [fraction of the step (0–1), velocity] pairs, e.g. 32nds or roll strokes. */
  sub?: Partial<Record<Voice, Record<string, [number | string, number][]>>>
  /** Instrument/pitch variant per hit: voice → step → variant id (see VARIANTS), e.g. splash on the crash row. */
  variant?: Partial<Record<Voice, Record<string, string>>>
  /** Grace strokes from the tab: voice → onset key ('step' or 'step:n/d' off-grid) → 1 (flam) or 2 (drag). They sit just before that
   *  instant, on their own drum (which may differ from the main note's); the main note keeps its written velocity. */
  grace?: Partial<Record<Voice, Record<string, number>>>
  /** Tempo changes inside the bar: [fraction of the bar ('n/d'), quarter-note BPM]. */
  tempoAt?: [string, number][]
  /** Tab shuffle marking for this bar: off-beats were moved to 2/3 of each 8th or 16th pair. */
  feel?: '8th' | '16th'
  /** Laid-back feel: every note later by lateMs, plus a repeatable ±jitterMs human wobble. */
  humanize?: { lateMs: number; jitterMs: number }
  /** URL for the default tempo's source. */
  bpmSource?: string
  /** Category for browsing. */
  category?: string
  /** Where the default tempo comes from (shown as a note). */
  bpmNote?: string
}

export interface Hit { voice: Voice; velocity: number; graces?: number }

export interface Layer {
  id: string
  pattern: Pattern
  volume: number // 0..1
  mute: boolean
  solo: boolean
}

export interface Section { name: string; bars: number; patternIds: string[]; note: string; crash?: boolean }
export interface Arrangement { id: string; name: string; bpm: number; sections: Section[] }

export interface SampleLayer { /** upper velocity bound 0..1 */ vel: number; files: string[] }
export interface KitVoice {
  /** tone shaping after the voice gain: lowpass Hz, high shelf [Hz, dB], peaking cut [Hz, dB, Q], minimum attack fade-in (s) */
  eq?: { lp?: number; shelf?: [number, number]; peak?: [number, number, number]; attack?: number }
  kind: 'membrane' | 'noise' | 'metal' | 'sample'
  /** sample kind: velocity layers, each with round-robin files (paths relative to sample base URL) */
  layers?: SampleLayer[]
  /** synth used until samples have loaded */
  fallback?: KitVoice
  /** sample playback rate (pitch shift), default 1 */
  rate?: number
  pitch?: number // Hz
  decay?: number // seconds (synth kinds)
  tone?: number // filter cutoff Hz for noise / harmonicity for metal
  pitchDecay?: number
  gain?: number
}
export interface Kit { id: string; name: string; blurb: string; voices: Record<Voice, KitVoice> }

/** A fill replaces the groove for its bar. crashAfter = crash on the next downbeat. */
export interface Fill { pattern: Pattern; crashAfter: boolean; description: string; category?: string }
