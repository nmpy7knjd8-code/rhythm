import type { Pattern, Track, Voice } from '../engine/types'
import { fracOf, velocityOf } from '../engine/pattern'
import { beatOf, countBar, onBeat } from './counting'
import type { BarCount, LessonNote, VelocityTier } from './types'

export type Layer = 'pulse' | 'ostinato' | 'kick' | 'backbeat' | 'toms' | 'color' | 'fills'

export const LAYER_ORDER: Layer[] = ['pulse', 'ostinato', 'kick', 'backbeat', 'toms', 'color', 'fills']

const HAND_TIME = new Set<Voice>(['tick', 'open', 'ride', 'rideBell', 'bell', 'shaker'])
const CRASH = new Set<Voice>(['crash1', 'crash2', 'china'])
const DRUM = new Set<Voice>(['back', 'accent', 'tomHi', 'tomMid', 'tomLo'])
const TOMS = new Set<Voice>(['tomHi', 'tomMid', 'tomLo'])
const PHRASE = new Set<Voice>(['crash1', 'crash2', 'china'])

export interface Note extends LessonNote {
  layer: Layer
  beat: number
  /** Original sub-step tuple, copied back into a filtered pattern unchanged. */
  sub?: [number | string, number, string?]
  kickRun: boolean
  handRun: boolean
}

export interface AnalyzedBar {
  songBar: number
  index: number
  role: 'groove' | 'fill' | 'rest'
  signature: string
  count: BarCount
  notes: Note[]
  source: Pattern
}

export function analyze(patterns: Pattern[], songBar0: number, fallbackSig: string): AnalyzedBar[] {
  const counts = patterns.map(pattern => countBar(pattern, pattern.timeSig || fallbackSig))
  const draft = patterns.map((source, index) => ({
    songBar: songBar0 + index,
    index,
    role: 'groove' as AnalyzedBar['role'],
    signature: signatureOf(source),
    count: counts[index],
    notes: extract(source, index, songBar0 + index, counts[index]),
    source,
  }))
  const roles = rolesOf(draft)
  draft.forEach((bar, index) => { bar.role = roles[index] })
  for (const bar of draft) {
    markKickRuns(bar.notes, bar.source.ticksPerStep ?? 3)
    markHandRuns(bar.notes)
    assignLayers(bar)
    assignLimbs(bar.notes)
  }
  return draft
}

export function noteKey(note: Note): string {
  return `${note.bar}|${note.voice}|${note.step}|${note.frac ?? ''}|${note.sub ? note.sub[0] : ''}`
}

/** A step keeps a grace note once ghost/accent material (or the whole part) is in the step. */
export function present(notes: Note[], complete: boolean): Note[] {
  const ornate = notes.some(note => note.layer === 'color' || note.layer === 'fills')
  if (complete || ornate) return notes
  return notes.map(note => {
    if (!note.graces) return note
    const copy: Note = { ...note }
    delete copy.graces
    return copy
  })
}

export function toPublic(note: Note): LessonNote {
  const out: LessonNote = {
    bar: note.bar, songBar: note.songBar, step: note.step, voice: note.voice,
    velocity: note.velocity, tier: note.tier, limb: note.limb, stick: note.stick,
  }
  if (note.frac !== undefined) out.frac = note.frac
  if (note.graces) out.graces = note.graces
  return out
}

export function project(source: Pattern, notes: Note[], stepId: string): Pattern {
  const tracks: Track = {}
  for (const [voice, str] of Object.entries(source.tracks) as [Voice, string][]) {
    if (!str) continue
    const out = Array.from({ length: source.steps }, () => '.')
    for (let i = 0; i < Math.min(str.length, source.steps); i++) {
      if (!str[i] || str[i] === '.') continue
      if (notes.some(note => note.voice === voice && note.step === i && note.frac === undefined)) out[i] = str[i]
    }
    const line = out.join('')
    if ([...line].some(ch => ch !== '.')) tracks[voice] = line
  }
  const pattern: Pattern = {
    id: `${source.id}:${stepId}`,
    name: source.name,
    steps: source.steps,
    stepsPerBeat: source.stepsPerBeat,
    tracks,
  }
  if (source.ticksPerStep) pattern.ticksPerStep = source.ticksPerStep
  if (source.timeSig) pattern.timeSig = source.timeSig
  if (source.suggestedBpm) pattern.suggestedBpm = source.suggestedBpm
  if (source.feel) pattern.feel = source.feel
  if (source.humanize) pattern.humanize = source.humanize
  if (source.tempoAt) pattern.tempoAt = source.tempoAt
  if (source.swingable) pattern.swingable = source.swingable
  if (source.barTicks) pattern.barTicks = source.barTicks
  const sub = projectSub(notes)
  const grace = projectGrace(notes)
  const variant = projectVariant(source, notes)
  if (sub) pattern.sub = sub
  if (grace) pattern.grace = grace
  if (variant) pattern.variant = variant
  return pattern
}

