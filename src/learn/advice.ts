import type { Voice } from '../engine/types'
import type { AnalyzedBar, Note } from './notes'
import { labelsOf, LIMB_NAME, LIMBS, phrase } from './speech'
import type { DetectedPattern, LessonOverview, LessonTip, Limb, LimbReport, TempoPlan } from './types'

const HAND_TIME = new Set<Voice>(['tick', 'open', 'ride', 'rideBell', 'bell', 'shaker'])

export function temposOf(bars: AnalyzedBar[], fallback: number, display = 1): TempoPlan {
  const bpms = bars.map(bar => Math.round((bar.source.suggestedBpm ?? fallback) * display)).filter(bpm => bpm > 0)
  const sorted = (bpms.length ? bpms : [Math.round(fallback * display) || 60]).slice().sort((a, b) => a - b)
  const songBpm = sorted[Math.floor(sorted.length / 2)]
  const startBpm = Math.round(songBpm * 0.6)
  const middleBpm = Math.round(songBpm * 0.8)
  const varies = sorted[0] !== sorted[sorted.length - 1]
  const note = varies
    ? `The tab moves between ${sorted[0]} and ${sorted[sorted.length - 1]} BPM. Practice from ${startBpm}, about 60 percent of the middle tempo ${songBpm}.`
    : `Start at ${startBpm} BPM, about 60 percent of the tab's ${songBpm}, then ${middleBpm}, then ${songBpm}.`
  return { songBpm, startBpm, middleBpm, fullBpm: songBpm, varies, minBpm: sorted[0], maxBpm: sorted[sorted.length - 1], note }
}

export function overviewOf(bars: AnalyzedBar[], sectionName: string, tempos: TempoPlan, limbs: LimbReport[]): LessonOverview {
  const meters = new Map<string, number>()
  for (const bar of bars) meters.set(bar.count.timeSig, (meters.get(bar.count.timeSig) ?? 0) + 1)
  const meterList = [...meters.entries()].map(([timeSig, count]) => ({ timeSig, bars: count }))
  const hits = bars.reduce((sum, bar) => sum + bar.notes.length, 0)
  const beats = bars.reduce((sum, bar) => sum + bar.count.beats.length, 0)
  const hitsPerBeat = beats ? Math.round((hits / beats) * 100) / 100 : 0
  const density = hitsPerBeat < 1.75 ? 'sparse' : hitsPerBeat < 3.75 ? 'moderate' : 'dense'
  const ranked = limbs.filter(limb => limb.hits > 0).slice().sort((a, b) => b.hits - a.hits)
  const busiestLimb: Limb = ranked[0]?.limb ?? 'rightHand'
  const busiest = ranked.length > 1 ? `${ranked[0].name}, then ${ranked[1].name.toLowerCase()}` : (ranked[0]?.name ?? 'No limb')
  const feel = feelOf(bars)
  const meter = meterList.map(item => item.timeSig).join(' · ') || '4/4'
  const tempo = tempos.varies ? `${tempos.minBpm}–${tempos.maxBpm} BPM` : `about ${tempos.songBpm} BPM`
  const summary = [
    meterSentence(sectionName, meterList),
    tempos.varies ? `Tempo in the tab runs from ${tempos.minBpm} to ${tempos.maxBpm} BPM.` : `The tab sits at about ${tempos.songBpm} BPM.`,
    feel,
    densitySentence(density, hitsPerBeat),
    ranked.length ? `The ${ranked[0].name.toLowerCase()} is the busiest limb${ranked[1] ? `, then the ${ranked[1].name.toLowerCase()}` : ''}.` : 'This range has no drum hits.',
  ].join(' ')
  return { meter, meters: meterList, tempo, bpm: tempos.songBpm, feel, density, hitsPerBeat, busiestLimb, busiest, summary }
}

