import type { Lesson } from './types'

/**
 * Finished lessons, keyed `${songId}:${sectionIndex}`.
 * The content agent fills this map. A missing key uses the derived plan from the transcription
 * (`getLesson` in `./types`). Replace an entry; don't change the Lesson shape.
 */
export const AUTHORED: Partial<Record<string, Lesson>> = {}
