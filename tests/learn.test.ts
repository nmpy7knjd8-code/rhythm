import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import type { Pattern, Track, Voice } from '../src/engine/types.ts'
import { getLesson, type Lesson, type LessonSong } from '../src/learn/index.ts'

const ALIASES: Record<string, Voice> = {
  kick: 'low', snare: 'back', closedHat: 'tick', hihat: 'tick', openHat: 'open', pedalHat: 'pedal',
  ride: 'ride', rideBell: 'rideBell', crash: 'crash1', crash1: 'crash1', crash2: 'crash2', china: 'china', splash: 'china',
  tomHi: 'tomHi', tomMid: 'tomMid', tomFloor: 'tomLo', tomLo: 'tomLo', crossStick: 'accent', rim: 'accent',
  cowbell: 'bell', bell: 'bell', agogo: 'bell', shaker: 'shaker',
}

interface RawBar {
  _sub?: Record<string, Record<string, [number | string, number, string?][]>>
  _var?: Record<string, Record<string, string>>
  _grace?: Record<string, Record<string, number>>
  _feel?: '8th' | '16th'
  _tempo?: [string, number][]
  [key: string]: unknown
}
interface RawSection {
  name: string
  bars: RawBar[]
  ticksPerStep: number[]
  timeSig: string[]
  bpm: number[]
  humanize?: { lateMs: number; jitterMs: number }
}

function load(id: string): LessonSong {
  const songs = JSON.parse(readFileSync('src/data/songs.json', 'utf8')) as { id: string; song: string; artist: string; drummer?: string; bpm: number; timeSig: string; bpmDisplay?: number }[]
  const meta = songs.find(song => song.id === id)
  if (!meta) throw new Error(`missing ${id}`)
  const file = JSON.parse(readFileSync(`public/songs/${id}.json`, 'utf8')) as { sections: RawSection[] }
  const bars: Pattern[] = []
  const sections = file.sections.map(section => {
    const start = bars.length
    section.bars.forEach((raw, index) => bars.push(toPattern(id, raw, section, index, bars.length)))
    return { name: section.name, start, bars: section.bars.length }
  })
  return {
    raw: { id, song: meta.song, artist: meta.artist, drummer: meta.drummer, bpm: meta.bpm, timeSig: meta.timeSig, bpmDisplay: meta.bpmDisplay },
    bars,
    sections,
  }
}

function toPattern(id: string, raw: RawBar, section: RawSection, index: number, absolute: number): Pattern {
  const { _sub, _var, _grace, _feel, _tempo, ...rest } = raw
  const tracks = stringTracks(rest)
  const steps = Object.values(tracks)[0]?.length ?? 16
  const timeSig = section.timeSig[index] ?? '4/4'
  const [num] = timeSig.split('/').map(Number)
  const divisor = timeSig.endsWith('/8') ? num / (num % 3 === 0 ? 3 : 1) : num
  const pattern: Pattern = {
    id: `song-${id}-b${absolute}`,
    name: id,
    steps,
    stepsPerBeat: Math.max(1, Math.round(steps / divisor)),
    ticksPerStep: section.ticksPerStep[index],
    suggestedBpm: section.bpm[index],
    timeSig,
    tracks,
  }
  if (_feel) pattern.feel = _feel
  if (_tempo) pattern.tempoAt = _tempo
  if (section.humanize) pattern.humanize = section.humanize
  const sub = remap(_sub)
  const grace = remap(_grace)
  const variant = remap(_var)
  if (sub) pattern.sub = sub
  if (grace) pattern.grace = grace
  if (variant) pattern.variant = variant
  return pattern
}

function stringTracks(bar: Record<string, unknown>): Track {
  const tracks: Track = {}
  for (const [key, value] of Object.entries(bar)) {
    if (typeof value !== 'string') continue
    const voice = ALIASES[key]
    if (!voice) continue
    const prev = tracks[voice]
    tracks[voice] = prev
      ? [...value].map((ch, i) => (ch !== '.' && (prev[i] === '.' || ch > prev[i]) ? ch : prev[i])).join('')
      : value
  }
  return tracks
}

