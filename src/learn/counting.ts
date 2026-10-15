import type { Pattern, Voice } from '../engine/types'
import { fracOf, velocityOf } from '../engine/pattern'
import type { BarCount, CountBeat, MeterKind } from './types'

/**
 * Counting follows the syllables already used in src/data/theory.ts:
 * eighths "1 &", sixteenths "1 e & a", triplets "1 trip let".
 * Odd meters use groups of 2 and 3. 7/8 defaults to 2+2+3, 5/4 to 3+2,
 * matching the meter page. Eighth-note odd meters restart the count in each
 * group, as the Theory page does: 7/8 (2+2+3) is "1 2 | 1 2 | 1 2 3".
 * Quarter-note odd meters run through the bar (5/4 is "1 2 3 | 4 5"), also as on
 * the Theory page. `CountBeat.number` is always the beat's position in the bar.
 */
export function countBar(pattern: Pattern, fallbackSig = '4/4'): BarCount {
  const parsed = parseSig(pattern.timeSig || fallbackSig)
  const steps = Math.max(1, pattern.steps)
  const units = unitStrength(pattern, parsed.num)
  let kind = classify(parsed.num, parsed.den)
  let groupingFrom: BarCount['groupingFrom'] = kind === 'additive' ? 'default' : 'meter'
  let grouping = kind === 'compound'
    ? Array.from({ length: parsed.num / 3 }, () => 3)
    : kind === 'simple'
      ? Array.from({ length: parsed.num }, () => 1)
      : conventional(parsed.num, parsed.den)

  if (kind === 'compound' && (parsed.num === 9 || parsed.num === 15)) {
    const aksak = bestGrouping(parsed.num, parsed.den, units)
    const compound = Array.from({ length: parsed.num / 3 }, () => 3)
    if (aksak.score > scoreOf(compound, units) + margin(units)) {
      kind = 'additive'
      grouping = aksak.grouping
      groupingFrom = aksak.from
    }
  } else if (kind === 'additive') {
    const picked = bestGrouping(parsed.num, parsed.den, units)
    grouping = picked.grouping
    groupingFrom = picked.from
  }

  const beatCount = kind === 'compound' ? parsed.num / 3 : parsed.num
  const spans = divide(steps, Math.max(1, beatCount))
  const tripletBeat = kind === 'compound'
  // spoken number of each beat: restarts per group in x/8 (and finer) odd meters, else the beat's position
  const restart = kind === 'additive' && parsed.den >= 8
  const said: number[] = []
  for (const size of grouping) for (let k = 1; k <= size; k++) said.push(restart ? k : said.length + 1)
  const beats: CountBeat[] = []
  let step = 0
  for (let i = 0; i < spans.length; i++) {
    const columns = spans[i]
    const number = i + 1, label = said[i] ?? number
    const grid = gridLabels(label, columns, tripletBeat)
    const syllables = tripletBeat || columns === 3 ? `${label} trip let` : grid.join(' ')
    beats.push({
      number,
      syllables,
      spoken: speakLine(syllables),
      step,
      steps: columns,
      grid,
    })
    step += columns
  }

  const counting = joinBeats(beats, grouping, kind)
  return {
    timeSig: parsed.raw,
    numerator: parsed.num,
    denominator: parsed.den,
    kind,
    grouping,
    groupingLabel: grouping.join('+'),
    groupingFrom,
    beats,
    counting,
    countingSpoken: speakLine(counting),
  }
}

export function beatOf(count: BarCount, step: number): number {
  for (const beat of count.beats) {
    if (step < beat.step + beat.steps) return beat.number
  }
  return count.beats.length || 1
}

/** True when `step` is the first column of a beat. */
export function onBeat(count: BarCount, step: number): boolean {
  return count.beats.some(beat => beat.step === step)
}

function parseSig(sig: string): { num: number; den: number; raw: string } {
  const match = /^(\d+)\s*\/\s*(\d+)$/.exec(sig.trim())
  if (!match) return { num: 4, den: 4, raw: '4/4' }
  return { num: Number(match[1]), den: Number(match[2]), raw: `${Number(match[1])}/${Number(match[2])}` }
}

function classify(num: number, den: number): MeterKind {
  if (den === 4 && num <= 4) return 'simple'
  if (den === 2 && num <= 4) return 'simple'
  if (den === 8 && num % 3 === 0 && num >= 3) return 'compound'
  if (den === 8 && num % 2 === 0 && num <= 4) return 'simple'
  return 'additive'
}

/** Spread `total` columns across `parts` beats. Extra columns go to the earlier beats. */
function divide(total: number, parts: number): number[] {
  const base = Math.floor(total / parts)
  const extra = total % parts
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0))
}