function projectSub(notes: Note[]): Pattern['sub'] | undefined {
  const sub: NonNullable<Pattern['sub']> = {}
  for (const note of notes) {
    if (!note.sub) continue
    const map = (sub[note.voice] ??= {})
    ;(map[String(note.step)] ??= []).push(note.sub)
  }
  return Object.keys(sub).length ? sub : undefined
}

function projectGrace(notes: Note[]): Pattern['grace'] | undefined {
  const grace: NonNullable<Pattern['grace']> = {}
  for (const note of notes) {
    if (!note.graces || note.frac !== undefined) continue
    const map = (grace[note.voice] ??= {})
    map[String(note.step)] = note.graces
  }
  return Object.keys(grace).length ? grace : undefined
}

function projectVariant(source: Pattern, notes: Note[]): Pattern['variant'] | undefined {
  if (!source.variant) return undefined
  const variant: NonNullable<Pattern['variant']> = {}
  for (const [voice, map] of Object.entries(source.variant) as [Voice, Record<string, string>][]) {
    for (const [step, id] of Object.entries(map)) {
      if (notes.some(note => note.voice === voice && note.step === Number(step) && note.frac === undefined)) {
        ;(variant[voice] ??= {})[step] = id
      }
    }
  }
  return Object.keys(variant).length ? variant : undefined
}

function extract(source: Pattern, bar: number, songBar: number, count: BarCount): Note[] {
  const notes: Note[] = []
  const push = (voice: Voice, step: number, velocity: number, tier: VelocityTier, frac?: number, sub?: Note['sub'], graces?: number) => {
    if (velocity <= 0) return
    notes.push({
      bar, songBar, step, voice, velocity, tier, frac, sub, graces,
      beat: beatOf(count, step),
      limb: 'rightHand', stick: 'R', layer: 'ostinato', kickRun: false, handRun: false,
    })
  }
  for (const [voice, str] of Object.entries(source.tracks) as [Voice, string][]) {
    if (!str) continue
    for (let step = 0; step < str.length; step++) {
      const ch = str[step]
      const velocity = velocityOf(ch)
      if (!velocity) continue
      const written = source.grace?.[voice]?.[String(step)]
      const graces = written ?? (ch === 'f' ? 1 : ch === 'r' ? 2 : undefined)
      push(voice, step, velocity, tierFromChar(ch), undefined, undefined, graces)
    }
  }
  if (source.sub) {
    for (const [voice, map] of Object.entries(source.sub) as [Voice, Record<string, [number | string, number, string?][]>][]) {
      for (const [step, hits] of Object.entries(map)) {
        for (const tuple of hits) {
          const velocity = tuple[1]
          push(voice, Number(step), velocity, tierFromVelocity(velocity), roundFrac(fracOf(tuple[0])), tuple)
        }
      }
    }
  }
  return notes
}

function tierFromChar(ch: string): VelocityTier {
  if (ch === 'g' || ch === '1' || ch === '2' || ch === '3') return 'ghost'
  if (ch === 'X' || ch === '8' || ch === '9') return 'accent'
  return 'normal'
}

function tierFromVelocity(velocity: number): VelocityTier {
  if (velocity <= 0.34) return 'ghost'
  if (velocity >= 0.85) return 'accent'
  return 'normal'
}

function roundFrac(frac: number): number {
  return Math.round(frac * 1000) / 1000
}

