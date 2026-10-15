import type { Pattern, Voice } from '../engine/types'
import { ticksPerStep, velocityOf } from '../engine/pattern'
import { VOICES } from '../engine/types'
import type { Song } from '../data/songs'
import type { Lesson, LessonLimb, LessonStep, LimbId } from './types'

/** Limb order matches a right-handed kit. Every voice belongs to one limb. */
export const LIMB_OF: { id: LimbId; label: string; short: string; voices: Voice[] }[] = [
  { id: 'lead-hand', label: 'Right hand', short: 'R hand', voices: ['tick', 'open', 'ride', 'rideBell', 'crash1', 'crash2', 'china', 'bell', 'shaker'] },
  { id: 'snare-hand', label: 'Left hand', short: 'L hand', voices: ['back', 'accent', 'tomHi', 'tomMid', 'tomLo'] },
  { id: 'kick-foot', label: 'Right foot', short: 'R foot', voices: ['low'] },
  { id: 'hat-foot', label: 'Left foot', short: 'L foot', voices: ['pedal'] },
]

export const FEET = new Set<Voice>(['low', 'pedal'])

export const VOICE_NAME: Record<Voice, string> = {
  crash1: 'Crash', crash2: 'Crash 2', china: 'China', ride: 'Ride', rideBell: 'Bell', open: 'Open hat',
  tick: 'Hi-hat', pedal: 'Hat foot', tomHi: 'Tom 1', tomMid: 'Tom 2', tomLo: 'Floor', back: 'Snare',
  accent: 'Cross-stick', low: 'Kick', bell: 'Cowbell', shaker: 'Shaker',
}

/** One or two characters drawn in a grid cell. */
export const VOICE_MARK: Record<Voice, string> = {
  low: 'K', back: 'S', accent: 'X', tick: 'H', open: 'O', pedal: 'F', ride: 'R', rideBell: 'B',
  crash1: 'C', crash2: 'C', china: 'Ch', tomHi: 'T', tomMid: 't', tomLo: 'Ft', bell: 'Cb', shaker: 'Sh',
}

const limbByVoice = new Map<Voice, (typeof LIMB_OF)[number]>()
for (const limb of LIMB_OF) for (const v of limb.voices) limbByVoice.set(v, limb)

export const limbOf = (v: Voice) => limbByVoice.get(v) ?? LIMB_OF[0]

/** Subdivision syllables for one beat, index 0 is the beat itself (rendered as the beat number). */
function partials(p: Pattern): string[] {
  const spb = Math.max(1, p.stepsPerBeat || 1)
  const [num, den] = (p.timeSig ?? '4/4').split('/').map(Number)
  const compound = den === 8 && num % 3 === 0 && num > 3
  if (spb === 2) return ['', '&']
  if (spb === 3) return compound ? ['', 'la', 'li'] : ['', 'trip', 'let']
  if (spb === 4) return ['', 'e', '&', 'a']
  if (spb === 6) return compound ? ['', 'ta', 'la', 'ta', 'li', 'ta'] : ['', 'la', 'li', '&', 'la', 'li']
  return Array.from({ length: spb }, (_, i) => (i === 0 ? '' : String(i + 1)))
}

/** One counting syllable per step. Beat starts are "1","2",… and the rest are "e","&","a",…. */
export function syllablesFor(p: Pattern): string[] {
  const spb = Math.max(1, p.stepsPerBeat || 1)
  const part = partials(p)
  const out: string[] = []
  for (let i = 0; i < p.steps; i++) {
    const sub = part[i % spb] ?? ''
    out.push(sub ? sub : String(Math.floor(i / spb) + 1))
  }
  return out
}

export function countPhrase(p: Pattern): string {
  const syl = syllablesFor(p)
  const spb = Math.max(1, p.stepsPerBeat || 1)
  const beat = syl.slice(0, spb).join(' ')
  const beats = Math.ceil(p.steps / spb)
  return beats > 1 ? `Count “${beat}” on each of the ${beats} beats.` : `Count “${beat}”.`
}

/** Hand sticking for one bar. Feet are not in the sticking; they have their own rows. */
export function handSticking(p: Pattern): string[] {
  const lead = new Set(LIMB_OF[0].voices)
  const snare = new Set(LIMB_OF[1].voices)
  return Array.from({ length: p.steps }, (_, i) => {
    let R = false, L = false
    for (const [v, s] of Object.entries(p.tracks) as [Voice, string][]) {
      if (!s?.[i] || s[i] === '.') continue
      if (lead.has(v)) R = true
      if (snare.has(v)) L = true
    }
    return R && L ? 'RL' : R ? 'R' : L ? 'L' : '·'
  })
}

