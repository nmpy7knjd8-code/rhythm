import type { Pattern, Voice } from '../engine/types'
import type { Song } from '../data/songs'
import { AUTHORED } from './authored'
import { deriveLesson } from './derive'

/** Right-handed kit: hats and ride in the right hand, snare and toms in the left. */
export type LimbId = 'lead-hand' | 'snare-hand' | 'kick-foot' | 'hat-foot'

/** What one limb is doing in this section. */
export interface LessonLimb {
  id: LimbId
  /** "Right hand" */
  label: string
  /** Grid row, e.g. "R hand". */
  short: string
  /** Voices this limb plays here, loudest role first. */
  voices: Voice[]
  /** Plain language, one or two sentences. */
  summary: string
}

/** One pass in the build-up from a simpler groove to the full part. */
export interface LessonStep {
  title: string
  /** What to listen for on this pass. */
  focus: string
  /** Voices that should sound. Everything else stays quiet. */
  voices: Voice[]
  /**
   * Optional simplified bar. When set, the player uses it instead of the recorded bar
   * on bars with the same `steps` and `ticksPerStep` as `grid`. Other bars keep the
   * recording, filtered to `voices`.
   */
  pattern?: Pattern
  /** Spoken when this step is selected. Defaults to title + focus. */
  say?: string
}

export interface LessonNote { title: string; fix: string }

/**
 * A practice lesson for one song section.
 * `source: 'derived'` means it was built from the transcription. The content agent
 * sets `'authored'` by putting the lesson in `authored.ts`.
 */
export interface Lesson {
  songId: string
  sectionIndex: number
  sectionName: string
  timeSig: string
  overview: string
  /** One syllable per step of the main bar ("1", "e", "&", "a", …). */
  counting: string[]
  /** How to say the count. */
  countPhrase: string
  limbs: LessonLimb[]
  /** Hand sticking for the main bar, one token per step: "R", "L", "RL", or "·". */
  sticking: string[]
  steps: LessonStep[]
  mistakes: LessonNote[]
  tips: string[]
  /** Fractions of the recorded tempo, slowest first. 1 = full speed. */
  tempos: number[]
  source: 'derived' | 'authored'
  /** Grid a simplified `LessonStep.pattern` has to match. */
  grid: { steps: number; stepsPerBeat: number; ticksPerStep: number; timeSig: string }
}

/**
 * Lesson for `song.sections[sectionIndex]`.
 * Authored lessons win. Anything not written yet is derived from the notes,
 * so the practice tab still has a real plan.
 */
export function getLesson(song: Song, sectionIndex: number): Lesson {
  const last = Math.max(0, song.sections.length - 1)
  const i = Math.max(0, Math.min(sectionIndex, last))
  return AUTHORED[`${song.raw.id}:${i}`] ?? deriveLesson(song, i)
}