/** Crashes are phrase markers, so two bars that differ only by a crash still match. */
function signatureOf(pattern: Pattern): string {
  const parts: string[] = []
  let any = false
  for (const [voice, str] of Object.entries(pattern.tracks) as [Voice, string][]) {
    if (!str || PHRASE.has(voice)) continue
    if ([...str].some(ch => ch !== '.')) any = true
    parts.push(`${voice}:${str}`)
  }
  return any ? parts.join('|') : 'REST'
}

function rolesOf(bars: { signature: string; notes: Note[] }[]): AnalyzedBar['role'][] {
  const counts = new Map<string, number>()
  for (const bar of bars) {
    if (bar.signature === 'REST') continue
    counts.set(bar.signature, (counts.get(bar.signature) ?? 0) + 1)
  }
  let mode = ''
  let best = 0
  for (const [sig, count] of counts) if (count > best) { mode = sig; best = count }
  return bars.map(bar => {
    if (bar.signature === 'REST') return 'rest'
    if (bar.signature === mode && best >= 2) return 'groove'
    if (bar.notes.some(note => TOMS.has(note.voice)) || hasAdjacentDrums(bar.notes)) return 'fill'
    return 'groove'
  })
}

function hasAdjacentDrums(notes: Note[]): boolean {
  const drums = [...new Set(notes.filter(note => DRUM.has(note.voice) && note.frac === undefined).map(note => note.step))].sort((a, b) => a - b)
  let run = 1
  for (let i = 1; i < drums.length; i++) {
    run = drums[i] === drums[i - 1] + 1 ? run + 1 : 1
    if (run >= 4) return true
  }
  return false
}

function markKickRuns(notes: Note[], ticksPerStep: number) {
  if (ticksPerStep > 3) return
  const kicks = notes.filter(note => note.voice === 'low' && note.frac === undefined).sort((a, b) => a.step - b.step)
  let run: Note[] = []
  const flush = () => {
    if (run.length >= 4) for (const note of run) note.kickRun = true
    run = []
  }
  for (const note of kicks) {
    if (!run.length || note.step === run[run.length - 1].step + 1) run.push(note)
    else { flush(); run = [note] }
  }
  flush()
}

function markHandRuns(notes: Note[]) {
  const drums = notes.filter(note => DRUM.has(note.voice) && note.frac === undefined).sort((a, b) => a.step - b.step)
  let run: Note[] = []
  const flush = () => {
    if (run.length >= 4) for (const note of run) note.handRun = true
    run = []
  }
  for (const note of drums) {
    if (!run.length || note.step <= run[run.length - 1].step + 1) run.push(note)
    else { flush(); run = [note] }
  }
  flush()
  const drumSubs = notes.filter(note => DRUM.has(note.voice) && note.frac !== undefined)
  if (drumSubs.length >= 4) for (const note of drumSubs) note.handRun = true
}

function assignLayers(bar: AnalyzedBar) {
  const handTime = bar.notes.some(note => HAND_TIME.has(note.voice))
  for (const note of bar.notes) note.layer = layerOf(note, bar, handTime)
  if (!handTime) {
    for (const note of bar.notes) {
      if (note.voice === 'pedal' && note.frac === undefined && onBeat(bar.count, note.step)) note.layer = 'pulse'
    }
  }
}

function layerOf(note: Note, bar: AnalyzedBar, handTime: boolean): Layer {
  if (note.voice === 'low') return 'kick'
  if (TOMS.has(note.voice)) return bar.role === 'fill' ? 'fills' : 'toms'
  if (DRUM.has(note.voice)) {
    if (note.tier === 'ghost') return 'color'
    if (note.handRun && bar.role === 'fill') return 'fills'
    if (note.frac !== undefined && note.handRun) return 'fills'
    return 'backbeat'
  }
  if (CRASH.has(note.voice)) return 'color'
  if (note.voice === 'pedal') return 'ostinato'
  if (HAND_TIME.has(note.voice) || !handTime) {
    if (note.frac === undefined && onBeat(bar.count, note.step) && HAND_TIME.has(note.voice)) return 'pulse'
    if (HAND_TIME.has(note.voice)) return 'ostinato'
  }
  return 'color'
}