export function limbReports(bars: AnalyzedBar[]): LimbReport[] {
  const notes = bars.flatMap(bar => bar.notes)
  const total = notes.length
  return LIMBS.map(limb => {
    const mine = notes.filter(note => note.limb === limb)
    const voices = [...new Set(mine.map(note => note.voice))]
    return {
      limb,
      name: LIMB_NAME[limb],
      hits: mine.length,
      share: total ? Math.round((mine.length / total) * 1000) / 1000 : 0,
      voices,
      summary: limbSummary(limb, mine),
      sticking: stickingLine(limb, notes),
    }
  })
}

export function detect(bars: AnalyzedBar[]): DetectedPattern[] {
  const found: DetectedPattern[] = []
  const mode = modalSignature(bars)
  if (mode.count >= 2) {
    found.push({
      id: 'repeating-bar',
      label: 'Repeating bar',
      detail: `${mode.count} of ${bars.length} bars are the same groove, ignoring crashes.`,
      bars: bars.filter(bar => bar.signature === mode.signature).map(bar => bar.songBar),
    })
  }
  const fills = bars.filter(bar => bar.role === 'fill')
  if (fills.length) {
    found.push({
      id: 'fill-bar',
      label: 'Fill bar',
      detail: `${fills.length} ${fills.length === 1 ? 'bar leaves' : 'bars leave'} the main groove, with toms or a run of drum notes.`,
      bars: fills.map(bar => bar.songBar),
    })
  }
  const linear = linearBars(bars)
  if (linear.length) {
    found.push({
      id: 'linear',
      label: 'Linear',
      detail: `${linear.length} bar${linear.length === 1 ? '' : 's'} almost never stack two voices. One limb plays at a time.`,
      bars: linear.map(bar => bar.songBar),
    })
  }
  const doubles = bars.filter(bar => bar.notes.some(note => note.kickRun))
  if (doubles.length) {
    found.push({
      id: 'double-bass',
      label: 'Double-bass run',
      detail: 'The bass drum plays four or more notes in a row at a sixteenth note or faster.',
      bars: doubles.map(bar => bar.songBar),
    })
  }
  const poly = polyrhythmBars(bars)
  if (poly.length) {
    found.push({
      id: 'polyrhythm',
      label: 'Polyrhythm',
      detail: poly[0].detail,
      bars: poly.map(item => item.songBar),
    })
  }
  const odd = bars.filter(bar => bar.count.kind === 'additive')
  if (odd.length) {
    const labels = new Map<string, number>()
    for (const bar of odd) labels.set(bar.count.groupingLabel, (labels.get(bar.count.groupingLabel) ?? 0) + 1)
    const top = [...labels.entries()].sort((a, b) => b[1] - a[1])[0]
    const from = odd.every(bar => bar.count.groupingFrom === 'default') ? ' The accents are flat, so this is the conventional grouping.' : ' Group starts follow the louder notes where that is clear.'
    found.push({
      id: 'odd-grouping',
      label: 'Odd grouping',
      detail: `${odd.length} bar${odd.length === 1 ? '' : 's'} in an odd meter. Most common grouping: ${top[0]}.${from}`,
      bars: odd.map(bar => bar.songBar),
    })
  }
  const flams = bars.filter(bar => bar.notes.some(note => note.graces === 1))
  if (flams.length) {
    found.push({
      id: 'flam',
      label: 'Flam',
      detail: 'A grace note sits just before a main stroke.',
      bars: flams.map(bar => bar.songBar),
    })
  }
  const rolls = bars.filter(bar => bar.notes.some(note => note.graces === 2 || (note.handRun && note.frac !== undefined) || (note.handRun && note.frac === undefined && runLength(bar, note) >= 6)))
  if (rolls.length) {
    found.push({
      id: 'roll',
      label: 'Roll',
      detail: 'A run of quick notes, a drag, or a string of off-grid strokes.',
      bars: rolls.map(bar => bar.songBar),
    })
  }
  const ghosts = bars.filter(bar => bar.notes.some(note => note.tier === 'ghost'))
  if (ghosts.length) {
    found.push({
      id: 'ghosts',
      label: 'Ghost notes',
      detail: 'Some notes are written at a soft velocity, well under the backbeat.',
      bars: ghosts.map(bar => bar.songBar),
    })
  }
  if (shuffleRatio(bars) >= 0.45 || bars.some(bar => bar.source.feel === '8th' || bar.source.feel === '16th')) {
    found.push({
      id: 'shuffle',
      label: 'Shuffle',
      detail: bars.some(bar => bar.source.feel) ? 'The tab marks a shuffle feel on these bars.' : 'The cymbal usually plays the first and last part of the triplet and skips the middle.',
      bars: bars.filter(bar => bar.count.kind === 'compound' || bar.source.feel).map(bar => bar.songBar),
    })
  }
  return found
}

