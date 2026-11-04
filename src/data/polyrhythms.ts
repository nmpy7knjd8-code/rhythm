import type { Pattern } from '../engine/types'

/** Where a claim comes from. Each is a page that cites the original scholarship. */
export const POLY_SOURCES = {
  poly: { label: 'Wikipedia: Polyrhythm (citing Peñalosa 2009, Novotney 1998, Agawu, Ladzekpo)', url: 'https://en.wikipedia.org/wiki/Polyrhythm' },
  cross: { label: 'Wikipedia: Cross-beat (citing Peñalosa, The Clave Matrix 2009)', url: 'https://en.wikipedia.org/wiki/Cross-beat' },
  hemiola: { label: 'Wikipedia: Hemiola (citing Grove, New Harvard Dictionary, Manuel)', url: 'https://en.wikipedia.org/wiki/Hemiola' },
  bell: { label: 'Wikipedia: Bell pattern (citing Kubik, Novotney, Agawu, Toussaint)', url: 'https://en.wikipedia.org/wiki/Bell_pattern' },
  fantaisie: { label: 'Wikipedia: Fantaisie-Impromptu', url: 'https://en.wikipedia.org/wiki/Fantaisie-Impromptu' },
  intervals: { label: 'Wikipedia: List of pitch intervals', url: 'https://en.wikipedia.org/wiki/List_of_pitch_intervals' },
} as const
export type PolySource = keyof typeof POLY_SOURCES

export interface PolyExample { text: string; source: PolySource }
export interface Poly {
  id: string
  name: string
  /** a cross notes in the time of b pulse beats; named forms use their own grid */
  a: number; b: number
  featured: boolean
  named: boolean
  aka?: string
  /** one or two words: the feel */
  feel: string
  about: string
  /** true when the feel text is a general description of the ratio's shape, not taken from a source */
  generic: boolean
  uses: PolyExample[]
  /** the same ratio as a pitch interval (harmonic polyrhythm) */
  interval?: string
  /** steps in one cycle, and the two layers on that grid */
  steps: number; cross: string; pulse: string
  /** grid ticks per step (12 per quarter at the engine tempo) */
  tps: number
  /** pulse beats per minute to start at */
  start: number
}

const gcd = (x: number, y: number): number => (y ? gcd(y, x % y) : x)

/** Just-intonation interval for each ratio (List of pitch intervals); compound ratios are an octave (or two) above the simple one. */
const INTERVAL: Record<string, string> = {
  '3:2': 'perfect fifth', '4:3': 'perfect fourth', '5:4': 'major third', '6:5': 'minor third', '5:3': 'major sixth', '8:5': 'minor sixth',
  '9:8': 'major whole tone', '8:7': 'septimal whole tone', '7:6': 'septimal minor third', '9:7': 'septimal major third', '7:5': 'septimal tritone',
  '7:4': 'harmonic seventh', '9:5': 'just minor seventh',
  '5:2': 'major third plus an octave', '7:2': 'harmonic seventh plus an octave', '7:3': 'septimal minor third plus an octave',
  '8:3': 'perfect fourth plus an octave', '9:4': 'major whole tone plus an octave', '9:2': 'major whole tone plus two octaves',
}