function hitsOn(p: Pattern, v: Voice): number[] {
  const s = p.tracks[v] ?? ''
  const hits: number[] = []
  for (let i = 0; i < s.length; i++) if (s[i] && s[i] !== '.') hits.push(i)
  return hits
}

function where(p: Pattern, i: number): string {
  const spb = Math.max(1, p.stepsPerBeat || 1)
  const syl = syllablesFor(p)[i] ?? ''
  const beat = Math.floor(i / spb) + 1
  return syl === String(beat) ? String(beat) : `${beat}${syl === '&' ? '&' : ' ' + syl}`
}

function describeVoice(p: Pattern, v: Voice): string {
  const hits = hitsOn(p, v)
  const name = VOICE_NAME[v]
  const spb = Math.max(1, p.stepsPerBeat || 1)
  if (!hits.length) {
    if (p.sub?.[v] && Object.keys(p.sub[v]!).length) return `${name} on the in-between notes.`
    return ''
  }
  const ghosts = hits.filter(i => velocityOf(p.tracks[v]?.[i]) <= 0.35)
  if (hits.length === p.steps) return `${name} on every note.`
  if (hits.length === p.steps / spb && hits.every(i => i % spb === 0)) return `${name} on every beat.`
  if (spb === 4 && hits.length === p.steps / 2 && hits.every(i => i % 2 === 0)) return `${name} on the eighth notes.`
  if (spb >= 2 && hits.length * 2 === p.steps && hits.every(i => i % 2 === 1)) return `${name} on the offbeats.`
  const shown = hits.slice(0, 5).map(i => ghosts.includes(i) ? `a ghost on ${where(p, i)}` : where(p, i))
  const tail = hits.length > 5 ? `, and ${hits.length - 5} more` : ''
  return `${name} on ${shown.join(', ')}${tail}.`
}

function voicesIn(bars: Pattern[]): Voice[] {
  const found = new Set<Voice>()
  for (const b of bars) {
    for (const [k, s] of Object.entries(b.tracks)) if (s && /[^.]/.test(s)) found.add(k as Voice)
    for (const k of Object.keys(b.sub ?? {})) found.add(k as Voice)
    for (const k of Object.keys(b.grace ?? {})) found.add(k as Voice)
  }
  return VOICES.filter(v => found.has(v))
}

function mainBar(bars: Pattern[]): Pattern | null {
  if (!bars.length) return null
  const count = new Map<string, { n: number; p: Pattern }>()
  for (const b of bars) {
    const k = JSON.stringify(b.tracks)
    const c = count.get(k)
    if (c) c.n++
    else count.set(k, { n: 1, p: b })
  }
  return [...count.values()].sort((a, b) => b.n - a.n)[0].p
}

const GROUPS: { title: string; first: string; focus: string; voices: Voice[] }[] = [
  { title: 'Add the timekeeping', first: 'Timekeeping', focus: 'The hand that never stops. Make it even before you add anything else.', voices: ['tick', 'ride', 'rideBell', 'shaker'] },
  { title: 'Add the backbeat', first: 'The backbeat', focus: 'Snare hand on 2 and 4, or wherever this part puts it. It answers the count.', voices: ['back', 'accent'] },
  { title: 'Add the kick', first: 'The kick', focus: 'Right foot with the timekeeping hand. Put the foot down on the syllable, not after it.', voices: ['low'] },
  { title: 'Add the hat foot', first: 'The hat foot', focus: 'Left foot chicks or closes the hats. Quieter than the kick.', voices: ['pedal'] },
  { title: 'Add the color', first: 'The color', focus: 'Opens, crashes, and toms. They sit on top of a groove you can already play.', voices: ['open', 'crash1', 'crash2', 'china', 'tomHi', 'tomMid', 'tomLo', 'bell'] },
]

