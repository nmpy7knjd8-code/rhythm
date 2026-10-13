import type { Pattern } from '../engine/types'
import { euclid } from '../engine/pattern'
import { registerPatterns } from './rhythms'

export interface SongRef { id: string; note: string }
export interface Concept {
  id: string; title: string; body: string; listen: string; patterns: Pattern[]
  /** Short key points, shown as a list. */
  points?: string[]
  /** How to count it out loud. */
  count?: string
  /** Songs already in Pulse that show the idea. */
  songs?: SongRef[]
  /** false = the examples are alternatives, so "Play all together" is hidden. */
  combo?: boolean
}

type Opt = Partial<Pattern>
const P = (id: string, name: string, steps: number, stepsPerBeat: number, bpm: number, tracks: Pattern['tracks'], o: Opt = {}): Pattern =>
  ({ id: `th-${id}`, name, steps, stepsPerBeat, suggestedBpm: bpm, tracks, ...o })
const E = (k: number, n: number, r = 0) => euclid(k, n, r).replace(/x/, 'X')
/** n evenly spaced hits across a bar of `beats` quarter-note steps, as sub-step hits (exact tuplets). */
const tuplet = (n: number, beats: number, vel = 0.8, accentFirst = true) => {
  const m: Record<string, [string, number][]> = {}
  for (let k = 0; k < n; k++) { const num = k * beats, step = Math.floor(num / n), rem = num - step * n
    ;(m[String(step)] ??= []).push([`${rem}/${n}`, k === 0 && accentFirst ? 1 : vel]) }
  return m
}