/**
 * Sticking, right-handed kit:
 * cymbals on the right hand, snare backbeats and ghosts on the left,
 * fast drum runs alternate starting on the right, bass drum on the right
 * foot except a fast run with a free left foot, which alternates.
 */
function assignLimbs(notes: Note[]) {
  const pedal = notes.some(note => note.voice === 'pedal')
  let foot: 'R' | 'L' = 'R'
  const kicks = notes.filter(note => note.voice === 'low' && note.frac === undefined).sort((a, b) => a.step - b.step)
  for (const note of kicks) {
    if (note.kickRun && !pedal) {
      note.stick = foot
      foot = foot === 'R' ? 'L' : 'R'
    } else {
      note.stick = 'R'
      foot = 'R'
    }
    note.limb = note.stick === 'R' ? 'rightFoot' : 'leftFoot'
  }
  for (const note of notes) {
    if (note.voice === 'low' && note.frac !== undefined) { note.stick = 'R'; note.limb = 'rightFoot' }
    if (note.voice === 'pedal') { note.stick = 'L'; note.limb = 'leftFoot' }
  }
  for (const note of notes) {
    if (note.voice === 'low' || note.voice === 'pedal') continue
    if (HAND_TIME.has(note.voice)) { note.stick = 'R'; note.limb = 'rightHand' }
    else if (note.voice === 'back' || note.voice === 'accent') { note.stick = 'L'; note.limb = 'leftHand' }
    else { note.stick = 'R'; note.limb = 'rightHand' }
  }
  applyRunSticking(notes)
  resolveSameHand(notes)
  alternateSubs(notes)
}

function applyRunSticking(notes: Note[]) {
  const drums = notes.filter(note => note.handRun && note.frac === undefined && DRUM.has(note.voice)).sort((a, b) => a.step - b.step)
  let run: Note[] = []
  const flush = () => {
    if (run.length >= 4) {
      let hand: 'R' | 'L' = 'R'
      for (const note of run) {
        note.stick = hand
        note.limb = hand === 'R' ? 'rightHand' : 'leftHand'
        hand = hand === 'R' ? 'L' : 'R'
      }
    }
    run = []
  }
  for (const note of drums) {
    if (!run.length || note.step <= run[run.length - 1].step + 1) run.push(note)
    else { flush(); run = [note] }
  }
  flush()
}

/** Hat keeps the right hand. A second right-hand note at that step moves to the left if it is free. */
function resolveSameHand(notes: Note[]) {
  const steps = new Map<number, Note[]>()
  for (const note of notes) {
    if (note.frac !== undefined || note.limb === 'rightFoot' || note.limb === 'leftFoot') continue
    const group = steps.get(note.step) ?? []
    group.push(note)
    steps.set(note.step, group)
  }
  for (const group of steps.values()) {
    const rights = group.filter(note => note.stick === 'R')
    if (rights.length <= 1) continue
    const lead = rights.find(note => HAND_TIME.has(note.voice)) ?? rights[0]
    let leftTaken = group.some(note => note.stick === 'L')
    for (const note of rights) {
      if (note === lead || leftTaken) continue
      note.stick = 'L'
      note.limb = 'leftHand'
      leftTaken = true
    }
  }
}

function alternateSubs(notes: Note[]) {
  const subs = notes.filter(note => note.frac !== undefined && note.handRun && DRUM.has(note.voice))
  const byVoice = new Map<Voice, Note[]>()
  for (const note of subs) {
    const list = byVoice.get(note.voice) ?? []
    list.push(note)
    byVoice.set(note.voice, list)
  }
  for (const list of byVoice.values()) {
    list.sort((a, b) => a.step - b.step || (a.frac ?? 0) - (b.frac ?? 0))
    let hand: 'R' | 'L' = 'R'
    for (const note of list) {
      note.stick = hand
      note.limb = hand === 'R' ? 'rightHand' : 'leftHand'
      hand = hand === 'R' ? 'L' : 'R'
    }
  }
}

export function groupOf(count: BarCount, beat: number): number {
  if (count.kind === 'compound') return beat - 1
  let left = beat
  for (let index = 0; index < count.grouping.length; index++) {
    left -= count.grouping[index]
    if (left <= 0) return index
  }
  return Math.max(0, count.grouping.length - 1)
}
