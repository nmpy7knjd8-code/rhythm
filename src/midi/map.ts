import type { Voice } from '../engine/types'
import { VOICES } from '../engine/types'

/** MIDI note -> Pulse voice. General MIDI drums plus the Alesis Nitro Pro's own numbers (Nitro Pro user guide §5.2:
 *  hi-hat half-open 23, hi-hat splash 21, Tom 3 rim 58, Tom 4 rim 39); every other Nitro Pro default is the GM number. */
export const DEFAULT_MAP: Record<number, Voice> = {
  35: 'low', 36: 'low',
  37: 'accent', 38: 'back', 40: 'back',
  42: 'tick', 46: 'open', 23: 'open', 44: 'pedal', 21: 'pedal',
  48: 'tomHi', 50: 'tomHi', 45: 'tomMid', 47: 'tomMid', 43: 'tomLo', 58: 'tomLo', 41: 'tomLo', 39: 'tomLo',
  49: 'crash1', 57: 'crash2', 52: 'china', 55: 'crash1',
  51: 'ride', 59: 'ride', 53: 'rideBell',
  56: 'bell',
}

/** One drum, as a drummer counts it: any zone of the same piece is the right drum. Toms stay apart. */
const DRUM: Record<Voice, string> = {
  low: 'kick', back: 'snare', accent: 'snare', tick: 'hat', open: 'hat', pedal: 'pedal',
  tomHi: 'tom1', tomMid: 'tom2', tomLo: 'tom3', ride: 'ride', rideBell: 'ride',
  crash1: 'crash', crash2: 'crash', china: 'crash', bell: 'bell', shaker: 'shaker',
}
export const drumOf = (v: Voice) => DRUM[v]
export const sameDrum = (a: Voice, b: Voice) => DRUM[a] === DRUM[b]
/** Voices a kit can't play (no pad), so they are never scored. */
export const UNSCORED = new Set<Voice>(['shaker'])

export const DRUM_NAME: Record<string, string> = {
  kick: 'Kick', snare: 'Snare', hat: 'Hi-hat', pedal: 'Hi-hat pedal', tom1: 'Tom 1', tom2: 'Tom 2', tom3: 'Floor tom',
  ride: 'Ride', crash: 'Crash', bell: 'Bell', shaker: 'Shaker',
}

/** The pads asked for, in order, when you set the pads up yourself. */
export const PADS: { name: string; voice: Voice }[] = [
  { name: 'Kick', voice: 'low' }, { name: 'Snare', voice: 'back' }, { name: 'Snare rim', voice: 'accent' },
  { name: 'Hi-hat closed', voice: 'tick' }, { name: 'Hi-hat open', voice: 'open' }, { name: 'Hi-hat pedal', voice: 'pedal' },
  { name: 'Tom 1', voice: 'tomHi' }, { name: 'Tom 2', voice: 'tomMid' }, { name: 'Floor tom', voice: 'tomLo' },
  { name: 'Ride', voice: 'ride' }, { name: 'Crash', voice: 'crash1' }, { name: 'Crash 2', voice: 'crash2' },
]

/** A note-on with velocity > 0 on any channel: [note, velocity 1-127], else null (note-offs, aftertouch, controllers). */
export function noteOn(data: ArrayLike<number>): [number, number] | null {
  return data.length >= 3 && (data[0] & 0xf0) === 0x90 && data[2] > 0 ? [data[1], data[2]] : null
}

const FEET = new Set<Voice>(['low', 'pedal'])
/** What a connected kit is scored on: the soloed voices, else the muted ones (you play them in), else everything; within Hands or Feet only. */
export function scoredVoices(limb: 'all' | 'hands' | 'feet', muted: Voice[], solo: Voice[]): Set<Voice> {
  let list = limb === 'feet' ? [...FEET] : limb === 'hands' ? VOICES.filter(v => !FEET.has(v)) : [...VOICES]
  if (solo.length) list = list.filter(v => solo.includes(v))
  else if (muted.length) list = list.filter(v => muted.includes(v))
  return new Set(list)
}