export function tipsFor(bars: AnalyzedBar[], patterns: DetectedPattern[]): LessonTip[] {
  const has = (id: string) => patterns.some(pattern => pattern.id === id)
  const groupings = [...new Set(bars.filter(bar => bar.count.kind === 'additive').map(bar => bar.count.groupingLabel))]
  const clap = groupings.length <= 1
    ? `Clap ${groupings[0] ?? 'the grouping'} before you play`
    : `Clap the grouping on each bar (${groupings.join(', ')}) before you play`
  const pedal = bars.some(bar => bar.notes.some(note => note.voice === 'pedal'))
  const kickRun = has('double-bass')
  const triplet = bars.some(bar => bar.count.kind === 'compound' || bar.count.beats.some(beat => beat.steps === 3))
  const sixteenthTriplet = bars.some(bar => bar.count.denominator === 8 && bar.count.kind === 'additive' && bar.count.beats.some(beat => beat.steps === 3))
  const fourFour = bars.some(bar => bar.count.timeSig === '4/4' && bar.notes.some(note => note.voice === 'back' && note.tier !== 'ghost'))
  const density = hitsPerBeat(bars)
  const candidates: LessonTip[] = []
  if (has('odd-grouping')) candidates.push(
    { id: 'odd-rush', kind: 'mistake', when: 'odd grouping', text: `Counting straight through without the groups makes the downbeat drift. ${clap}, and keep the long group from speeding up.` },
    { id: 'odd-pulse', kind: 'technique', when: 'odd grouping', text: 'Keep the smallest pulse in your foot, one tap per beat of the bar, and let the groups sit on top of that.' },
  )
  if (sixteenthTriplet) candidates.push({
    id: 'sixteenth-triplet', kind: 'mistake', when: 'three notes per eighth',
    text: 'These are sixteenth-note triplets, three notes inside one eighth. They rush if you only feel the bar. Put a click on the eighth and fit the three notes evenly inside it.',
  })
  else if (triplet) candidates.push({
    id: 'triplet-rush', kind: 'mistake', when: 'triplet beat',
    text: 'The middle of a triplet gets rushed. Say "trip let" so the three notes share the beat equally.',
  })
  if (has('ghosts')) candidates.push(
    { id: 'ghost-loud', kind: 'mistake', when: 'ghost notes', text: 'Ghost notes come out too loud. They need a different volume from the backbeat, not a slightly quieter version of the same stroke.' },
    { id: 'ghost-height', kind: 'technique', when: 'ghost notes', text: 'Use a low stick height for the soft notes and a full stroke for the backbeat. Drumeo\'s ghost-note lesson describes ghost notes as more felt than heard.' },
  )
  if (has('flam')) candidates.push({
    id: 'flam-spacing', kind: 'technique', when: 'flam',
    text: 'A flam is a quiet grace note just before the main stroke, one of the standard snare rudiments. You should hear two sounds. If you hear one, the grace note is late or too loud.',
  })
  if (has('roll')) candidates.push({
    id: 'roll-shape', kind: 'mistake', when: 'roll',
    text: 'A roll speeds up and gets louder than the groove around it. Start it no louder than the notes before it, and aim the last note at the beat you are landing on.',
  })
  if (kickRun && pedal) candidates.push({
    id: 'kick-foot', kind: 'technique', when: 'fast bass drum with hi-hat foot',
    text: 'The left foot is on the hi-hat, so these fast bass notes stay on the right foot. Slow them down until that foot can play them evenly.',
  })
  else if (kickRun) candidates.push({
    id: 'double-feet', kind: 'technique', when: 'double-bass run',
    text: 'Alternate your feet on the fast bass run, and start each run with the right foot. Keep every stroke the same volume.',
  })
  if (has('fill-bar')) candidates.push({
    id: 'fill-landing', kind: 'mistake', when: 'fill bar',
    text: 'The fill rushes and the next downbeat arrives late. Loop the fill plus the first note after it until that note lands with the click.',
  })
  if (has('shuffle')) candidates.push({
    id: 'shuffle-middle', kind: 'technique', when: 'shuffle',
    text: 'The cymbal plays the first and last part of the triplet and leaves the middle out. Say the missing note so the long-short pair stays honest.',
  })
  if (has('linear')) candidates.push({
    id: 'linear-stack', kind: 'mistake', when: 'linear pattern',
    text: 'This passage is linear: only one limb plays at a time. If two notes land together, one of them does not belong.',
  })
  if (has('polyrhythm')) candidates.push({
    id: 'poly-separate', kind: 'technique', when: 'polyrhythm',
    text: 'Two rhythms run at different speeds. Learn each one alone against a click, then combine them. Count the longer cycle.',
  })
  if (fourFour) candidates.push({
    id: 'backbeat-early', kind: 'mistake', when: 'backbeat in 4/4',
    text: 'Once the hi-hat is busy, the backbeat tends to creep early. Wait for beats 2 and 4.',
  })
  if (pedal && !kickRun) candidates.push({
    id: 'pedal-own', kind: 'technique', when: 'hi-hat foot',
    text: 'The hi-hat foot keeps its own pulse. It should not copy the bass drum.',
  })
  if (density >= 3.75) candidates.push({
    id: 'dense-tense', kind: 'mistake', when: 'dense grid',
    text: 'This many notes get tense and uneven. Slow down until your hands stay loose, then bring the tempo back up.',
  })
  if (density > 0 && density < 1.75) candidates.push({
    id: 'sparse-fill', kind: 'mistake', when: 'sparse grid',
    text: 'There is a lot of space in this part. Leave the rests empty. The space is part of the groove.',
  })
  return candidates.slice(0, 6)
}