function buildSteps(used: Voice[]): LessonStep[] {
  const have = new Set(used)
  const groups = GROUPS.map(g => ({ ...g, voices: g.voices.filter(v => have.has(v)) })).filter(g => g.voices.length)
  if (!groups.length) return [{ title: 'The whole part', focus: 'Loop it slowly and count out loud.', voices: used, say: 'The whole part. Loop it slowly and count out loud.' }]
  const steps: LessonStep[] = []
  const acc: Voice[] = []
  groups.forEach((g, i) => {
    acc.push(...g.voices)
    const last = i === groups.length - 1
    const title = last && groups.length > 1 ? 'Full part' : i === 0 ? g.first : g.title
    const focus = last && groups.length > 1 ? 'Everything in this section, still slow. When a loop feels easy, add 5%.' : g.focus
    const voices = last ? used : [...acc]
    steps.push({ title, focus, voices, say: `${title}. ${focus}` })
  })
  return steps
}

/** A practice plan read off the transcribed bars. The content agent replaces this per section. */
export function deriveLesson(song: Song, sectionIndex: number): Lesson {
  const section = song.sections[sectionIndex]
  const name = section?.name ?? 'This section'
  const bars = section ? song.bars.slice(section.start, section.start + section.bars) : []
  const bar = mainBar(bars)
  const timeSig = bar?.timeSig ?? section?.timeSig ?? song.raw.timeSig
  const used = voicesIn(bars.length ? bars : bar ? [bar] : [])
  const counting = bar ? syllablesFor(bar) : ['1', 'e', '&', 'a']
  const who = song.raw.drummer ? `${song.raw.drummer}'s` : 'This'
  const limbs: LessonLimb[] = LIMB_OF.map(limb => {
    const voices = limb.voices.filter(v => used.includes(v))
    if (!voices.length) return null
    const summary = bar ? voices.map(v => describeVoice(bar, v)).filter(Boolean).join(' ') : `${limb.label} plays in this section.`
    return { id: limb.id, label: limb.label, short: limb.short, voices, summary: summary || `${limb.label} plays in this section.` }
  }).filter((x): x is LessonLimb => !!x)

  const hasGhost = !!bar && used.some(v => hitsOn(bar, v).some(i => velocityOf(bar.tracks[v]?.[i]) <= 0.35))
  const has16 = !!bar && (bar.stepsPerBeat ?? 1) >= 4
  const kick = bar ? hitsOn(bar, 'low') : []
  const spb = Math.max(1, bar?.stepsPerBeat || 1)
  const syncKick = kick.some(i => i % spb !== 0)
  const hasOpen = used.includes('open')

  const mistakes = [
    { title: 'Speeding up to get it over with', fix: 'A clean slow loop is the rep that sticks. Add 5% only when you could say the count and still land everything.' },
  ]
  if (has16) mistakes.push({ title: 'Rushing the e and the a', fix: 'Say all four syllables. If the “a” crowds the next beat, you are ahead of the click.' })
  if (hasGhost) mistakes.push({ title: 'Ghosts as loud as the backbeat', fix: 'The backbeat is the sentence. Ghost notes are the commas. Keep the stick close to the head.' })
  if (syncKick) mistakes.push({ title: 'Kick landing late', fix: 'Say the syllable out loud and put the foot down on that word, not after the snare.' })
  if (hasOpen) mistakes.push({ title: 'Leaving the hats open', fix: 'The left foot closes the hat on the next note. An open is a short splash of air.' })
  if (mistakes.length < 3) mistakes.push({ title: 'Learning every limb at once', fix: 'Hands only, then feet only, then both. Use the steps and add one limb at a time.' })

  return {
    songId: song.raw.id,
    sectionIndex,
    sectionName: name,
    timeSig,
    overview: `${name} · ${timeSig}. ${who} part, learned one limb at a time. Start with the timekeeping hand, count every subdivision, then add the backbeat and the feet.`,
    counting,
    countPhrase: bar ? countPhrase(bar) : 'Count “1 e & a” on each beat.',
    limbs,
    sticking: bar ? handSticking(bar) : [],
    steps: buildSteps(used),
    mistakes,
    tips: [
      'Count out loud. If you can say it in time, your hands have a place to land.',
      'Loop the bars that fall apart, not the whole song. Fix two bars before you add the next two.',
      'Relax the grip at the slow tempo. Tension you practice slowly is tension you play fast.',
      'Solo a voice to hear it, then mute it and play that limb yourself while the others continue.',
    ],
    tempos: [0.5, 0.6, 0.75, 0.85, 1],
    source: 'derived',
    grid: {
      steps: bar?.steps ?? 16,
      stepsPerBeat: bar?.stepsPerBeat ?? 4,
      ticksPerStep: bar ? ticksPerStep(bar) : 3,
      timeSig,
    },
  }
}