interface Known { feel: string; about: string; aka?: string; featured?: boolean; uses: PolyExample[]; /** the feel text describes the ratio's shape; only the examples are sourced */ structural?: boolean }
const P = (text: string, source: PolySource = 'poly'): PolyExample => ({ text, source })
/** Ratios with sourced descriptions and real examples. Key = cross:pulse. */
const KNOWN: Record<string, Known> = {
  '3:2': { featured: true, feel: 'Interlocked', aka: 'vertical hemiola, sesquialtera',
    about: 'Three even notes against two beats. Agawu: "2 and 3 belong to a single Gestalt." Novotney calls 3:2 the foundation of most polyrhythmic textures in West African music.',
    uses: [P('West African drumming, gyil (xylophone) and mbira, e.g. the mbira piece "Nhema Mussasa"'), P('Mongo Santamaría, "Afro Blue" (1959): the bass plays 6 against 4, two cycles of 3:2'),
      P('Brahms, Violin Sonata Op. 78: 3+3 and 2+2+2 superimposed'), P('Peter Magadini, "Doin\' Time and a Half" (6 over 4)'), P('Jazz: the quarter-note triplet')] },
  '2:3': { featured: true, feel: 'Swaying', aka: 'hemiola (two over three)',
    about: 'Two even notes across three beats. In a 3/4 bar it pulls the ear toward 6/8: of Beethoven\'s String Quartet No. 6 scherzo, Ernest Walker wrote it "does its best to persuade us that it is really in 6/8."',
    uses: [P('Elvin Jones: two cross-beats over a 3/4 jazz waltz, "perhaps the most common example of overt cross-rhythm in jazz"'), P('John Coltrane, "Afro Blue" (1963), with Elvin Jones'),
      P('Megadeth, "Sleepwalker" and the ending of "My Last Words"'), P('Leontovych, "Carol of the Bells": the ostinato is the composite of two against three'), P('Peter Magadini, "Midnight Bolero"')] },
  '4:3': { featured: true, feel: 'Rotating',
    about: 'Four cross-beats cycling every three beats. Inside a four-beat bar it "significantly contradicts the period" (Peñalosa). Tresillo is its first three cross-beats.',
    uses: [P('Cuban rumba and conga: continuous cross-beats on the quinto (lead drum)', 'cross'), P('Jazz: dotted eighths against quarters, rare before Tony Williams played it with Miles Davis'),
      P('Chopin, Fantaisie-Impromptu: sixteenths against triplets', 'fantaisie'), P('Britney Spears, "Till the World Ends" (hook)'), P('The National, "Fake Empire"'), P('Peter Magadini, "Midnight Bolero"')] },
  '3:4': { featured: true, feel: 'Destabilizing',
    about: 'Three slow cross-beats over four beats: "more metrically destabilizing and dynamic" than six cross-beats (Peñalosa).',
    uses: [P('Afro-Cuban abakuá (Havana style) is based on it', 'cross'), P('Willie Bobo\'s abakuá bell on Santamaría\'s "Afro Blue" and Herbie Hancock\'s "Succotash"', 'cross'), P('Peter Magadini, "Samba de Rollins" (drum solo on 3 over 4)')] },
  '3:8': { feel: 'Contradictive',
    about: 'Three very slow cross-beats across eight beats (two bars of four): "one of the most metrically contradictive, and extraordinarily dynamic cross-rhythms found in African music."',
    uses: [P('Ewe rhythm kadodo: the bell embellishes three slow cross-beats', 'bell'), P('Afro-Cuban arará rhythm afrekete, same bell pattern', 'bell')] },
  '5:4': { featured: true, structural: true, feel: 'Drifting', about: 'Five even notes against four beats: neighbouring counts slip a little on every beat and meet only on the one, every 20 subdivisions.',
    uses: [P('Peter Magadini, "Five For Barbara" (a 4/4 section with 5 over 4)'), P('Sky Signals, "Amaterasu" (built around 5:4)')] },
  '4:7': { structural: true, feel: 'Floating', about: 'Four long notes stretched across seven beats.', uses: [P('Peter Magadini, "Seventy Fourth Ave" (in 7/4, with 4 over the 7)')] },
  '7:8': { structural: true, feel: 'Drifting', about: 'Seven against eight: neighbouring counts slip a little on every beat and meet only on the one.',
    uses: [P('Grieg, Piano Concerto, cadenza: seven notes a beat in the left hand against eight in the right'), P('Classical Indian musicians can play 7 against 8 intuitively')] },
  '8:7': { structural: true, feel: 'Drifting', about: 'Eight against seven: neighbouring counts slip a little on every beat and meet only on the one.',
    uses: [P('Grieg, Piano Concerto, cadenza: eight notes a beat in the right hand against seven in the left')] },
}

/** A general description from the ratio's shape alone, for ratios no source describes. */
function generic(a: number, b: number) {
  const dense = a * b >= 40 ? ` The cycle is long (${a * b} subdivisions), so it tends to be heard as texture rather than a pattern.` : ''
  if (Math.abs(a - b) === 1) return { feel: 'Drifting', about: `Neighbouring counts: the ${a} notes slip a little against the ${b} beats on every beat and meet only on the one.${dense}` }
  if (a > b) return { feel: 'Crowding', about: `More notes than beats: ${a} even notes crowd into ${b} beats, so the cross layer runs ahead of the pulse.${dense}` }
  return { feel: 'Floating', about: `Fewer notes than beats: ${a} long notes stretch across ${b} beats and float over the pulse.${dense}` }
}

/** Ticks per step so one cycle sits near the engine tempo. */
const tpsFor = (a: number) => Math.ceil(12 / a)