export function techniqueNotes(bars: AnalyzedBar[]): string[] {
  const notes = [
    'Start at about 60 percent of the section tempo, and go faster only when the step is even. Groove Essentials teaches each groove at a slow tempo and a fast one, and Melodics raises the tempo once the phrase is clean.',
    'Count out loud while you play. The syllables on each beat are there to be said, not just read.',
  ]
  if (bars.some(bar => bar.notes.some(note => note.handRun || note.kickRun))) {
    notes.push('Fast notes alternate right and left, starting with the right hand. Alternating single strokes are a basic sticking in George Lawrence Stone\'s Stick Control.')
  }
  return notes
}

function limbSummary(limb: Limb, notes: Note[]): string {
  if (!notes.length) return 'No notes in this section.'
  const names = phrase(labelsOf(notes))
  const hits = `${notes.length} ${notes.length === 1 ? 'hit' : 'hits'}`
  return `${LIMB_NAME[limb]} plays ${names} (${hits}).`
}

function stickingLine(limb: Limb, notes: Note[]): string {
  const mine = notes.filter(note => note.limb === limb)
  if (!mine.length) return 'Idle in this section.'
  const handRun = notes.some(note => note.handRun && (note.limb === 'rightHand' || note.limb === 'leftHand'))
  const kickRun = notes.some(note => note.kickRun)
  const leftKick = notes.some(note => note.kickRun && note.limb === 'leftFoot')
  const pedal = notes.some(note => note.voice === 'pedal')
  if (limb === 'rightHand') {
    const time = mine.some(note => HAND_TIME.has(note.voice))
    if (time && handRun) return 'This hand keeps the cymbal time, and fast fills start here. The hands then alternate.'
    if (time) return 'This hand keeps the cymbal time. It leads.'
    if (handRun) return 'Fast fills start on the right hand and alternate.'
    return 'These notes lead with the right hand.'
  }
  if (limb === 'leftHand') {
    const backbeat = mine.some(note => (note.voice === 'back' || note.voice === 'accent') && note.tier !== 'ghost' && !note.handRun)
    const ghosts = mine.some(note => note.tier === 'ghost')
    if (backbeat && ghosts) return 'Backbeats and ghost notes stay on the left hand, unless a fast fill makes the hands alternate.'
    if (backbeat) return 'Backbeats stay on the left hand.'
    if (ghosts) return 'Ghost notes stay on the left hand.'
    if (handRun) return 'In a fast fill the hands alternate, so some strokes land on the left.'
    return 'The left hand plays these notes.'
  }
  if (limb === 'rightFoot') {
    if (kickRun && leftKick) return 'The bass drum leads with the right foot. Fast runs alternate, starting here.'
    if (kickRun && pedal) return 'The bass drum stays on the right foot. The left foot is already on the hi-hat.'
    return 'The bass drum stays on the right foot.'
  }
  if (pedal && leftKick) return 'The hi-hat foot is here, and so is every other note of a fast bass run.'
  if (leftKick) return 'The left foot takes every other note of a fast bass run, after the right foot starts it.'
  if (pedal) return 'The hi-hat pedal stays on the left foot.'
  return 'The left foot plays these notes.'
}