export const THEORY: Concept[] = [
  { id: 'pulse', title: 'Pulse',
    body: 'Pulse is the steady series of equal beats you tap your foot to. It is the first thing a listener pulls out of rhythm, and everything else (meter, syncopation, groove) is heard against it. A pulse can be implied: once it is established, the ear keeps it going through rests and off-beat figures.',
    points: ['A pulse needs only evenly spaced events; they do not have to be loud or even present every time.', 'Drummers usually call it "the time". Keeping it steady is the drummer\'s first job.'],
    listen: 'One sound, evenly spaced. Tap along, then stop it and keep tapping: the pulse continues in your head.',
    patterns: [P('pulse', 'Plain pulse', 4, 1, 90, { low: 'xxxx' }, { ticksPerStep: 12 }),
      P('pulse-gap', 'Two bars on, two bars silent (keep tapping)', 16, 4, 90, { low: 'XxxxXxxx........' }, { ticksPerStep: 12 })],
    combo: false },
  { id: 'tempo', title: 'Tempo',
    body: 'Tempo is the speed of the pulse in beats per minute (BPM): 60 BPM is one beat per second, 120 is two. Slow tempos (60 to 80) tend to read as calm or heavy, 90 to 120 as walking and dancing, and fast tempos (above about 140) as urgent. These are tendencies, not rules. The same pattern changes character with tempo alone.',
    points: ['Change the tempo with the BPM control in the player and listen to the mood shift while the notes stay the same.', 'Songs drift and change tempo; Pulse follows each song\'s tempo map, so the live BPM readout moves during playback.'],
    listen: 'A basic rock beat. Try it at 70, then at 140.',
    songs: [{ id: 'kashmir', note: 'slow and heavy, about 80 BPM' }, { id: 'billiejean', note: 'a steady dance tempo, about 117' }, { id: 'smallthings', note: 'fast pop-punk, about 149' }],
    patterns: [P('tempo', 'Basic beat (try 70 vs 140 BPM)', 8, 2, 100, { low: 'X...X.x.', back: '..X...X.', tick: 'xxxxxxxx' }, { ticksPerStep: 6 })] },
  { id: 'notation', title: 'Note values and drum notation',
    body: 'Rhythm notation names durations by halving: a whole note lasts four beats in 4/4, a half note two, a quarter note one, an eighth note half a beat, a sixteenth a quarter of a beat. Each has a matching rest. A dot adds half the value again (a dotted quarter = 1½ beats), and a tie joins two notes into one longer sound. Drummers mostly care about where each note starts, because a drum hit does not sustain.',
    points: ['On a drum staff, by common convention the bass drum sits in the bottom space, the snare in the third space up, and the hi-hat and cymbals are written with x note heads above the staff. Keys vary between publishers, so check the legend.', 'An accent mark (>) means play louder. A note in parentheses is a ghost note, played very softly.', 'In Pulse\'s grid each square is one subdivision; a bright square is an accent and a dim one is a ghost.'],
    listen: 'Quarters, eighths and sixteenths on one snare, then a dotted-eighth and sixteenth figure.',
    patterns: [
      P('nv-q', 'Quarter notes', 16, 4, 80, { back: 'x...x...x...x...' }),
      P('nv-8', 'Eighth notes', 16, 4, 80, { back: 'x.x.x.x.x.x.x.x.' }),
      P('nv-16', 'Sixteenth notes', 16, 4, 80, { back: 'xxxxxxxxxxxxxxxx' }),
      P('nv-dot', 'Dotted eighth + sixteenth', 16, 4, 80, { back: 'x..xx..xx..xx..x', low: 'X...X...X...X...' }),
    ], combo: false },
  { id: 'subdivision', title: 'Subdivision and counting',
    body: 'Meter is nested: bar, beat, half-beat, quarter-beat. Each level is a pulse the listener can lock onto. Most grooves make one level audible (often eighths or sixteenths on hi-hat or shaker), and that layer acts as the clock. Changing which level is audible changes the energy without changing the tempo. Counting out loud ties each note to a syllable, so you always know where you are.',
    count: 'Eighths: 1 & 2 & 3 & 4 &. Sixteenths: 1 e & a 2 e & a. Eighth-note triplets: 1 trip-let 2 trip-let (or 1-la-li). Sixteenth triplets / sextuplets: 1 la li & la li.',
    points: ['Practise with the counting syllables before the sticks. If you can say it, you can play it.', '"Subdivide" when you play slowly: feel the small notes between the beats, so the beats do not rush.'],
    listen: 'The same tempo throughout. Each layer adds one level. Mute from the top down.',
    songs: [{ id: 'backinblack', note: 'eighth notes on the cymbals as the clock' }, { id: 'funkydrummer', note: 'a sixteenth-note hi-hat feel' }],
    patterns: [
      P('s-beat', 'Level 1: quarter notes (1 2 3 4)', 16, 4, 90, { low: 'X...x...x...x...' }),
      P('s-8', 'Level 2: eighths (1 & 2 &)', 16, 4, 90, { tick: 'x.x.x.x.x.x.x.x.' }),
      P('s-16', 'Level 3: sixteenths (1 e & a)', 16, 4, 90, { shaker: 'gggggggggggggggg' }),
    ] },
  { id: 'meter-basics', title: 'Meter basics',
    body: 'Meter groups pulses into repeating bars with a strong first beat. 2/4 is strong-weak (a march), 3/4 is strong-weak-weak (a waltz), and 4/4 is strong-weak-medium-weak, the default of rock and pop. The top number of a time signature counts beats per bar; the bottom names the note value that gets one beat (4 = quarter note, 8 = eighth note).',
    listen: 'Each one accents beat 1. Count along: 1-2, 1-2-3, 1-2-3-4.',
    songs: [{ id: 'mitchell', note: 'Manic Depression is written in 3/4 in this tab' }, { id: 'backinblack', note: 'plain 4/4' }],
    patterns: [
      P('m-24', '2/4', 2, 1, 100, { low: 'X.', tick: 'xx' }, { timeSig: '2/4', ticksPerStep: 12 }),
      P('m-34', '3/4', 3, 1, 100, { low: 'X..', tick: 'xxx' }, { timeSig: '3/4', ticksPerStep: 12 }),
      P('m-44', '4/4', 4, 1, 100, { low: 'X...', back: '.x.x', tick: 'xxxx' }, { ticksPerStep: 12 }),
    ], combo: false },
  { id: 'compound', title: 'Simple vs compound meter',
    body: 'In simple meter (2/4, 3/4, 4/4) each beat divides in two. In compound meter (6/8, 9/8, 12/8) each beat divides in three, so 6/8 is two beats of three eighths, not six beats, and 12/8 is four dotted-quarter beats. 3/4 and 6/8 both hold six eighths, but 3/4 groups them 2+2+2 and 6/8 groups them 3+3.',
    count: '6/8: 1-la-li 2-la-li. 12/8: 1-la-li 2-la-li 3-la-li 4-la-li.',
    points: ['A tempo marking in compound time usually counts the dotted quarter. Hold the Line\'s tab marks 97 per dotted quarter: 97 felt beats a minute, or 291 eighth notes.', '12/8 is the home of the slow blues and many shuffles: four big beats, each split in three.'],
    listen: 'Six eighths each time. Feel three beats in 3/4 and two in 6/8.',
    songs: [{ id: 'toxicity', note: 'tabbed in 6/8' }, { id: 'holdtheline', note: '12/8, counted in dotted quarters (97)' }, { id: 'fool', note: 'Fool in the Rain is tabbed in 12/8' }],
    patterns: [
      P('c-34', '3/4 (3 beats × 2)', 6, 2, 70, { low: 'X.....', back: '..x.x.', tick: 'xxxxxx' }, { timeSig: '3/4', ticksPerStep: 6 }),
      P('c-68', '6/8 (2 beats × 3)', 6, 3, 70, { low: 'X.....', back: '...X..', tick: 'xxxxxx' }, { ticksPerStep: 6 }),
      P('c-128', '12/8 slow-blues feel (4 beats × 3)', 12, 3, 90, { low: 'X.....X.....', back: '...X.....X..', tick: 'xxxxxxxxxxxx' }, { ticksPerStep: 6, timeSig: '12/8' }),
    ], combo: false },
  { id: 'accent', title: 'Backbeat and accent',
    body: 'An accent can come from loudness (dynamic), length (agogic), pitch or timbre, or position. The backbeat, stress on 2 and 4, is a counter-accent against the metrically strong 1 and 3. That push-pull drives most popular music. Moving accents inside a steady hi-hat line changes the feel completely without adding a single note.',
    points: ['A full-strength backbeat is often a rimshot: stick tip on the head and shaft on the rim together.', 'Accents only work if the unaccented notes stay soft. Practise accent patterns slowly, with two clear volume levels.'],
    listen: 'Compare hats accented on the beat, then off the beat (the disco/house "upbeat" feel), then a moving sixteenth accent.',
    songs: [{ id: 'backinblack', note: 'the plain, heavy 2-and-4 backbeat' }, { id: 'shookme', note: 'the same AC/DC backbeat at a faster tempo' }],
    patterns: [
      P('ac-on', 'Hats accented on the beat', 16, 4, 112, { tick: 'X.x.X.x.X.x.X.x.', low: 'X.......X.......', back: '....X.......X...' }),
      P('ac-off', 'Hats accented off the beat', 16, 4, 112, { tick: 'x.X.x.X.x.X.x.X.', low: 'X...X...X...X...', back: '....X.......X...' }),
      P('ac-16', 'Accent moving through the 16ths (1, e, &, a)', 16, 4, 90, { tick: 'Xggg' + 'gXgg' + 'ggXg' + 'gggX' }),
    ], combo: false },
  { id: 'ghost', title: 'Dynamics and ghost notes',
    body: 'Ghost notes are very soft strokes, usually on the snare, between the main beats. They are felt more than heard: they fill in the subdivision and make a groove breathe. The key is contrast. The backbeat stays loud and the ghosts stay barely audible, played from a low stick height rather than by "trying to be quiet".',
    points: ['Think in two heights: high for accents, an inch or two off the head for ghosts.', 'Ghosts often sit on the "e" and "a" of the beat, or on the middle triplet partial in a shuffle.'],
    listen: 'A plain backbeat, then the same groove with ghost notes. Mute the ghost layer to hear what it adds.',
    songs: [{ id: 'funkydrummer', note: 'the classic ghost-note funk groove' }, { id: 'rosanna', note: 'ghosted triplets in a half-time shuffle' }, { id: 'purdie', note: 'Purdie\'s ghosted shuffle on Home at Last' }],
    patterns: [
      P('gh-base', 'Backbeat groove', 16, 4, 94, { low: 'X.....x...X.....', back: '....X.......X...', tick: 'x.x.x.x.x.x.x.x.' }),
      P('gh-layer', 'Ghost-note layer (snare)', 16, 4, 94, { back: '.g.....g.g....g.' }),
    ] },
  { id: 'rudiments', title: 'Rudiments',
    body: 'Rudiments are the standard sticking patterns of snare drumming. The Percussive Arts Society lists 40 International Drum Rudiments, grouped into rolls, diddles, flams and drags. A handful cover most drumset vocabulary: single strokes (R L R L), doubles (R R L L), the paradiddle (R L R R L R L L), the flam (a soft grace note just before a main stroke) and the drag (two grace notes before the main stroke).',
    points: ['Play them slowly and evenly first; speed comes from relaxed, even strokes.', 'Move a rudiment around the kit and it becomes a groove or a fill. The paradiddle below puts the right hand on the hi-hat and the left on the snare.'],
    listen: 'Each example is one rudiment at a practice tempo. The sticking is in the name.',
    patterns: [
      P('r-single', 'Single strokes (R L R L), accent on each beat', 16, 4, 90, { back: 'Xxxx' + 'Xxxx' + 'Xxxx' + 'Xxxx' }),
      P('r-double', 'Double strokes (R R L L)', 16, 4, 80, { back: 'XxXx' + 'XxXx' + 'XxXx' + 'XxXx' }),
      P('r-para', 'Paradiddle groove (R on hat, L on snare)', 16, 4, 90, { tick: 'X.xx.x..X.xx.x..', back: '.x..x.xx.x..x.xx', low: 'X.......X.......' }),
      P('r-flam', 'Flams on each beat', 16, 4, 80, { back: 'f...f...f...f...' }),
      P('r-drag', 'Drags on 2 and 4', 16, 4, 80, { back: 'x...r...x...r...' }),
      P('r-roll', 'Single-stroke roll in 32nds (one bar)', 16, 4, 70, { back: 'xxxxxxxxxxxxxxxX' }, { sub: { back: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [String(i), [['1/2', 0.7]] as [string, number][]])) } }),
    ], combo: false },
  { id: 'syncopation', title: 'Syncopation',
    body: 'Syncopation is stress where the meter predicts weakness, or silence where it predicts stress: an off-beat accent, a missing downbeat, or an anticipation that arrives a sixteenth early and ties over the beat. Groove studies (Witek et al. 2014, PLOS ONE) found that a moderate amount of syncopation produced the strongest urge to move.',
    points: ['Leaving beat 1 empty is a strong syncopation. Reggae\'s one-drop puts the kick and snare together on beat 3 instead.', 'An "anticipation" plays the note just before the beat and lets it ring through it.'],
    listen: 'The straight beat, then the same beat with an anticipated kick.',
    songs: [{ id: 'moon', note: 'Walking on the Moon leaves beat 1 empty, reggae-style' }],
    patterns: [
      P('sy-base', 'Straight beat', 16, 4, 96, { low: 'X.......X.......', back: '....X.......X...' }),
      P('sy-antic', 'Anticipated kick (syncopated)', 16, 4, 96, { low: 'X......x..x.....', back: '....X.......X...', tick: 'x.x.x.x.x.x.x.x.' }),
    ], combo: false },
  { id: 'displacement', title: 'Rhythmic displacement',
    body: 'Displacement takes a whole figure and shifts it by a fixed amount, for example one sixteenth or one eighth. Every note keeps its relation to the others, but none sits where it used to, so a familiar beat suddenly sounds inside-out. Drummers use it in fills and solos to create tension against a steady pulse.',
    points: ['Start with something simple, such as a plain backbeat, and shift it by an eighth, then by a sixteenth.', 'Keep a reference going (hi-hat on quarters, or a foot) so the shift is heard against the pulse.'],
    listen: 'Play the straight beat with the quarter-note hi-hat, then swap to the displaced version.',
    patterns: [
      P('dp-ref', 'Reference: quarter-note hi-hat', 16, 4, 96, { pedal: 'x...x...x...x...' }),
      P('sy-disp', 'Beat displaced one 16th later', 16, 4, 96, { low: '.X.......X......', back: '.....X.......X..' }),
      P('dp-8', 'Beat displaced one 8th later', 16, 4, 96, { low: '..X.......X.....', back: '......X.......X.' }),
    ], combo: false },
  { id: 'swing', title: 'Swing and shuffle',
    body: 'Swing lengthens the first note of each pair and shortens the second. 1:1 is straight, 2:1 is "triplet" swing (the first two notes of a triplet tied), and 3:1 is dotted. Measured jazz swing ratios change with tempo: wide at slow tempos and near straight at fast ones (Friberg & Sundström 2002). A shuffle is a groove built on that long-short swing, usually on the hi-hat or ride, with the snare on the backbeat. A half-time shuffle puts the backbeat on 3 and fills the triplet partials with ghost notes.',
    count: 'Swing eighths: 1 (trip) let 2 (trip) let: say the triplet, play only the first and last.',
    points: ['"Microtiming" means small deliberate deviations, such as a laid-back snare. Whether it adds groove is debated: Davies et al. (2013, Music Perception) found added deviations generally lowered groove ratings, and Senn et al. (2016) found quantised and original expert timing rated about equally.', 'Pulse plays each style with its own natural swing amount, and songs exactly as transcribed.'],
    listen: 'Straight eighths, then triplet swing, then a shuffle and a half-time shuffle.',
    songs: [{ id: 'singsing', note: 'big-band swing' }, { id: 'rosanna', note: 'the half-time shuffle' }, { id: 'fool', note: 'Bonham\'s half-time shuffle' }, { id: 'purdie', note: 'the Purdie shuffle' }],
    patterns: [
      P('sw-straight', 'Straight eighths (1:1)', 8, 2, 100, { tick: 'xxxxxxxx', low: 'X...X...', back: '..X...X.' }),
      P('sw-trip', 'Triplet swing eighths (2:1)', 12, 3, 100, { tick: 'x.xx.xx.xx.x', low: 'X.....X.....', back: '...X.....X..' }),
      P('sw-shuffle', 'Shuffle', 12, 3, 100, { tick: 'X.xX.xX.xX.x', low: 'X..x..X..x..', back: '...X.....X..' }),
      P('sw-half', 'Half-time shuffle with ghost notes', 12, 3, 80, { tick: 'x.xx.xx.xx.x', low: 'X........x.x', back: '.gg.g.Xg.gg.' }),
      P('sw', 'Swing test: 16th hats and backbeat (natural swing)', 16, 4, 92, { tick: 'xxxxxxxxxxxxxxxx', low: 'X.....x...X.....', back: '....X.......X...' }, { swingable: true, suggestedSwing: 0.33 }),
    ], combo: false },
  { id: 'halftime', title: 'Half-time and double-time feel',
    body: 'Half-time and double-time change where the backbeat falls while the tempo stays put. In half-time the snare moves from 2 and 4 to beat 3 only, so the groove feels twice as slow. In double-time it lands on every "&", so it feels twice as fast. The band\'s tempo, the hi-hat and the chords do not have to change at all.',
    listen: 'The same tempo, three feels. Swap between them.',
    songs: [{ id: 'africa', note: 'Porcaro described the groove as half-time: backbeat on 3' }, { id: 'rosanna', note: 'a half-time shuffle' }],
    patterns: [
      P('ht-normal', 'Normal: snare on 2 and 4', 16, 4, 100, { tick: 'x.x.x.x.x.x.x.x.', low: 'X.......X.......', back: '....X.......X...' }),
      P('ht-half', 'Half-time: snare on 3', 16, 4, 100, { tick: 'x.x.x.x.x.x.x.x.', low: 'X.........X.....', back: '........X.......' }),
      P('ht-double', 'Double-time: snare on every "&"', 16, 4, 100, { tick: 'x.x.x.x.x.x.x.x.', low: 'X...X...X...X...', back: '..X...X...X...X.' }),
    ], combo: false },
  { id: 'tuplets', title: 'Tuplets',
    body: 'A tuplet squeezes a different number of equal notes into a span: three in the time of two (triplets), five in the time of four (quintuplets), six in the time of four (sextuplets). They are written with a bracket and a number. Quarter-note triplets (three across two beats) are a classic way to make a fill or a groove float over the bar line.',
    count: 'Triplets: 1-trip-let. Quintuplets: say a five-syllable word per beat ("u-ni-ver-si-ty"). Quarter-note triplets: put three even notes across "1 & 2 &".',
    points: ['Pulse plays tuplets at exact positions, not rounded to the nearest grid line.'],
    listen: 'Keep the quarter-note kick going and play each tuplet over it.',
    patterns: [
      P('tu-ref', 'Reference: quarter notes', 4, 1, 72, { low: 'Xxxx' }, { ticksPerStep: 12 }),
      P('tu-3', 'Eighth-note triplets (3 per beat)', 12, 3, 72, { back: 'Xxxxxxxxxxxx' }),
      P('tu-q3', 'Quarter-note triplets (3 per 2 beats)', 12, 3, 72, { back: 'X.x.x.X.x.x.' }),
      P('tu-5', 'Quintuplets (5 per beat)', 4, 1, 60, {}, { ticksPerStep: 12, sub: { back: Object.fromEntries([0, 1, 2, 3].map(b => [String(b), [0, 1, 2, 3, 4].map(k => [`${k}/5`, k === 0 ? 1 : 0.7] as [string, number])])) } }),
      P('tu-6', 'Sextuplets (6 per beat)', 24, 6, 60, { back: 'Xxxxxx'.repeat(4) }),
    ], combo: false },
  { id: 'hypermeter', title: 'Phrasing, fills and hypermeter',
    body: 'Bars group into larger units of 2, 4 or 8 bars, the same way beats group into bars. This is hypermeter (Lerdahl & Jackendoff 1983; Rothstein 1989). Drummers mark it with a crash on the first bar of a phrase and a fill in the last. A fill in bar 4 marks the end of a phrase. A fill in bar 3 sounds "early" because it cuts across the phrase.',
    points: ['Count phrases as well as bars: "1 2 3 4, 2 2 3 4, 3 2 3 4, 4 2 3 4".', 'A fill usually resolves with a crash and kick on the next downbeat.'],
    listen: 'A four-bar phrase: crash in bar 1, a lift in bar 3, a fill in bar 4.',
    songs: [{ id: 'tomsawyer', note: 'Peart\'s fills mark the song\'s sections' }],
    patterns: [
      P('hm', '4-bar phrase', 64, 4, 104, {
        low: 'X.......X.x.....'.repeat(3) + 'X...........X.X.',
        back: '....X.......X...'.repeat(3) + 'XxXx............',
        tick: 'x.x.x.x.x.x.x.x.'.repeat(2) + 'xxxxxxxxxxxxxxxx' + '................',
        crash1: 'X' + '.'.repeat(63),
        tomHi: '.'.repeat(48) + '....XxXx........',
        tomLo: '.'.repeat(48) + '........XxXxX.X.' }, { ticksPerStep: 3 }),
    ] },
  { id: 'tension', title: 'Tension and release',
    body: 'Rhythmic tension builds from rising density, from syncopation that delays resolution, from cross-rhythm, and from withholding the downbeat. Release is the return of a strong, confirmed beat one. Huron\'s ITPRA theory of expectation (Sweet Anticipation, 2006) explains why the build-up matters: the more confidently we predict the arrival, the more satisfying it is when it lands.',
    listen: 'Two bars: a snare build in doubling subdivisions, then a full downbeat release.',
    patterns: [
      P('tr', 'Build → release', 32, 4, 110, {
        back: 'X...X...X.X.XXXX' + '................',
        low: 'X...X...X...X...' + 'X.......X.......',
        tick: '................' + 'x.x.x.x.x.x.x.x.',
        crash1: '................' + 'X...............' }, { ticksPerStep: 3 }),
    ] },
  { id: 'euclid', title: 'Timelines, clave and Euclidean rhythms',
    body: 'A timeline is a short, repeating, usually asymmetric pattern (often on a bell or clave) that orients every other part. Godfried Toussaint (2005, "The Euclidean Algorithm Generates Traditional Musical Rhythms") showed that many timelines spread k strokes as evenly as possible over n pulses. E(3,8) is the tresillo, E(5,8) the Cuban cinquillo, and E(7,12) the West African standard bell pattern. These patterns are generated in code here by the same algorithm.',
    points: ['Son clave is the tresillo (3 side) followed by two strokes (2 side): 3-2 clave. Reversing the halves gives 2-3.'],
    listen: 'Each is computed live with euclid(k, n), plus a 3-2 son clave.',
    patterns: [
      P('e38', 'E(3,8) tresillo', 8, 2, 100, { accent: E(3, 8), low: 'X...X...' }),
      P('e58', 'E(5,8) cinquillo', 8, 2, 100, { accent: E(5, 8), low: 'X...X...' }),
      P('e712', 'E(7,12) standard bell', 12, 3, 100, { bell: E(7, 12, 0), low: 'X..x..X..x..' }),
      P('e516', 'E(5,16) bossa-like', 16, 4, 110, { accent: E(5, 16), tick: 'x.x.x.x.x.x.x.x.' }),
      P('clave32', 'Son clave 3-2 (two bars)', 32, 4, 100, { accent: 'X..X..X.........' + '....X...X.......' }, { ticksPerStep: 3 }),
    ], combo: false },
  { id: 'bell', title: 'Cross-rhythm in African bell patterns',
    body: 'In many West and Central African and Afro-Cuban traditions, the bell timeline is heard against a four-beat dance pulse (dotted quarters in 12/8) and a three-beat or six-beat counter-pulse at once. Kofi Agawu ("Structural Analysis or Cultural Analysis? Competing Perspectives on the \'Standard Pattern\' of West African Rhythm," JAMS 59/1, 2006; The African Imagination in Music, Oxford, 2016) emphasises that the dancers\' feet supply the beat that outsiders often miss. David Locke\'s work on Ewe music (Drum Gahu, 1987; his critical edition of Agbadza) documents the 2+2+1+2+2+2+1 bell phrase and shows how parts are heard relative to the bell, not relative to bar lines.',
    listen: 'Load the bell, then add the 4-pulse, then the 3-pulse. Try hearing the bell against each in turn.',
    patterns: [
      P('b-bell', 'Standard bell (12/8)', 12, 3, 100, { bell: 'X.x.xx.x.x.x' }),
      P('b-4', 'Dance pulse: 4 beats', 12, 3, 100, { low: 'X..x..X..x..' }),
      P('b-3', 'Counter-pulse: 3 beats', 12, 3, 100, { tomHi: 'x...x...x...' }),
    ] },
  { id: 'tala', title: 'Tala and iqā\'āt',
    body: 'Indian tala is a cyclic time framework marked by claps and waves. Tīntāl has 16 beats (4+4+4+4) and Rūpak 7 beats (3+2+2; in Hindustani practice it begins on the khālī, the "empty" or waved section). The return to sam, beat one, is the cycle\'s goal. Arabic iqā\'āt are rhythmic modes built from dum (low, centre of the drum) and tak (high, rim). Maqsūm (8 beats) and Sammāʿī Thaqīl (10/8) are common examples. The renderings here are simplified skeletons: real theka and iqā\' are elaborated freely.',
    listen: 'Low voice = dum / bayan, high voice = tak / dayan.',
    patterns: [
      P('t-rupak', 'Rūpak tāl (7: 3+2+2)', 7, 7, 160, { tomHi: 'x.xX.X.', low: '...X.X.', accent: 'X......' }, { ticksPerStep: 12 }),
      P('t-tin', 'Tīntāl skeleton (16: 4+4+4+4)', 16, 4, 240, { low: 'X...x.......x...', tomHi: 'xxxxxxxx....xxxx', accent: 'X...X.......X...' }, { ticksPerStep: 12 }),
      P('i-maqsum', 'Maqsūm (dum tak-tak dum tak)', 16, 4, 100, { low: 'X.......X.......', back: '..x.x.....x.x...' }),
      P('i-samai', 'Sammāʿī Thaqīl (10/8)', 10, 10, 120, { low: 'X.....X.X.', back: '...x.....x' }, { ticksPerStep: 6 }),
    ], combo: false },
  { id: 'poly', title: 'Polyrhythm vs. polymeter',
    body: 'A polyrhythm divides the same time span in two ways at once: 3 against 2 in one bar, with both parts realigning every bar. A polymeter runs cycles of different lengths over a shared pulse: a 3-beat figure over a 4-beat bar realigns only every 12 beats. In short, polyrhythm means different note speeds in the same span, and polymeter means different cycle lengths at the same note speed.',
    count: '3:2 on a 6-pulse grid: count 1 2 3 4 5 6; the two-part plays on 1 and 4, the three-part on 1, 3 and 5. 4:3 on a 12-pulse grid: one part every 3 pulses, the other every 4.',
    points: ['Learn a polyrhythm by finding the smallest shared grid (6 pulses for 3:2, 12 for 4:3, 20 for 5:4).', 'Pulse plays each voice of a polyrhythm at exact positions, so 5:4 is truly five even notes across four beats.'],
    listen: 'Polyrhythms first, then the polymeter: load the 4/4 beat, layer the 3-beat cycle and hear the accent walk across the bar.',
    songs: [{ id: 'kashmir', note: 'a riff in 3 over Bonham\'s 4 (polymeter)' }],
    patterns: [
      P('pr-32', 'Polyrhythm 3:2 in one bar', 12, 6, 80, { low: 'X.....X.....', bell: 'X...X...X...' }),
      P('pr-43', 'Polyrhythm 4:3 (4 over 3 beats)', 12, 4, 70, { low: 'X...X...X...', bell: 'X..X..X..X..' }, { ticksPerStep: 3, timeSig: '3/4' }),
      P('pr-54', 'Polyrhythm 5:4 (5 over 4 beats)', 4, 1, 60, { low: 'Xxxx' }, { ticksPerStep: 12, sub: { bell: tuplet(5, 4) } }),
      P('pm-44', 'Polymeter base: 4/4', 16, 4, 104, { low: 'X.......X.......', back: '....X.......X...' }),
      P('pm-34', 'Polymeter layer: 3-beat cycle', 12, 4, 104, { bell: 'X...x...x...', tick: 'x.x.x.x.x.x.' }, { ticksPerStep: 3 }),
    ], combo: false },
  { id: 'hemiola', title: 'Hemiola',
    body: 'Hemiola regroups six pulses from 2×3 into 3×2 (or the reverse), for example two bars of 3/4 heard as one bar of 3/2. It is a specific, local 3:2 reinterpretation, common in Baroque cadences, Brahms, flamenco and Latin-American son jarocho, where the alternation is part of the meter.',
    listen: 'The kick marks two bars of 3/4. Layer the accents, which group the same span as three half notes (3/2). Mute each to flip between the two hearings.',
    patterns: [
      P('h-34', 'Two bars of 3/4', 12, 6, 90, { low: 'X.....X.....', tick: 'x.x.x.x.x.x.' }, { ticksPerStep: 6 }),
      P('h-32', 'Hemiola accent layer (3/2 feel)', 12, 6, 90, { accent: 'X...X...X...' }, { ticksPerStep: 6 }),
    ] },
  { id: 'modulation', title: 'Metric modulation',
    body: 'Metric modulation (a term associated with Elliott Carter) makes a subdivision of the old tempo the beat of the new one. The arithmetic is simple: new tempo = old tempo × (old notes per beat ÷ notes per new beat). If a dotted eighth becomes the new quarter note, the tempo appears to slow to ¾ of the original (100 → 75). If an eighth-note triplet becomes the new eighth, it speeds up by 3/2 (100 → 150). Drummers often use "implied" metric modulation: the groove seems to change tempo while the band stays put.',
    points: ['Keep the old pulse in your head (or in your foot) while you play the new one; that is what makes it feel like a modulation rather than a mistake.'],
    listen: 'Two bars: a normal backbeat, then the same beat on a dotted-eighth grid. The second bar feels slower and sits "over" the first.',
    patterns: [
      P('mm', 'Backbeat → dotted-8th implied tempo', 32, 4, 100, { low: 'X.......X.......X.....X.....X...', back: '....X.......X......X.....X.....X', tick: 'x.x.x.x.x.x.x.x.x..x..x..x..x..x' }, { ticksPerStep: 3 }),
    ] },
  { id: 'meter', title: 'Meter: simple, compound, additive',
    body: 'Meter is the repeating pattern of strong and weak beats we infer from the music. In simple meter (2/4, 3/4, 4/4) each beat divides in two. In compound meter (6/8, 12/8) each beat divides in three, so 6/8 is two beats of three eighths, not six beats. Additive or "odd" meters build the bar from unequal groups of 2s and 3s: 7/8 as 2+2+3, and Balkan aksak meters such as 9/8 = 2+2+2+3 (aksak is Turkish for "limping"). The unequal beat lengths are what make them feel lopsided but danceable.',
    count: '7/8 (2+2+3): 1-2 1-2 1-2-3. 9/8 aksak (2+2+2+3): 1-2 1-2 1-2 1-2-3. 5/4 (3+2): 1-2-3 4-5.',
    points: ['Find the grouping first (where the long beat falls), then the bar feels like a lopsided dance rather than a math problem.'],
    listen: 'Play the three in turn. Count the long beat in 7/8 and 9/8: it is the group of three.',
    songs: [{ id: 'schism', note: 'the main riff alternates 5/8 and 7/8' }, { id: 'lateralus', note: 'chorus cycles 9/8, 8/8, 7/8' }, { id: 'tomsawyer', note: 'a 7/8 instrumental section' }, { id: '4646', note: 'a drum section in 7/8' }, { id: 'whiplash', note: '7/4 throughout, mostly 2+2+2+2+3+3' }],
    patterns: [
      P('m-68', '6/8 compound (2 beats × 3)', 6, 3, 70, { low: 'X.....', back: '...X..', tick: 'xxxxxx' }, { ticksPerStep: 6 }),
      P('m-78', '7/8 as 2+2+3', 7, 7, 180, { low: 'X.x.X..', back: '..X....', tick: 'xxxxxxx' }, { ticksPerStep: 6 }),
      P('m-98', '9/8 aksak 2+2+2+3', 9, 9, 200, { low: 'X.x.x.X..', back: '..X...X..', tick: 'xxxxxxxxx' }, { ticksPerStep: 6 }),
    ] }
]
registerPatterns(THEORY.flatMap(c => c.patterns))
