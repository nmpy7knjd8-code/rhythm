import type { LessonBar, LessonStep, TempoPlan } from './types'
import { voicePhrase } from './speech'
import { LAYER_ORDER, groupOf, noteKey, present, project, toPublic, type AnalyzedBar, type Layer, type Note } from './notes'

interface Draft {
  id: string
  perBar: Note[][]
}

/**
 * Steps follow a common way of learning a transcribed part: the timekeeping
 * voice, then the bass drum, the backbeat, dynamics, then fills. Drumeo
 * sometimes starts from kick and snare instead; this order matches the brief.
 * Each step is a subset of the next. Sparse parts grow one beat or one group
 * at a time until there are four steps, and never past six.
 */
export function buildSteps(bars: AnalyzedBar[], tempos: TempoPlan): LessonStep[] {
  collapseExtraLayers(bars)
  const active = LAYER_ORDER.filter(layer => bars.some(bar => bar.notes.some(note => note.layer === layer)))
  const drafts: Draft[] = []
  const allowed: Layer[] = []
  for (const layer of active) {
    allowed.push(layer)
    const set = new Set(allowed)
    drafts.push({
      id: layer,
      perBar: bars.map(bar => bar.notes.filter(note => set.has(note.layer))),
    })
  }
  // no drums in this section: nothing to build up, so no steps (the tab says so and offers the next drum section)
  if (!drafts.length) return []
  expand(bars, drafts)
  const total = bars.reduce((sum, bar) => sum + bar.notes.length, 0)
  const steps = drafts.map((draft, index) => {
    const last = index === drafts.length - 1
    const selected = draft.perBar.flat()
    const keepGrace = last || selected.length === total || selected.some(note => note.layer === 'color' || note.layer === 'fills')
    const shown = draft.perBar.map(notes => present(notes, keepGrace))
    const added = addedNotes(index === 0 ? bars.map(() => []) : drafts[index - 1].perBar, shown)
    const stepId = last ? 'full' : draft.id
    return {
      id: stepId,
      title: titleFor(draft.id, added, last),
      speak: speakFor(draft.id, added, shown, bars, tempos, index === 0, last),
      adds: addsFor(draft.id, added, last),
      noteCount: shown.reduce((sum, notes) => sum + notes.length, 0),
      bars: shown.map((notes, barIndex) => barView(bars[barIndex], notes, stepId)),
    }
  })
  numberRepeats(steps)
  return steps
}

/** Two steps can add notes on the same beat (a busy beat split in halves): "Beat 2, part 1", "Beat 2, part 2". */
function numberRepeats(steps: LessonStep[]) {
  const seen = new Map<string, number>()
  for (const step of steps) seen.set(step.title, (seen.get(step.title) ?? 0) + 1)
  const at = new Map<string, number>()
  for (const step of steps) {
    if ((seen.get(step.title) ?? 0) < 2) continue
    const n = (at.get(step.title) ?? 0) + 1
    at.set(step.title, n)
    step.title = `${step.title}, part ${n}`
  }
}

export function fullBars(bars: AnalyzedBar[]): LessonBar[] {
  return bars.map(bar => barView(bar, present(bar.notes, true), 'full'))
}

function collapseExtraLayers(bars: AnalyzedBar[]) {
  const presentLayers = () => new Set(bars.flatMap(bar => bar.notes.map(note => note.layer)))
  const retag = (from: Layer, to: Layer) => {
    for (const bar of bars) for (const note of bar.notes) if (note.layer === from) note.layer = to
  }
  let layers = presentLayers()
  if (layers.size > 6 && layers.has('pulse') && layers.has('ostinato')) retag('pulse', 'ostinato')
  layers = presentLayers()
  if (layers.size > 6 && layers.has('toms')) retag('toms', 'backbeat')
}

function expand(bars: AnalyzedBar[], drafts: Draft[]) {
  while (drafts.length < 4) {
    let gapAt = -1
    let gap = 0
    for (let i = 0; i < drafts.length - 1; i++) {
      const size = count(drafts[i + 1]) - count(drafts[i])
      if (size > gap) { gap = size; gapAt = i }
    }
    const before = gapAt === -1 ? 0 : count(drafts[0])
    if (gapAt === -1 && before > 1) gapAt = -1
    const mid = gapAt >= 0
      ? subdivide(bars, drafts[gapAt], drafts[gapAt + 1])
      : subdivide(bars, { id: 'empty', perBar: bars.map(() => []) }, drafts[0])
    if (!mid) break
    drafts.splice(gapAt >= 0 ? gapAt + 1 : 0, 0, mid)
  }
  while (drafts.length > 6) {
    let smallest = 1
    let size = Infinity
    for (let i = 1; i < drafts.length - 1; i++) {
      const added = count(drafts[i]) - count(drafts[i - 1])
      if (added < size) { size = added; smallest = i }
    }
    drafts.splice(smallest, 1)
  }
}

