import type { Voice } from '../engine/types'
import type { Limb } from './types'

/** Voice names: VOICE_LABEL in sentences and speech, VOICE_SHORT where a row label must fit (step grid). */
export const VOICE_SHORT: Record<Voice, string> = {
  crash1: 'Crash', crash2: 'Crash 2', china: 'China', ride: 'Ride', rideBell: 'Bell', open: 'Open HH', tick: 'Hi-hat', pedal: 'Pedal HH',
  tomHi: 'Tom 1', tomMid: 'Tom 2', tomLo: 'Floor', back: 'Snare', accent: 'Rim', low: 'Kick', bell: 'Cowbell', shaker: 'Shaker',
}
export const VOICE_LABEL: Record<Voice, string> = {
  low: 'bass drum',
  back: 'snare',
  tick: 'hi-hat',
  open: 'open hi-hat',
  pedal: 'hi-hat foot',
  ride: 'ride',
  rideBell: 'ride bell',
  crash1: 'crash',
  crash2: 'crash',
  china: 'china',
  tomHi: 'high tom',
  tomMid: 'middle tom',
  tomLo: 'floor tom',
  accent: 'cross-stick',
  bell: 'bell',
  shaker: 'shaker',
}

export const LIMB_NAME: Record<Limb, string> = {
  rightHand: 'Right hand',
  leftHand: 'Left hand',
  rightFoot: 'Right foot',
  leftFoot: 'Left foot',
}

export const LIMBS: Limb[] = ['rightHand', 'leftHand', 'rightFoot', 'leftFoot']

/** Most-used labels first, crashes collapsed to one name. */
export function labelsOf(notes: { voice: Voice }[]): string[] {
  const counts = new Map<string, number>()
  for (const n of notes) {
    const label = VOICE_LABEL[n.voice]
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([label]) => label)
}

/** "the hi-hat, the snare, and the bass drum". More than three names end with "and more". */
export function phrase(labels: string[]): string {
  if (labels.length === 0) return 'the written notes'
  const the = labels.slice(0, 3).map(label => `the ${label}`)
  if (labels.length > 3) return `${the[0]}, ${the[1]}, ${the[2]}, and more`
  if (the.length === 1) return the[0]
  if (the.length === 2) return `${the[0]} and ${the[1]}`
  return `${the[0]}, ${the[1]}, and ${the[2]}`
}

export function voicePhrase(notes: { voice: Voice }[]): string {
  return phrase(labelsOf(notes))
}
