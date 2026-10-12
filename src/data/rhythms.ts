import type { Pattern } from '../engine/types'
import { MORE_RHYTHMS } from './more'

export type Evidence = 'established' | 'mixed' | 'speculative'

export interface RhythmEntry {
  pattern: Pattern
  family: string
  effect: string
  why: string
  /** How well-supported the listener-effect claim is. */
  evidence: Evidence
  evidenceNote?: string
  tryLayering?: string[]
}

const p = (x: Pattern) => x

export const RHYTHMS: RhythmEntry[] = [
  { family: 'Trance & pulse', evidence: 'mixed',
    pattern: p({ id: 'shaker-drone', name: 'Rattle drone', steps: 16, stepsPerBeat: 4, suggestedBpm: 128, bpmNote: 'Matches the theta pulse so the two can be layered.',
      tracks: { shaker: 'xgxgxgxgxgxgxgxg' } }),
    effect: 'A continuous rattle wash. It blurs the attack of the drum and makes the overall sound more enveloping.',
    why: 'Rattles are used alongside drums in many shamanic traditions. Broadband noise fills the gaps between strokes, so the pulse feels like a texture more than a series of events.',
    evidenceNote: 'The ethnographic use is documented. Specific psychological effects of rattles are not well studied.' },
  { family: 'Rock', evidence: 'established',
    pattern: p({ id: 'rock-backbeat', name: 'Rock backbeat', steps: 16, stepsPerBeat: 4, suggestedBpm: 110, bpmNote: 'Rock backbeats commonly sit around 90–130 BPM. Typical range for the style by common convention, not taken from one source.', swingable: true,
      tracks: { low: 'X.......X.x.....', back: '....X..g....X..g', tick: '8.5.8.5.8.5.8.5.'} }),
    effect: 'Solid, forward-leaning, easy to move to. It invites head-nodding on 2 and 4.',
    why: 'Kick on the strong beats (1, 3) and snare on the weak beats (2, 4) splits the bar into "down" and "up." The steady eighth-note hats set the subdivision, so the body knows exactly where the next event lands. Moderate predictability with a strong backbeat is reliably rated as groovy in groove research (Janata, Tomic & Haberman 2012, J. Exp. Psych.: General; Witek et al. 2014, PLOS ONE).' },
  { family: 'Funk', evidence: 'established',
    pattern: p({ id: 'funk-16', name: 'Syncopated 16th funk', steps: 16, stepsPerBeat: 4, suggestedBpm: 100, bpmNote: '16th-note funk commonly ~90–115 BPM (Funky Drummer ≈ 100). Typical range for the style by common convention, not taken from one source.', swingable: true,
      tracks: { low: 'X..x..X...X..x..', back: '.g..X.g..g.gX..g', tick: '8383838383838383', open: '..............7.' } }),
    effect: 'Tight and "in the pocket." It makes you want to move more than a straight rock beat does.',
    why: 'Kicks on off-16ths create gaps that the listener\'s body wants to fill. Witek et al. (2014, PLOS ONE) found an inverted-U: medium syncopation produced the strongest urge to move and the most pleasure. Ghost notes (quiet snare strokes) add motion without blurring the backbeat.' },
  { family: 'Shuffle', evidence: 'established',
    pattern: p({ id: 'shuffle', name: 'Triplet shuffle', steps: 12, stepsPerBeat: 3, suggestedBpm: 112, bpmNote: 'Blues/boogie shuffles commonly ~90–130 BPM. Typical range for the style by common convention, not taken from one source.',
      tracks: { low: 'X.....X.....', back: '..gX.g...gX.', tick: '8.48.48.48.4' } }),
    effect: 'A rolling, loping bounce: relaxed but propulsive, with a blues and boogie feel.',
    why: 'Each beat is split long-short (the first and third notes of a triplet). The long-short motion feels like a stride or a swing, and the gap before each beat creates a small lift into it.' },
  { family: 'Jazz', evidence: 'established',
    pattern: p({ id: 'jazz-ride', name: 'Swing ride', steps: 12, stepsPerBeat: 3, suggestedBpm: 160, bpmNote: 'Medium-up swing commonly ~120–200 BPM. Typical range for the style by common convention, not taken from one source.',
      tracks: { ride: '8..7.48..7.4', pedal: '...x.....x..', low: 'g..g..g..g..', back: '.....g.....3' } }),
    effect: 'Light, buoyant, conversational. It moves forward without pushing.',
    why: 'The "ding, ding-a ding" ride pattern carries the time on a cymbal instead of a drum. The hi-hat foot on 2 and 4 is a soft backbeat, and a feathered (barely audible) kick adds weight. With the timekeeping this light, the snare and kick are free to comment, which is the basis of jazz "comping."' },
  { family: 'Brazil', evidence: 'established',
    pattern: p({ id: 'bossa', name: 'Bossa nova (one-bar approximation)', steps: 16, stepsPerBeat: 4, suggestedBpm: 136, bpmNote: 'Bossa nova commonly ~120–145 BPM counted in quarter notes (often notated in 2/2). Typical range for the style by common convention, not taken from one source.',
      tracks: { low: 'X..xX..xX..xX..x', accent: 'X..X..X...X..X..', tick: 'x.x.x.x.x.x.x.x.' } }),
    effect: 'Cool, intimate, gently swaying.',
    why: 'The kick\'s long-short heartbeat (dotted quarter + eighth) gives a soft sway. The cross-stick figure is clave-related and full of anticipations, and it floats over that sway. Everything is played quietly, so the syncopation feels relaxed, not urgent.',
    evidenceNote: 'The traditional bossa cross-stick pattern spans two bars. It is compressed into one bar here, which is a simplification.' },
  { family: 'Afro-Cuban', evidence: 'established',
    pattern: p({ id: 'son-clave', name: 'Son clave 3-2', steps: 16, stepsPerBeat: 4, suggestedBpm: 100, bpmNote: 'Son and salsa-adjacent grooves range widely (~90–200); 100 is a clear teaching tempo. Typical range for the style by common convention, not taken from one source.',
      tracks: { accent: 'X..X..X...X.X...', low: 'X.......X.......' } }),
    effect: 'A key that the whole groove locks to. It feels like tension, then answer.',
    why: 'The "3" side (three strokes, the last landing off the beat) creates tension, and the "2" side resolves it on the beat. In Afro-Cuban music, every other part is organised relative to the clave.',
    evidenceNote: 'Written here as one 4/4 bar, which is the same as two bars of 2/4.' },
  { family: 'Afro-Cuban', evidence: 'established',
    pattern: p({ id: 'tresillo', name: 'Tresillo (3+3+2)', steps: 8, stepsPerBeat: 2, suggestedBpm: 100, bpmNote: 'Teaching tempo; habanera-style grooves are often 80–110 BPM.',
      tracks: { low: 'X..X..X.', tick: 'x.x.x.x.' } }),
    effect: 'Urgent and danceable. It feels like a skip in the step.',
    why: 'Eight pulses grouped 3+3+2 instead of 2+2+2+2. The middle stroke lands between beats, against the even pulse, and the short final group pulls back toward the downbeat. Tresillo underlies habanera, son, New Orleans second line, reggaeton, and much pop.' },
  { family: 'Polyrhythm', evidence: 'established',
    pattern: p({ id: 'poly-3-2', name: '3 against 2', steps: 12, stepsPerBeat: 6, suggestedBpm: 90, bpmNote: 'Slow teaching tempo so both cycles are easy to hear.',
      tracks: { low: 'X.....X.....', bell: 'X...X...X...' } }),
    effect: 'A hovering, two-places-at-once sensation. It can be heard as either "in 2" or "in 3."',
    why: 'Two even cycles share a start but divide the span differently, and they only line up on beat one. The ear flips between them (perceptual bistability) or hears the composite "pass the gol-den but-ter" rhythm.' },
  { family: 'Polyrhythm', evidence: 'established',
    pattern: p({ id: 'poly-4-3', name: '4 against 3', steps: 12, stepsPerBeat: 3, suggestedBpm: 80, bpmNote: 'Slow teaching tempo so both cycles are easy to hear.',
      tracks: { low: 'X..X..X..X..', bell: 'X...X...X...' } }),
    effect: 'Restless, rotating. Harder to hear as a single rhythm than 3:2.',
    why: 'Same principle as 3:2, but with more misaligned points per cycle, so the composite rhythm is more intricate. Try muting one layer at a time.' },
  { family: 'West African / Afro-Cuban', evidence: 'established',
    pattern: p({ id: 'bembe', name: '12/8 bembé bell', steps: 12, stepsPerBeat: 3, suggestedBpm: 110, bpmNote: 'BPM = the dotted-quarter dance pulse; bembé/6-8 feels commonly ~95–130. Typical range for the style by common convention, not taken from one source.',
      tracks: { bell: 'X.x.xx.x.x.x', low: 'X..x..X..x..', shaker: 'x.xx.xx.xx.x' } }),
    effect: 'Circular, hypnotic, deeply danceable. It can feel like it has no beginning.',
    why: 'The 7-stroke standard bell pattern (asymmetric, 2-2-1-2-2-2-1) rotates against a 4-beat dotted-quarter pulse. Because it is asymmetric, the ear always knows where it is in the cycle, but there are many valid places to "feel" the downbeat. Layer the straight-eighths pattern on top to hear the 4/4-against-12/8 tension (a 2:3 ratio at every beat).',
    tryLayering: ['straight-8ths'] },
  { family: 'West African / Afro-Cuban', evidence: 'established',
    pattern: p({ id: 'straight-8ths', name: 'Straight 8ths (4/4 overlay)', steps: 8, stepsPerBeat: 2, suggestedBpm: 110, bpmNote: 'Matches the bembé so the two layer correctly.',
      tracks: { tick: 'xxxxxxxx' } }),
    effect: 'On its own it is plain. Layered over the 12/8 bembé it creates a sense of shifting gravity.',
    why: 'Eight even notes against twelve: every beat holds a 2-against-3. This is the duple-versus-triple ambiguity that runs through much African-diasporic music, from Afro-Cuban 6/8 to the blues shuffle.' },
  { family: 'Reggae', evidence: 'established',
    pattern: p({ id: 'one-drop', name: 'One-drop', steps: 16, stepsPerBeat: 4, suggestedBpm: 75, bpmNote: 'Roots-reggae one-drop commonly ~60–85 BPM. Typical range for the style by common convention, not taken from one source.', swingable: true,
      tracks: { low: '........X.......', accent: '........X.......', tick: '7.4.7.4.7.4.7.4.', open: '..............5.' } }),
    effect: 'Spacious, laid-back, heavy.',
    why: 'Beat one, the loudest beat in most Western grooves, is left empty, and kick and rim land together on beat 3. The empty downbeat creates a feeling of suspension that the band (bass, skank guitar) fills in.' },
  { family: 'Development', evidence: 'established',
    pattern: p({ id: 'tom-fill', name: 'One-bar descending fill', steps: 16, stepsPerBeat: 4, suggestedBpm: 110, bpmNote: 'Matches the rock backbeat.',
      tracks: { back: 'X6X6............', tomHi: '....X6X6........', tomMid: '........X6X6....', tomLo: '............X6X.', low: 'X...........X.X.' } }),
    effect: 'A sense of arrival: "something is about to change."',
    why: 'Fills break the repetition the groove has trained the listener to expect. A falling pitch (snare, high tom, low tom) works like a cadence, and steady 16ths make the drop toward the next downbeat feel inevitable. See the Storytelling page.' },
]

RHYTHMS.push(...MORE_RHYTHMS)

export const PATTERNS: Record<string, Pattern> = {}
export const registerPatterns = (ps: Pattern[]) => ps.forEach(x => (PATTERNS[x.id] = x))
registerPatterns(RHYTHMS.map(r => r.pattern))