function subdivide(bars: AnalyzedBar[], prev: Draft, next: Draft): Draft | null {
  const added: { bar: number; note: Note; beat: number; group: number }[] = []
  for (let i = 0; i < bars.length; i++) {
    const have = new Set(prev.perBar[i].map(noteKey))
    for (const note of next.perBar[i]) {
      if (have.has(noteKey(note))) continue
      added.push({ bar: i, note, beat: note.beat, group: groupOf(bars[i].count, note.beat) })
    }
  }
  if (added.length < 2) return null
  const groups = [...new Set(added.map(item => item.group))].sort((a, b) => a - b)
  const beats = [...new Set(added.map(item => item.beat))].sort((a, b) => a - b)
  let take: (item: typeof added[number]) => boolean
  if (groups.length >= 2) take = item => item.group === groups[0]
  else if (beats.length >= 2) take = item => item.beat === beats[0]
  else {
    const half = Math.floor(added.length / 2)
    if (half < 1) return null
    const sorted = added.slice().sort((a, b) => a.bar - b.bar || a.note.step - b.note.step || (a.note.frac ?? 0) - (b.note.frac ?? 0))
    const keep = new Set(sorted.slice(0, half).map(item => noteKey(item.note)))
    take = item => keep.has(noteKey(item.note))
  }
  const perBar = next.perBar.map((notes, bar) => {
    const have = new Set(prev.perBar[bar].map(noteKey))
    return notes.filter(note => have.has(noteKey(note)) || added.some(item => item.bar === bar && item.note === note && take(item)))
  })
  const midCount = perBar.reduce((sum, notes) => sum + notes.length, 0)
  if (midCount <= count(prev) || midCount >= count(next)) return null
  const beat = Math.max(...added.filter(take).map(item => item.beat))
  return { id: `span-${beat}`, perBar }
}

function count(draft: Draft): number {
  return draft.perBar.reduce((sum, notes) => sum + notes.length, 0)
}

function addedNotes(prev: Note[][], next: Note[][]): Note[] {
  const out: Note[] = []
  for (let i = 0; i < next.length; i++) {
    const have = new Set(prev[i].map(noteKey))
    for (const note of next[i]) if (!have.has(noteKey(note))) out.push(note)
  }
  return out
}

function barView(bar: AnalyzedBar, notes: Note[], stepId: string): LessonBar {
  return {
    songBar: bar.songBar,
    index: bar.index,
    role: bar.role,
    count: bar.count,
    notes: notes.map(toPublic),
    pattern: project(bar.source, notes, stepId),
  }
}

function titleFor(id: string, added: Note[], last: boolean): string {
  if (last) return 'The full part'
  if (id === 'pulse') return 'The pulse'
  if (id === 'ostinato') return cymbalTitle(added)
  if (id === 'kick') return 'Add the bass drum'
  if (id === 'backbeat') return 'Add the backbeat'
  if (id === 'toms') return 'Add the toms'
  if (id === 'color') return colorTitle(added)
  if (id === 'fills') return 'The fills'
  if (id.startsWith('span-')) return spanTitle(added)
  return 'Next step'
}

function cymbalTitle(notes: Note[]): string {
  const hand = new Set(notes.map(note => note.voice))
  const pedal = hand.delete('pedal')
  if (hand.size === 0 && pedal) return 'The hi-hat foot'
  if (hand.size > 0 && [...hand].every(voice => voice === 'tick' || voice === 'open')) return 'The hi-hat pattern'
  if (hand.size === 1 && hand.has('ride')) return 'The ride pattern'
  if (hand.size === 1 && hand.has('rideBell')) return 'The ride bell pattern'
  return 'The time pattern'
}