function ratio(a: number, b: number): Poly {
  const key = `${a}:${b}`, k = KNOWN[key], g = generic(a, b), steps = a * b
  const row = (every: number) => Array.from({ length: steps }, (_, i) => (i % every ? '.' : i ? 'x' : 'X')).join('')
  const iv = INTERVAL[a > b ? key : `${b}:${a}`]
  return {
    id: `poly-${a}-${b}`, name: `${a} against ${b}`, a, b, featured: !!k?.featured, named: false, aka: k?.aka,
    feel: k?.feel ?? g.feel, about: k?.about ?? g.about, generic: !k || !!k.structural, uses: k?.uses ?? [], interval: iv,
    steps, cross: row(b), pulse: row(a), tps: tpsFor(a), start: a * b > 30 ? 50 : a * b > 12 ? 60 : 80,
  }
}

const NAMED: Poly[] = [
  { id: 'poly-standard-bell', name: 'Standard bell pattern (12/8)', a: 7, b: 4, featured: true, named: true, aka: 'bembé, the "6/8 bell"',
    feel: 'Asymmetric, cyclic', generic: false, steps: 12, tps: 4, start: 100,
    cross: 'X.x.xx.x.x.x', pulse: 'X..x..x..x..',
    about: 'The seven-stroke bell over four dotted-quarter main beats, the most common key pattern in sub-Saharan Africa. The main beats are usually in the dancers\' steps, not the bell, so outsiders often feel the beat in the wrong place.',
    uses: [P('Ewe music (Ghana), with the axatse gourd part', 'bell'), P('Afro-Cuban bembé, palo, iyesá, arará and the rumba columbia', 'bell'), P('Haitian vodou rhythms (yanvalú, nagó)', 'bell')] },
  { id: 'poly-horizontal-hemiola', name: 'Horizontal hemiola (6/8 into 3/4)', a: 5, b: 4, featured: true, named: true, aka: 'sesquialtera, 3+3+2+2+2',
    feel: 'Tipping', generic: false, steps: 12, tps: 4, start: 100,
    cross: 'X..x..x.x.x.', pulse: 'X..x..x..x..',
    about: 'Hemiola in time rather than at once: a 6/8 bar (3+3) followed by a 3/4 bar (2+2+2), so the beat tips from two to three. Not a polyrhythm in the strict sense, listed here because the 3:2 entries are its vertical form.',
    uses: [P('Spanish and Latin American music, e.g. flamenco soleá (Peter Manuel)', 'hemiola'), P('Bell pattern of the Hausa (Nigeria), Haitian vodou and Cuban palo', 'hemiola'),
      P('Leonard Bernstein, "America" from West Side Story', 'hemiola'), P('Baroque courante and minuet, e.g. the minuet of Bach\'s Partita No. 5', 'hemiola'), P('Tchaikovsky\'s waltzes', 'hemiola')] },
]

const RATIOS: Poly[] = []
for (let a = 2; a <= 9; a++) for (let b = 2; b <= 9; b++) if (a !== b && gcd(a, b) === 1) RATIOS.push(ratio(a, b))

/** Named forms first, then featured ratios, then the rest by size of cycle. */
export const POLYRHYTHMS: Poly[] = [...NAMED, ...RATIOS.filter(p => p.featured), ...RATIOS.filter(p => !p.featured).sort((x, y) => x.a * x.b - y.a * y.b || x.a - y.a)]

/** Engine tempo (quarter BPM at 12 ticks a quarter) that puts the pulse layer at `pulseBpm`. */
export function engineBpm(p: Poly, pulseBpm: number) {
  const pulseSteps = p.steps / (p.pulse.match(/[xX]/g)!.length)
  return (pulseSteps * p.tps * pulseBpm) / 12
}

/** One looping bar for the song engine: cross on the cowbell, pulse on the kick. */
export function polyBar(p: Poly, pulseBpm: number): Pattern {
  return { id: p.id, name: p.name, steps: p.steps, stepsPerBeat: p.steps / (p.pulse.match(/[xX]/g)!.length), ticksPerStep: p.tps,
    tracks: { bell: p.cross, low: p.pulse }, suggestedBpm: engineBpm(p, pulseBpm) }
}

/** Spoken count for one layer: '1', '2', … on each of its notes. */
export function polyCount(p: Poly, layer: 'cross' | 'pulse'): string[] {
  let n = 0
  return [...p[layer]].map(c => (c === '.' ? '' : String(++n)))
}