function remap<T>(map: Record<string, T> | undefined): Partial<Record<Voice, T>> | undefined {
  if (!map) return undefined
  const out: Partial<Record<Voice, T>> = {}
  for (const [key, value] of Object.entries(map)) {
    const voice = ALIASES[key]
    if (voice) out[voice] = value
  }
  return Object.keys(out).length ? out : undefined
}

function events(pattern: Pattern): string[] {
  const out: string[] = []
  for (const [voice, line] of Object.entries(pattern.tracks)) {
    if (!line) continue
    for (let i = 0; i < line.length; i++) if (line[i] !== '.') out.push(`${voice}@${i}=${line[i]}`)
  }
  if (pattern.sub) {
    for (const [voice, map] of Object.entries(pattern.sub)) {
      for (const [step, hits] of Object.entries(map ?? {})) {
        for (const hit of hits) out.push(`${voice}@${step}~${hit[0]}=${hit[1]}`)
      }
    }
  }
  if (pattern.grace) {
    for (const [voice, map] of Object.entries(pattern.grace)) {
      for (const [step, count] of Object.entries(map ?? {})) out.push(`${voice}@${step}g${count}`)
    }
  }
  return out.sort()
}

function isSubset(smaller: string[], larger: string[]): boolean {
  const left = new Map<string, number>()
  for (const event of larger) left.set(event, (left.get(event) ?? 0) + 1)
  for (const event of smaller) {
    const have = left.get(event) ?? 0
    if (have <= 0) return false
    left.set(event, have - 1)
  }
  return true
}

function sameEvents(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((event, index) => event === b[index])
}

function sentences(text: string): number {
  return text.split(/[.!?]+/).map(part => part.trim()).filter(Boolean).length
}

function prose(lesson: Lesson): string {
  return [
    lesson.method, lesson.overview.summary, lesson.overview.feel, lesson.overview.meter, lesson.overview.tempo, lesson.overview.busiest,
    ...lesson.limbs.flatMap(limb => [limb.summary, limb.sticking]),
    ...lesson.steps.flatMap(step => [step.title, step.speak, step.adds]),
    ...lesson.patterns.flatMap(pattern => [pattern.label, pattern.detail]),
    ...lesson.tips.flatMap(tip => [tip.when, tip.text]),
    ...lesson.techniqueNotes,
    lesson.tempos.note,
    ...lesson.bars.map(bar => bar.count.counting),
  ].join('\n')
}

function assertMeter(lesson: Lesson) {
  for (const bar of lesson.bars) {
    const [num] = bar.count.timeSig.split('/').map(Number)
    const label = `${lesson.sectionName} bar ${bar.songBar} ${bar.count.timeSig}`
    assert.equal(bar.count.grouping.reduce((sum, part) => sum + part, 0), num, label)
    assert.equal(bar.count.beats.reduce((sum, beat) => sum + beat.steps, 0), bar.pattern.steps, label)
    if (bar.count.kind === 'compound') assert.equal(bar.count.beats.length * 3, num, label)
    else assert.equal(bar.count.beats.length, num, label)
    for (const beat of bar.count.beats) {
      assert.equal(beat.grid.length, beat.steps, label)
      assert.ok(beat.syllables.length > 0, label)
    }
    if (bar.count.kind === 'additive') {
      assert.ok(bar.count.grouping.every(part => part === 2 || part === 3), `${label} grouping ${bar.count.groupingLabel}`)
    }
  }
}

