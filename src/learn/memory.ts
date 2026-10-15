import type { Voice } from '../engine/types'

/** Practice choices for one song, kept while the Learn it tab is closed. Cleared when that song is loaded again. */
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
  every: 2 | 4 | 8
  loops: number
  pin: number | null
}

const mem = new Map<string, PracticeMemory>()

export const recallPractice = (id: string) => mem.get(id)
export const savePractice = (id: string, m: PracticeMemory) => { mem.set(id, m) }
export const forgetPractice = (id: string) => { mem.delete(id) }
