import type { Pattern } from '../engine/types'
import { euclid } from '../engine/pattern'
import { registerPatterns } from './rhythms'

export interface Concept { id: string; title: string; body: string; listen: string; patterns: Pattern[] }

type Opt = Partial<Pattern>
const P = (id: string, name: string, steps: number, stepsPerBeat: number, bpm: number, tracks: Pattern['tracks'], o: Opt = {}): Pattern =>
  ({ id: `th-${id}`, name, steps, stepsPerBeat, suggestedBpm: bpm, tracks, ...o })
const E = (k: number, n: number, r = 0) => euclid(k, n, r).replace(/x/, 'X')

export const THEORY: Concept[] = [
  { id: 'pulse', title: 'Pulse',
    body: 'Pulse is the steady series of equal beats you tap your foot to. It is the first thing a listener extracts from rhythm, and everything else (meter, syncopation, groove) is heard against it. A pulse can be implied: once established, the ear keeps it going through rests and off-beat figures.',
    listen: 'One sound, evenly spaced. Tap along, then stop it and keep tapping: the pulse continues in your head.',
    patterns: [P('pulse', 'Plain pulse', 4, 1, 90, { low: 'xxxx' }, { ticksPerStep: 12 })] },
  { id: 'tempo', title: 'Tempo',
    body: 'Tempo is the speed of the pulse, in beats per minute (BPM). Around 60 to 80 BPM reads as calm or heavy, 90 to 120 as walking and dancing, and above about 140 as urgent. The same pattern changes character with tempo alone; try the one below at 70 and then 140 with the Sound tab slider.',
    listen: 'A basic rock beat. Move the tempo slider and notice how mood changes while the notes stay the same.',
    patterns: [P('tempo', 'Basic beat (try 70 vs 140 BPM)', 8, 2, 100, { low: 'X...X.x.', back: '..X...X.', tick: 'xxxxxxxx' }, { ticksPerStep: 6 })] },
  { id: 'subdivision', title: 'The subdivision hierarchy',
    body: 'Meter is nested: bar → beat → half-beat → quarter-beat. Each level is a pulse the listener can lock onto. Most grooves have one prominent level (often eighths or sixteenths, played on hats or shaker) that acts as the clock. Others are implied. Changing which level is audible changes the perceived energy without changing the tempo.',
    listen: 'The same tempo throughout. Play each level in turn: same tempo, a faster clock each time.',
    patterns: [
      P('s-beat', 'Level 1: quarter notes', 16, 4, 90, { low: 'X...x...x...x...' }),
      P('s-8', 'Level 2: eighths', 16, 4, 90, { tick: 'x.x.x.x.x.x.x.x.' }),
      P('s-16', 'Level 3: sixteenths', 16, 4, 90, { shaker: 'gggggggggggggggg' }),
    ] },
  { id: 'meter', title: 'Meter basics',
    body: 'Meter groups pulses into repeating bars with a strong first beat. 2/4 is strong-weak (a march), 3/4 is strong-weak-weak (a waltz), and 4/4 is strong-weak-medium-weak, the default of rock and pop. The top number counts beats per bar; the bottom names the note value that gets one beat.',
    listen: 'Each one accents beat 1. Count along: 1-2, 1-2-3, 1-2-3-4.',
    patterns: [
      P('m-24', '2/4', 2, 1, 100, { low: 'X.', tick: 'xx' }, { timeSig: '2/4', ticksPerStep: 12 }),
      P('m-34', '3/4', 3, 1, 100, { low: 'X..', tick: 'xxx' }, { timeSig: '3/4', ticksPerStep: 12 }),
      P('m-44', '4/4', 4, 1, 100, { low: 'X...', back: '.x.x', tick: 'xxxx' }, { ticksPerStep: 12 }),
    ] },
  { id: 'compound', title: 'Simple vs compound meter',
    body: 'In simple meter (2/4, 3/4, 4/4) each beat divides in two. In compound meter (6/8, 12/8) each beat divides in three, so 6/8 is two beats of three eighths, not six beats. 3/4 and 6/8 both hold six eighths, but 3/4 groups them 2+2+2 and 6/8 groups them 3+3.',
    listen: 'Six eighths each time. Feel three beats in 3/4 and two in 6/8.',
    patterns: [
      P('m-34e', '3/4 (3 beats × 2)', 6, 2, 70, { low: 'X.....', back: '..x.x.', tick: 'xxxxxx' }, { timeSig: '3/4', ticksPerStep: 6 }),
      P('m-68', '6/8 (2 beats × 3)', 6, 3, 70, { low: 'X.....', back: '...X..', tick: 'xxxxxx' }, { ticksPerStep: 6 }),
    ] },
  { id: 'odd', title: 'Odd meters',
    body: 'Additive or "odd" meters build the bar from unequal groups of 2s and 3s: 7/8 as 2+2+3, and the Balkan aksak meters such as 9/8 = 2+2+2+3 (aksak is Turkish for "limping"). The unequal beat lengths are what make them feel lopsided but danceable.',
    listen: 'Count the long beat in 7/8 and 9/8: it is the group of three.',
    patterns: [
      P('m-78', '7/8 as 2+2+3', 7, 7, 180, { low: 'X.x.X..', back: '..X....', tick: 'xxxxxxx' }, { ticksPerStep: 6 }),
      P('m-98', '9/8 aksak 2+2+2+3', 9, 9, 200, { low: 'X.x.x.X..', back: '..X...X..', tick: 'xxxxxxxxx' }, { ticksPerStep: 6 }),
    ] },
  { id: 'accent', title: 'Backbeat and accent',
    body: 'An accent can come from loudness (dynamic), duration (agogic), pitch or timbre, or position. The backbeat (stress on 2 and 4) sets up a counter-accent against the metrically strong 1 and 3. That push-pull between metric and phenomenal accent drives most popular music. Moving accents inside a steady hi-hat line changes the feel completely, though not a single note is added.',
    listen: 'Compare the hats accented on the beat, then on the off-beat (disco/house "upbeat" feel).',
    patterns: [
      P('ac-on', 'Hats accented on the beat', 16, 4, 112, { tick: 'X.x.X.x.X.x.X.x.', low: 'X.......X.......', back: '....X.......X...' }),
      P('ac-off', 'Hats accented off the beat', 16, 4, 112, { tick: 'x.X.x.X.x.X.x.X.', low: 'X...X...X...X...', back: '....X.......X...' }),
    ] },
  { id: 'syncopation', title: 'Syncopation and displacement',
    body: 'Syncopation is stress where the meter predicts weakness, or silence where it predicts stress: an off-beat accent, or an anticipation that arrives a 16th early and ties over the beat. Displacement takes a whole pattern and shifts it by a fixed amount (for example one 16th), so every note keeps its relation to the others but none sits where it used to. Groove studies (Witek et al. 2014) find that a moderate amount of syncopation maximises the urge to move.',
    listen: 'Play the straight beat, then the displaced version, and compare where the accents land.',
    patterns: [
      P('sy-base', 'Straight beat', 16, 4, 96, { low: 'X.......X.......', back: '....X.......X...' }),
      P('sy-antic', 'Anticipated kick (syncopated)', 16, 4, 96, { low: 'X......x..x.....', back: '....X.......X...', tick: 'x.x.x.x.x.x.x.x.' }),
      P('sy-disp', 'Same beat displaced one 16th later', 16, 4, 96, { low: '.X.......X......', back: '.....X.......X..' }),
    ] },
  { id: 'swing', title: 'Swing ratios, microtiming and groove',
    body: 'Swing lengthens the on-beat note of each pair and shortens the off-beat. 1:1 is straight, 2:1 is triplet swing, and 3:1 is dotted. Measured jazz swing ratios change with tempo: wide at slow tempos and close to straight at fast ones (Friberg & Sundström 2002). "Microtiming" means small, deliberate deviations (a laid-back snare, a pushed hi-hat). Whether microtiming increases groove is debated: Davies, Madison, Silva & Gouyon (2013, Music Perception) found that added microtiming deviations generally lowered groove ratings. Senn et al. (2016, Frontiers in Psychology) found that quantised and original expert timing were rated about equally groovy, and that exaggerated deviations lowered ratings.',
    listen: 'Play this and move the Swing slider in Mix: 0% straight, ~33% ≈ 2:1 triplet swing, 66%+ toward dotted.',
    patterns: [
      P('sw', 'Swing test: 16th hats and backbeat', 16, 4, 92, { tick: 'xxxxxxxxxxxxxxxx', low: 'X.....x...X.....', back: '....X.......X...' }, { swingable: true, suggestedSwing: 0.33 }),
    ] },
  { id: 'hypermeter', title: 'Phrasing and hypermeter',
    body: 'Bars group into larger units, such as 2, 4 or 8 bars, the same way beats group into bars. This is hypermeter (Lerdahl & Jackendoff 1983; Rothstein 1989). Drummers mark it with a crash or a kick on hyper-beat 1 and a fill in the last bar. A fill at bar 4 is a phrase boundary. A fill at bar 3 sounds "wrong" because it breaks the hypermeter.',
    listen: 'A four-bar phrase: accent on bar 1, a slight lift in bar 3, fill in bar 4.',
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
    listen: 'Each is computed live with euclid(k, n).',
    patterns: [
      P('e38', 'E(3,8) tresillo', 8, 2, 100, { accent: E(3, 8), low: 'X...X...' }),
      P('e58', 'E(5,8) cinquillo', 8, 2, 100, { accent: E(5, 8), low: 'X...X...' }),
      P('e712', 'E(7,12) standard bell', 12, 3, 100, { bell: E(7, 12, 0), low: 'X..x..X..x..' }),
      P('e516', 'E(5,16) bossa-like', 16, 4, 110, { accent: E(5, 16), tick: 'x.x.x.x.x.x.x.x.' }),
    ] },
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
    ] },
  { id: 'poly', title: 'Polyrhythm vs. polymeter',
    body: 'A polyrhythm divides the same time span in two ways at once: 3 against 2 within one bar, and both parts realign every bar. A polymeter runs cycles of different lengths over a shared pulse: a 3-beat figure over a 4-beat bar realigns only every 12 beats. Polyrhythm is about different note speeds in the same span. Polymeter is about different cycle lengths at the same note speed.',
    listen: 'Load the 4/4 beat, then layer the 3-beat cycle. Hear the accent "walk" across the bar and return every three bars.',
    patterns: [
      P('pr-32', 'Polyrhythm 3:2 in one bar', 12, 6, 80, { low: 'X.....X.....', bell: 'X...X...X...' }),
      P('pm-44', 'Polymeter base: 4/4', 16, 4, 104, { low: 'X.......X.......', back: '....X.......X...' }),
      P('pm-34', 'Polymeter layer: 3-beat cycle', 12, 4, 104, { bell: 'X...x...x...', tick: 'x.x.x.x.x.x.' }, { ticksPerStep: 3 }),
    ] },
  { id: 'hemiola', title: 'Hemiola',
    body: 'Hemiola regroups six pulses from 2×3 into 3×2 (or the reverse), for example two bars of 3/4 heard as one bar of 3/2. It is a specific, local 3:2 reinterpretation, common in Baroque cadences, Brahms, flamenco and Latin-American son jarocho, where the alternation is part of the meter.',
    listen: 'The kick marks two bars of 3/4. Layer the accents, which group the same span as three half notes (3/2). Mute each to flip between the two hearings.',
    patterns: [
      P('h-34', 'Two bars of 3/4', 12, 6, 90, { low: 'X.....X.....', tick: 'x.x.x.x.x.x.' }, { ticksPerStep: 6 }),
      P('h-32', 'Hemiola accent layer (3/2 feel)', 12, 6, 90, { accent: 'X...X...X...' }, { ticksPerStep: 6 }),
    ] },
  { id: 'modulation', title: 'Metric modulation',
    body: 'Metric modulation (a term associated with Elliott Carter) makes a subdivision of the old tempo the beat of the new one. If dotted eighths become the new quarter note, the tempo appears to slow to ¾ of the original, even though the clock never changed. Drummers use "implied" metric modulation to make a groove seem to change tempo while the band stays put.',
    listen: 'Two bars: a normal backbeat, then the same beat played on a dotted-8th grid. The second bar feels slower and "over" the first.',
    patterns: [
      P('mm', 'Backbeat → dotted-8th implied tempo', 32, 4, 100, { low: 'X.......X.......X.....X.....X...', back: '....X.......X......X.....X.....X', tick: 'x.x.x.x.x.x.x.x.x..x..x..x..x..x' }, { ticksPerStep: 3 }),
    ] }
]
registerPatterns(THEORY.flatMap(c => c.patterns))