function assertSteps(lesson: Lesson, sources: Pattern[]) {
  assert.ok(lesson.steps.length >= 4 && lesson.steps.length <= 6, `${lesson.sectionName} has ${lesson.steps.length} steps`)
  const full = lesson.bars.map(bar => events(bar.pattern))
  sources.forEach((source, index) => {
    assert.ok(sameEvents(events(source), full[index]), `${lesson.sectionName} bar ${index} dropped or invented a note`)
  })
  const stepEvents = lesson.steps.map(step => step.bars.map(bar => events(bar.pattern)))
  for (let i = 0; i < stepEvents.length; i++) {
    stepEvents[i].forEach((eventsHere, bar) => {
      assert.ok(isSubset(eventsHere, full[bar]), `${lesson.sectionName} step ${i} is not a subset`)
      if (i > 0) assert.ok(isSubset(stepEvents[i - 1][bar], eventsHere), `${lesson.sectionName} step ${i} went backwards`)
    })
    const step = lesson.steps[i]
    const count = sentences(step.speak)
    assert.ok(count >= 1 && count <= 2, `${lesson.sectionName} "${step.speak}" has ${count} sentences`)
  }
  const last = stepEvents[stepEvents.length - 1]
  last.forEach((eventsHere, bar) => assert.ok(sameEvents(eventsHere, full[bar]), `${lesson.sectionName} last step is not the full part`))
}

const CASES = [
  { id: 'schism', section: 3, name: 'Verse 1' },
  { id: 'fool', section: 1, name: 'Verse 1' },
  { id: 'yyz', section: 0, name: 'Intro' },
  { id: 'yyz', section: 1, name: 'Intro - Morse for "YYZ"' },
  { id: 'backinblack', section: 1, name: 'Verse 1' },
  { id: '4646', section: 10, name: 'Drum Solo' },
]

for (const item of CASES) {
  test(`${item.id} ${item.name}: subsets, meter, tempo, speech`, () => {
    const song = load(item.id)
    const lesson = getLesson(song, item.section)
    assert.equal(lesson.sectionName, item.name)
    assert.equal(lesson.barRange[0], song.sections[item.section].start)
    assert.equal(lesson.barRange[1], song.sections[item.section].start + song.sections[item.section].bars - 1)
    const sources = song.bars.slice(lesson.barRange[0], lesson.barRange[1] + 1)
    assertMeter(lesson)
    assertSteps(lesson, sources)
    assert.equal(lesson.limbs.length, 4)
    assert.equal(lesson.tempos.startBpm, Math.round(lesson.tempos.songBpm * 0.6))
    assert.ok(lesson.tempos.startBpm < lesson.tempos.fullBpm)
    assert.equal(lesson.tempos.middleBpm, Math.round(lesson.tempos.songBpm * 0.8))
    assert.ok(lesson.techniqueNotes.length >= 2)
    const text = prose(lesson)
    if (lesson.drummer) assert.ok(!text.includes(lesson.drummer), `prose mentions ${lesson.drummer}`)
  })
}

test('Schism verse counts 5/8 and 7/8 in triplets', () => {
  const lesson = getLesson(load('schism'), 3)
  const meters = new Set(lesson.bars.map(bar => bar.count.timeSig))
  assert.ok(meters.has('5/8') && meters.has('7/8'))
  for (const bar of lesson.bars) {
    assert.equal(bar.count.kind, 'additive')
    assert.ok(bar.count.beats.every(beat => beat.syllables.endsWith('trip let')))
    if (bar.count.numerator === 7) assert.equal(bar.count.grouping.length, 3)
    if (bar.count.numerator === 5) assert.equal(bar.count.grouping.length, 2)
  }
  assert.ok(lesson.patterns.some(pattern => pattern.id === 'odd-grouping'))
})

test('Fool in the Rain verse is 12/8, and ghosts arrive after the backbeat', () => {
  const lesson = getLesson(load('fool'), 1)
  assert.ok(!prose(lesson).includes('Purdie'))
  for (const bar of lesson.bars) {
    assert.equal(bar.count.timeSig, '12/8')
    assert.equal(bar.count.kind, 'compound')
    assert.deepEqual(bar.count.grouping, [3, 3, 3, 3])
    assert.deepEqual(bar.count.beats.map(beat => beat.syllables), ['1 trip let', '2 trip let', '3 trip let', '4 trip let'])
  }
  const snare = (index: number) => lesson.steps[index].bars.map(bar => bar.pattern.tracks.back ?? '').join('')
  const skeleton = lesson.steps.findIndex(step => {
    const line = step.bars.map(bar => bar.pattern.tracks.back ?? '').join('')
    return line.includes('7') && !line.includes('3')
  })
  const ghosts = lesson.steps.findIndex((_, index) => snare(index).includes('3'))
  assert.ok(skeleton >= 0 && ghosts > skeleton)
  assert.ok(lesson.patterns.some(pattern => pattern.id === 'ghosts'))
})

