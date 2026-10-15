import type { Pattern, Voice } from '../engine/types'

/**
 * Right-handed kit. Hats and ride lead with the right hand, snare backbeats
 * and ghosts stay on the left, the bass drum leads with the right foot.
 * A left-handed player mirrors every R/L.
 */
export type Limb = 'rightHand' | 'leftHand' | 'rightFoot' | 'leftFoot'

export type VelocityTier = 'ghost' | 'normal' | 'accent'

/** simple: equal beats. compound: dotted-quarter beats. additive: groups of 2 and 3. */
export type MeterKind = 'simple' | 'compound' | 'additive'

/**
 * What `getLesson` reads off a song. The app's `Song` (after `loadSongBars`)
 * satisfies this. `barRange` uses absolute song-bar indexes into `bars`.
 */
export interface LessonSong {
  raw: {
    id: string
    song: string
    artist: string
    drummer?: string
    bpm: number
    timeSig: string
    /** Player multiplier when the counted beat is not the tab's quarter. */
    bpmDisplay?: number
  }
  bars: Pattern[]
  sections: { name: string; start: number; bars: number }[]
}

export interface LessonNote {
  /** Index inside this lesson, starting at 0. */
  bar: number
  /** Absolute song-bar index. */
  songBar: number
  step: number
  /** Off-grid stroke, as a fraction of the step. Absent on grid notes. */
  frac?: number
  voice: Voice
  /** 0–1. Grid notes use the engine's velocity map. */
  velocity: number
  tier: VelocityTier
  limb: Limb
  /** Hand or foot. */
  stick: 'R' | 'L'
  /** Flam is 1, drag is 2. Omitted when this step has not added ornaments yet. */
  graces?: number
}

export interface CountBeat {
  /** 1-based beat inside the bar. Continuous across an odd bar (1…7, not restarted). */
  number: number
  /**
   * What to say for this beat. "1 e & a", "2 trip let", "3 &".
   * A compound beat is always "N trip let", even when the grid is finer.
   */
  syllables: string
  /** `syllables` with "&" spoken as "and" and "a" as "ah". */
  spoken: string
  /** Grid column where the beat starts. */
  step: number
  /** Grid columns the beat covers. */
  steps: number
  /** One label per grid column. */
  grid: string[]
}

export interface BarCount {
  timeSig: string
  numerator: number
  denominator: number
  kind: MeterKind
  /**
   * Groups of the denominator's note. The parts sum to the numerator.
   * 4/4 is [1,1,1,1], 12/8 is [3,3,3,3], 7/8 is [2,2,3] or another 2/3 split.
   */
  grouping: number[]
  /** "2+2+3" */
  groupingLabel: string
  /** accents: group starts match the notes. default: conventional split. meter: fixed by the time signature. */
  groupingFrom: 'accents' | 'default' | 'meter'
  beats: CountBeat[]
  /** Beats joined for the bar. "|" sits between additive or compound groups. */
  counting: string
  countingSpoken: string
}

export interface LessonBar {
  songBar: number
  index: number
  role: 'groove' | 'fill' | 'rest'
  count: BarCount
  notes: LessonNote[]
  /** Same shape the player already sequences. A step's pattern is the full bar with notes removed. */
  pattern: Pattern
}

export interface LimbReport {
  limb: Limb
  name: string
  hits: number
  /** Share of the hits in the lesson, 0–1. */
  share: number
  voices: Voice[]
  summary: string
  /** The sticking rule that fired for this limb. */
  sticking: string
}

export interface LessonStep {
  id: string
  title: string
  /** One or two plain sentences. Safe for speechSynthesis. */
  speak: string
  /** Short name of the material this step adds. */
  adds: string
  noteCount: number
  bars: LessonBar[]
}

export interface DetectedPattern {
  id: string
  label: string
  /** What in the notes triggered this. */
  detail: string
  /** Absolute song-bar indexes. */
  bars: number[]
}

export interface LessonTip {
  id: string
  kind: 'mistake' | 'technique'
  /** Which detection selected this tip. */
  when: string
  text: string
}

export interface TempoPlan {
  /** Median tab tempo in the range, after `bpmDisplay`, in quarter-note BPM. */
  songBpm: number
  /** About 60% of `songBpm`. */
  startBpm: number
  /** About 80%. */
  middleBpm: number
  fullBpm: number
  varies: boolean
  minBpm: number
  maxBpm: number
  note: string
}

export interface LessonOverview {
  /** "4/4", or "5/8 · 7/8" when the section changes meter. */
  meter: string
  meters: { timeSig: string; bars: number }[]
  tempo: string
  bpm: number
  /** One or two sentences from the grid, not from a biography. */
  feel: string
  density: 'sparse' | 'moderate' | 'dense'
  hitsPerBeat: number
  busiestLimb: Limb
  /** "Right hand", or "Right hand, then right foot". */
  busiest: string
  summary: string
}

export interface Lesson {
  songId: string
  title: string
  artist: string
  /** Copied from the song data. The lesson text does not describe them. */
  drummer: string
  sectionIndex: number
  sectionName: string
  /**
   * Inclusive absolute song-bar indexes. The player's loop chip uses the same
   * numbers. `playRange` is half-open, so play `barRange[0]` through `barRange[1] + 1`.
   */
  barRange: [number, number]
  /** How the steps were chosen. */
  method: string
  overview: LessonOverview
  /** Always the four limbs, in kit order, even when a limb is idle. */
  limbs: LimbReport[]
  /** One sample count per distinct meter and grouping in the range. */
  counting: { timeSig: string; count: BarCount }[]
  /** Cumulative. The last step is the whole part. Each earlier step is a subset. */
  steps: LessonStep[]
  patterns: DetectedPattern[]
  tips: LessonTip[]
  techniqueNotes: string[]
  tempos: TempoPlan
  /** Unfiltered part. Every step is a subset of these bars. */
  bars: LessonBar[]
}
