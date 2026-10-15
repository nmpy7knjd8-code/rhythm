import { detect, limbReports, overviewOf, techniqueNotes, temposOf, tipsFor } from './advice'
import { analyze, type AnalyzedBar } from './notes'
import { buildSteps, fullBars } from './steps'
import type { Lesson, LessonSong } from './types'

/**
 * Build a practice lesson from one section of a transcribed song.
 *
 * Steps follow the notes that are actually in the tab: timekeeping voice,
 * bass drum, backbeat, ghost notes and accents, then fills. Tempos start
 * at about 60% of the section. `barRange` is an inclusive pair of absolute
 * song-bar indexes (the same numbers as the loop chip). Omit it for the
 * whole section. `song.bars` must already be loaded.
 */
export function getLesson(song: LessonSong, sectionIndex: number, barRange?: [number, number]): Lesson {
  if (!song.sections.length) throw new Error('This song has no sections.')
  const section = song.sections[sectionIndex]
  if (!section) throw new Error(`sectionIndex ${sectionIndex} is outside 0..${song.sections.length - 1}.`)
  const range = resolveRange(section, barRange)
  if (!song.bars.length || song.bars.length < range[1] + 1) {
    throw new Error('getLesson needs song.bars loaded through this section. Call loadSongBars first.')
  }
  const analyzed = analyze(song.bars.slice(range[0], range[1] + 1), range[0], song.raw.timeSig || '4/4')
  const tempos = temposOf(analyzed, song.raw.bpm || 60, song.raw.bpmDisplay ?? 1)
  const limbs = limbReports(analyzed)
  const found = detect(analyzed)
  const steps = buildSteps(analyzed, tempos)
  return {
    songId: song.raw.id,
    title: song.raw.song,
    artist: song.raw.artist,
    drummer: song.raw.drummer ?? '',
    sectionIndex,
    sectionName: section.name,
    barRange: range,
    method: 'Timekeeping voice first, then bass drum, backbeat, ghost notes and accents, then fills. Practice tempos start at about 60 percent.',
    overview: overviewOf(analyzed, section.name, tempos, limbs),
    limbs,
    counting: sampleCounts(analyzed),
    steps,
    patterns: found,
    tips: tipsFor(analyzed, found),
    techniqueNotes: techniqueNotes(analyzed),
    tempos,
    bars: fullBars(analyzed),
  }
}

function resolveRange(section: { start: number; bars: number }, barRange?: [number, number]): [number, number] {
  const first = section.start
  const last = section.start + section.bars - 1
  if (last < first) throw new Error('This section has no bars.')
  if (!barRange) return [first, last]
  const startWanted = Math.min(barRange[0], barRange[1])
  const endWanted = Math.max(barRange[0], barRange[1])
  const start = Math.max(first, startWanted)
  const end = Math.min(last, endWanted)
  if (start > end) throw new Error(`barRange ${startWanted}–${endWanted} is outside this section (${first}–${last}).`)
  return [start, end]
}

function sampleCounts(bars: AnalyzedBar[]): Lesson['counting'] {
  const seen = new Set<string>()
  const out: Lesson['counting'] = []
  for (const bar of bars) {
    const key = `${bar.count.timeSig}|${bar.count.groupingLabel}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ timeSig: bar.count.timeSig, count: bar.count })
  }
  return out
}