function meterSentence(sectionName: string, meters: { timeSig: string; bars: number }[]): string {
  if (!meters.length) return `${sectionName} has no metered bars.`
  if (meters.length === 1) return `${sectionName} is in ${meters[0].timeSig}.`
  const list = meters.map(item => `${item.timeSig} (${item.bars} ${item.bars === 1 ? 'bar' : 'bars'})`).join(' and ')
  return `${sectionName} changes meter: ${list}.`
}

function densitySentence(density: LessonOverview['density'], hitsPerBeat: number): string {
  const amount = hitsPerBeat.toFixed(1)
  if (density === 'sparse') return `The part is sparse, about ${amount} hits per beat.`
  if (density === 'dense') return `The part is dense, about ${amount} hits per beat.`
  return `The part is moderate, about ${amount} hits per beat.`
}

function feelOf(bars: AnalyzedBar[]): string {
  const marked = bars.some(bar => bar.source.feel === '8th' || bar.source.feel === '16th')
  const compound = bars.filter(bar => bar.count.kind === 'compound').length
  // a simple-meter bar counted "1 trip let": the count line shows every beat split in three
  const simple = bars.filter(bar => bar.count.kind !== 'compound')
  const triplet = simple.filter(bar => bar.count.beats.some(beat => beat.steps === 3)).length
  const straight = bars.some(bar => bar.count.kind !== 'compound' && bar.count.beats.every(beat => beat.steps !== 3))
  const shuffle = shuffleRatio(bars) >= 0.45
  if (marked && shuffle) return 'The tab marks a shuffle, and the cymbal skips the middle of the triplet.'
  if (marked) return 'The tab marks a shuffle feel.'
  if (shuffle) return 'The cymbal pattern has a shuffle shape: the middle of the triplet is usually empty.'
  if (compound && straight) return 'Some bars divide the beat in three, and some are straight.'
  if (compound) return 'Each beat divides in three.'
  if (triplet && triplet === bars.length) return 'Each beat is split in three: count 1 trip let.'
  if (triplet) return `${triplet} of ${bars.length} bars split each beat in three (1 trip let). The rest are straight.`
  return 'The grid is straight.'
}