test('YYZ intro is five beats of 5/4', () => {
  const lesson = getLesson(load('yyz'), 0)
  for (const bar of lesson.bars) {
    assert.equal(bar.count.timeSig, '5/4')
    assert.equal(bar.count.beats.length, 5)
    assert.deepEqual(bar.count.beats.map(beat => beat.syllables), ['1 e & a', '2 e & a', '3 e & a', '4 e & a', '5 e & a'])
    assert.ok(bar.count.groupingLabel === '3+2' || bar.count.groupingLabel === '2+3')
  }
})

test('Back in Black verse counts sixteenths and adds the kick before the snare', () => {
  const lesson = getLesson(load('backinblack'), 1)
  for (const bar of lesson.bars) {
    assert.equal(bar.count.timeSig, '4/4')
    assert.equal(bar.count.kind, 'simple')
    assert.deepEqual(bar.count.beats.map(beat => beat.syllables), ['1 e & a', '2 e & a', '3 e & a', '4 e & a'])
    assert.equal(bar.count.counting, '1 e & a 2 e & a 3 e & a 4 e & a')
  }
  const sounds = (step: Lesson['steps'][number], voice: Voice) => step.bars.some(bar => [...(bar.pattern.tracks[voice] ?? '')].some(ch => ch !== '.'))
  const kickBeforeSnare = lesson.steps.findIndex(step => sounds(step, 'low') && !sounds(step, 'back'))
  const withSnare = lesson.steps.findIndex(step => sounds(step, 'back'))
  const hatsFirst = lesson.steps.findIndex(step => sounds(step, 'tick') && !sounds(step, 'low'))
  assert.ok(hatsFirst >= 0 && hatsFirst < kickBeforeSnare && kickBeforeSnare < withSnare)
})

test('Forty Six & 2 drum solo counts 7/8 in groups of 2 and 3', () => {
  const lesson = getLesson(load('4646'), 10)
  const odd = lesson.bars.filter(bar => bar.count.timeSig === '7/8')
  assert.ok(odd.length >= 7)
  for (const bar of odd) {
    assert.equal(bar.count.kind, 'additive')
    assert.equal(bar.count.grouping.reduce((sum, part) => sum + part, 0), 7)
    assert.ok(bar.count.counting.includes('|'))
    // like the Theory page (7/8 = 1-2 1-2 1-2-3): every group restarts at 1
    for (const group of bar.count.counting.split('|')) assert.equal(group.trim().split(' ')[0], '1')
  }
})

test('barRange limits the lesson to those absolute bars', () => {
  const song = load('schism')
  const section = song.sections[3]
  const lesson = getLesson(song, 3, [section.start, section.start])
  assert.equal(lesson.bars.length, 1)
  assert.deepEqual(lesson.barRange, [section.start, section.start])
  assertMeter(lesson)
  assert.throws(() => getLesson(song, 3, [0, 2]), /outside this section/)
  assert.throws(() => getLesson(song, 99), /outside/)
})

test('every section of every song builds a lesson without throwing', () => {
  const songs = JSON.parse(readFileSync('src/data/songs.json', 'utf8')) as { id: string; category?: string }[]
  let n = 0
  for (const meta of songs) {
    const song = load(meta.id)
    song.sections.forEach((_, i) => { const lesson = getLesson(song, i); assert.ok(lesson.steps.length > 0, `${meta.id} ${i}`); n++ })
  }
  assert.ok(n > 500, String(n))
})