function gridLabels(number: number, columns: number, compound: boolean): string[] {
  const n = String(number)
  if (columns <= 1) return [n]
  if (columns === 2) return [n, '&']
  if (columns === 3) return [n, 'trip', 'let']
  if (columns === 4) return [n, 'e', '&', 'a']
  if (columns === 5) return [n, 'e', '&', 'a', 'ta']
  if (columns === 6 && compound) return [n, '&', 'trip', '&', 'let', '&']
  if (columns === 6) return [n, 'la', 'li', '&', 'la', 'li']
  if (columns === 8) return [n, 'ta', 'e', 'ta', '&', 'ta', 'a', 'ta']
  return [n, ...Array.from({ length: columns - 1 }, (_, i) => String(i + 2))]
}

function speakLine(line: string): string {
  return line.split(' ').map(token => (token === '&' ? 'and' : token === 'a' ? 'ah' : token)).join(' ')
}

function joinBeats(beats: CountBeat[], grouping: number[], kind: MeterKind): string {
  if (kind === 'compound') return beats.map(beat => beat.syllables).join(' | ')
  const parts: string[] = []
  let index = 0
  for (const size of grouping) {
    parts.push(beats.slice(index, index + size).map(beat => beat.syllables).join(' '))
    index += size
  }
  if (parts.length === 0) return beats.map(beat => beat.syllables).join(' ')
  if (grouping.every(size => size === 1)) return parts.join(' ')
  return parts.join(' | ')
}

const WEIGHT: Partial<Record<Voice, number>> = {
  low: 1.5, back: 1.7, accent: 1.4, crash1: 1.25, crash2: 1.25, china: 1.2,
  tomHi: 1.15, tomMid: 1.15, tomLo: 1.15, tick: 0.55, open: 0.7, ride: 0.6, rideBell: 0.65,
}

/** How hard each denominator-note of the bar is hit. Used only to pick a grouping. */
function unitStrength(pattern: Pattern, units: number): number[] {
  const strength = Array.from({ length: Math.max(1, units) }, () => 0)
  const per = pattern.steps / Math.max(1, units)
  const add = (step: number, voice: Voice, velocity: number) => {
    if (velocity <= 0) return
    const unit = Math.min(strength.length - 1, Math.max(0, Math.floor(step / per)))
    strength[unit] += velocity * (WEIGHT[voice] ?? 1)
  }
  for (const [voice, str] of Object.entries(pattern.tracks) as [Voice, string][]) {
    if (!str) continue
    for (let i = 0; i < str.length; i++) add(i, voice, velocityOf(str[i]))
  }
  if (pattern.sub) {
    for (const [voice, map] of Object.entries(pattern.sub) as [Voice, Record<string, [number | string, number][]>][]) {
      for (const [step, hits] of Object.entries(map)) {
        for (const [frac, velocity] of hits) add(Number(step) + fracOf(frac), voice, velocity)
      }
    }
  }
  return strength
}

function compositions(n: number): number[][] {
  const out: number[][] = []
  const walk = (left: number, cur: number[]) => {
    if (left === 0) { out.push(cur.slice()); return }
    for (const part of [2, 3]) {
      if (part <= left) { cur.push(part); walk(left - part, cur); cur.pop() }
    }
  }
  walk(n, [])
  return out
}

/** Conventional split when accents are flat. 5/4 prefers 3+2; /8 meters prefer the long group at the end. */
function conventional(num: number, den: number): number[] {
  if (den === 4 && num === 5) return [3, 2]
  const parts = compositions(num)
  if (!parts.length) return Array.from({ length: num }, () => 1)
  if (num % 2 === 0) {
    const evens = parts.find(group => group.every(part => part === 2))
    if (evens) return evens
  }
  const endLong = parts.filter(group => group[group.length - 1] === 3)
  endLong.sort((a, b) => a.filter(part => part === 3).length - b.filter(part => part === 3).length)
  return endLong[0] ?? parts[0]
}

function scoreOf(grouping: number[], strength: number[]): number {
  let starts = 0
  let insides = 0
  let insideCount = 0
  let index = 0
  for (const size of grouping) {
    starts += strength[index] ?? 0
    for (let k = 1; k < size; k++) { insides += strength[index + k] ?? 0; insideCount++ }
    index += size
  }
  const startAvg = starts / grouping.length
  const insideAvg = insideCount ? insides / insideCount : 0
  return startAvg - insideAvg
}

function margin(strength: number[]): number {
  const mean = strength.reduce((sum, value) => sum + value, 0) / Math.max(1, strength.length)
  return Math.max(0.05, mean * 0.12)
}

function bestGrouping(num: number, den: number, strength: number[]): { grouping: number[]; score: number; from: 'accents' | 'default' } {
  const fallback = conventional(num, den)
  const fallbackScore = scoreOf(fallback, strength)
  let best = fallback
  let bestScore = fallbackScore
  for (const grouping of compositions(num)) {
    const score = scoreOf(grouping, strength)
    if (score > bestScore) { best = grouping; bestScore = score }
  }
  if (best.join() !== fallback.join() && bestScore > fallbackScore + margin(strength)) {
    return { grouping: best, score: bestScore, from: 'accents' }
  }
  return { grouping: fallback, score: fallbackScore, from: 'default' }
}