function colorTitle(notes: Note[]): string {
  const ghosts = notes.some(note => note.tier === 'ghost')
  const accents = notes.some(note => note.tier === 'accent' || note.voice === 'crash1' || note.voice === 'crash2' || note.voice === 'china' || note.graces)
  if (ghosts && accents) return 'Ghost notes and accents'
  if (ghosts) return 'Ghost notes'
  return 'Accents'
}

function addsFor(id: string, added: Note[], last: boolean): string {
  if (last && !added.length) return 'Everything'
  if (id === 'pulse') return 'Pulse'
  if (id === 'kick') return 'Bass drum'
  if (id === 'backbeat') return 'Backbeat'
  if (id === 'toms') return 'Toms'
  if (id === 'fills') return 'Fills'
  if (id === 'color') return colorTitle(added)
  if (id.startsWith('span-')) return spanTitle(added)
  if (last) return 'Everything'
  return cymbalTitle(added).replace(/^The /, '')
}

function beatsOf(notes: Note[]): number[] {
  return [...new Set(notes.map(note => note.beat))].sort((a, b) => a - b)
}

/** Title from the notes this step adds, not from beats already covered by an earlier step. */
function spanTitle(added: Note[]): string {
  const beats = beatsOf(added)
  if (beats.length === 0) return 'The next notes'
  if (beats.length === 1) return `Beat ${beats[0]}`
  const contiguous = beats[beats.length - 1] - beats[0] + 1 === beats.length
  if (contiguous) return `Beats ${beats[0]}–${beats[beats.length - 1]}`
  return `Beats ${beats.join(', ')}`
}

function beatWhere(beats: number[]): string {
  if (beats.length === 1) return `beat ${beats[0]}`
  const contiguous = beats[beats.length - 1] - beats[0] + 1 === beats.length
  if (contiguous) return `beats ${beats[0]} through ${beats[beats.length - 1]}`
  return `beats ${beats.join(', ')}`
}

function speakFor(id: string, added: Note[], shown: Note[][], bars: AnalyzedBar[], tempos: TempoPlan, first: boolean, last: boolean): string {
  const what = voicePhrase(added.length ? added : shown.flat())
  const tempo = `Start at ${tempos.startBpm} beats per minute, then work up to ${tempos.fullBpm}.`
  let line: string
  if (first && id === 'pulse') line = `Play only ${what} on the beat. ${countLine(bars)}`
  else if (first && id.startsWith('span-')) line = spanLine(added)
  else if (first) line = `Play only ${what}. Count out loud, and keep the notes even.`
  else if (id === 'kick') line = 'Add the bass drum. Keep what you already have, and leave the rest out.'
  else if (id === 'backbeat') line = 'Add the snare backbeat. Make it clearly louder than the notes around it.'
  else if (id === 'toms') line = 'Add the toms. Keep the groove under them the same.'
  else if (id === 'color') line = colorLine(added)
  else if (id === 'fills') line = 'Add the fills. Land cleanly on the downbeat that comes after.'
  else if (id === 'ostinato') line = `Add the rest of ${what}. Keep the pulse the same.`
  else if (id.startsWith('span-')) line = spanLine(added)
  else line = `Add ${what}. Leave everything else as it was.`
  if (!last) return line
  const firstSentence = line.split(/(?<=[.!?])\s+/)[0]
  return `${firstSentence} ${tempo}`
}

function colorLine(notes: Note[]): string {
  const ghosts = notes.some(note => note.tier === 'ghost')
  const accents = notes.some(note => note.tier === 'accent' || note.graces || note.voice === 'crash1' || note.voice === 'crash2' || note.voice === 'china')
  if (ghosts && accents) return 'Add the ghost notes and the accents. Keep the soft notes much quieter than the backbeat.'
  if (ghosts) return 'Add the ghost notes. Keep them much quieter than the backbeat.'
  return 'Add the accents. Keep them stronger than the pattern under them.'
}

function spanLine(added: Note[]): string {
  const beats = beatsOf(added)
  if (!beats.length) return 'Add the next notes. Leave everything else as it was.'
  return `Add ${voicePhrase(added)} on ${beatWhere(beats)}. Leave the rest of the bar as it was.`
}

function countLine(bars: AnalyzedBar[]): string {
  const sigs = new Set(bars.map(bar => bar.count.timeSig))
  if (sigs.size !== 1) return 'The meter changes, so count each bar on its own.'
  const spoken = bars.find(bar => bar.count.beats.length)?.count.beats[0]?.spoken
  return spoken ? `Count "${spoken}" and keep going.` : 'Count out loud.'
}