/** Share of compound beats whose cymbal plays the outer triplet partials and skips the middle. */
function shuffleRatio(bars: AnalyzedBar[]): number {
  let shuffled = 0
  let checked = 0
  for (const bar of bars) {
    if (bar.count.kind !== 'compound') continue
    for (const beat of bar.count.beats) {
      if (beat.steps % 3 !== 0) continue
      const per = beat.steps / 3
      const hit = [0, 1, 2].map(eighth => bar.notes.some(note =>
        HAND_TIME.has(note.voice) && note.frac === undefined && note.step === beat.step + eighth * per))
      if (!hit.some(Boolean)) continue
      checked++
      if (hit[0] && hit[2] && !hit[1]) shuffled++
    }
  }
  return checked ? shuffled / checked : 0
}

function hitsPerBeat(bars: AnalyzedBar[]): number {
  const hits = bars.reduce((sum, bar) => sum + bar.notes.length, 0)
  const beats = bars.reduce((sum, bar) => sum + bar.count.beats.length, 0)
  return beats ? hits / beats : 0
}

function modalSignature(bars: AnalyzedBar[]): { signature: string; count: number } {
  const counts = new Map<string, number>()
  for (const bar of bars) {
    if (bar.signature === 'REST') continue
    counts.set(bar.signature, (counts.get(bar.signature) ?? 0) + 1)
  }
  let signature = ''
  let count = 0
  for (const [sig, n] of counts) if (n > count) { signature = sig; count = n }
  return { signature, count }
}

function linearBars(bars: AnalyzedBar[]): AnalyzedBar[] {
  return bars.filter(bar => {
    const voices = new Set(bar.notes.filter(note => note.frac === undefined).map(note => note.voice))
    if (voices.size < 2) return false
    const stacks = new Map<number, number>()
    for (const note of bar.notes) {
      if (note.frac !== undefined) continue
      stacks.set(note.step, (stacks.get(note.step) ?? 0) + 1)
    }
    const onsets = [...stacks.values()]
    if (onsets.length < 4) return false
    const single = onsets.filter(count => count === 1).length
    return single / onsets.length >= 0.85
  })
}

function polyrhythmBars(bars: AnalyzedBar[]): { songBar: number; detail: string }[] {
  const found: { songBar: number; detail: string }[] = []
  for (const bar of bars) {
    const periods: { voice: Voice; period: number }[] = []
    const byVoice = new Map<Voice, number[]>()
    for (const note of bar.notes) {
      if (note.frac !== undefined) continue
      const list = byVoice.get(note.voice) ?? []
      list.push(note.step)
      byVoice.set(note.voice, list)
    }
    for (const [voice, steps] of byVoice) {
      const period = regularPeriod([...new Set(steps)].sort((a, b) => a - b))
      if (period) periods.push({ voice, period })
    }
    let detail = ''
    for (let i = 0; i < periods.length && !detail; i++) {
      for (let j = i + 1; j < periods.length; j++) {
        const a = periods[i]
        const b = periods[j]
        if (a.period === b.period || a.period % b.period === 0 || b.period % a.period === 0) continue
        detail = `One voice repeats every ${a.period} steps and another every ${b.period}, and neither divides the other.`
        break
      }
    }
    if (detail) found.push({ songBar: bar.songBar, detail })
  }
  return found
}

function regularPeriod(steps: number[]): number | null {
  if (steps.length < 3) return null
  const gaps = steps.slice(1).map((step, index) => step - steps[index])
  const period = gaps[0]
  if (period <= 1) return null
  return gaps.every(gap => gap === period) ? period : null
}

function runLength(bar: AnalyzedBar, note: Note): number {
  const steps = bar.notes.filter(item => item.handRun && item.voice === note.voice && item.frac === undefined).map(item => item.step)
  if (!steps.includes(note.step)) return 0
  return new Set(steps).size
}
