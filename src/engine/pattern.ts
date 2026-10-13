import type { Hit, Pattern, Voice, Layer } from './types'

export const TICKS_PER_BAR = 48
const VEL: Record<string, number> = { X: 1, x: 0.75, g: 0.3, f: 0.85, r: 0.85 }
for (let d = 1; d <= 9; d++) VEL[String(d)] = d / 9

export const velocityOf = (c: string | undefined): number => (c && VEL[c]) || 0

export function validatePattern(p: Pattern): string[] {
  const errs: string[] = []
  if (!p.ticksPerStep && TICKS_PER_BAR % p.steps !== 0) errs.push(`${p.id}: steps ${p.steps} must divide ${TICKS_PER_BAR}`)
  for (const [v, s] of Object.entries(p.tracks)) if (s && s.length !== p.steps) errs.push(`${p.id}.${v}: length ${s.length} != ${p.steps}`)
  return errs
}

/** Mix balance: hats and ride sit about 5 dB under kick/snare (×0.56), and off-beat cymbal strokes
 *  get a natural softer accent (×0.78), so the time-keeping voices never cover the backbeat. */
const CYMBAL_TRIM: Partial<Record<Voice, number>> = { tick: 0.56, open: 0.6, pedal: 0.6, ride: 0.56, rideBell: 0.65 }
export function hitsAt(p: Pattern, step: number): Hit[] {
  const out: Hit[] = []
  for (const [voice, s] of Object.entries(p.tracks) as [Voice, string][]) {
    const c = s?.[step]; if (!c || !VEL[c]) continue
    let v = VEL[c]; const trim = CYMBAL_TRIM[voice]
    if (trim) v *= trim * (step % (p.stepsPerBeat || 1) === 0 ? 1 : 0.78)
    out.push({ voice, velocity: v, graces: c === 'f' ? 1 : c === 'r' ? 2 : 0 })
  }
  return out
}

export const ticksPerStep = (p: Pattern) => p.ticksPerStep ?? TICKS_PER_BAR / p.steps

/** Given an absolute tick since start, return the pattern step if a step starts here. Each pattern cycles independently (polymeter-safe). */
export function stepForTick(p: Pattern, tick: number): number | null {
  const per = ticksPerStep(p)
  return tick % per === 0 ? (tick / per) % p.steps : null
}

/** Swing delay as a fraction of a step. Odd steps of 8- or 16-step grids get delayed. swing 0..1 maps to straight..triplet. */
/** Natural swing per style (0 = straight, 1 = full triplet long-short on 16ths). Straight styles are absent and stay straight. */
const NATURAL_SWING: Record<string, number> = { cissy: 0.4, 'gospel-chop': 0.3, 'boom-bap': 0.35, dilla: 0.55, lofi: 0.45, ukg: 0.6,
  samba: 0.15, partido: 0.15, 'one-drop': 0.5, steppers: 0.3, rockers: 0.3, kpanlogo: 0.4, 'djembe-kuku': 0.4, 'th-sw': 0.5 }
export const naturalSwing = (p: Pattern) => p.suggestedSwing ?? NATURAL_SWING[p.id] ?? NATURAL_SWING[p.id.replace(/^[a-z]+-(?=.)/, '')] ?? 0
/** Off-beat 16th delay in steps. Always the pattern's own natural feel; downbeats never move. */
export function swingOffset(p: Pattern, step: number, _legacy = 0): number {
  void _legacy
  const tps = ticksPerStep(p), sw = naturalSwing(p)
  if (!sw || (tps !== 3 && tps !== 6) || step % 2 === 0) return 0
  return sw * (1 / 3)
}

export function audibleLayers(layers: Layer[]): Layer[] {
  const anySolo = layers.some(l => l.solo)
  return layers.filter(l => (anySolo ? l.solo : !l.mute))
}

/** Beats per second of the quarter-note (or dotted-quarter in 12/8) pulse. */
export const pulseHz = (bpm: number) => bpm / 60

/** Bjorklund/Euclidean rhythm (Toussaint 2005): k onsets spread as evenly as possible over n steps, as an 'x'/'.' string. */
export function euclid(k: number, n: number, rotate = 0): string {
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(Math.floor((i * k) / n) !== Math.floor(((i - 1) * k) / n) || i === 0 ? 'x' : '.')
  const r = ((rotate % n) + n) % n
  return out.slice(r).concat(out.slice(0, r)).join('')
}

/** Sub-step offsets are exact rationals stored as 'n/d' strings (older data: decimals). */
export const fracOf = (f: number | string) => typeof f === 'number' ? f : (([n, d]) => n / (d ?? 1))(f.split('/').map(Number))
/** Sub-step hits for a step: offset as a fraction of the step plus velocity (cymbals trimmed like hitsAt). */
export function subHitsAt(p: Pattern, step: number): (Hit & { frac: number; variant?: string })[] {
  if (!p.sub) return []
  const out: (Hit & { frac: number; variant?: string })[] = []
  for (const [voice, m] of Object.entries(p.sub) as [Voice, Record<string, [number, number, string?][]>][]) {
    const l = m[String(step)]; if (!l) continue
    for (const [frac, v, variant] of l) out.push({ voice, frac: fracOf(frac), velocity: v * (CYMBAL_TRIM[voice] ?? 1), variant })
  }
  return out
}

/** Hit variants: a different size/pitch of the same instrument family, played by re-pitching (and optionally re-routing) a kit voice.
 *  `short` is the tiny in-cell label. */
export const VARIANTS: Record<string, { label: string; short: string; voice?: Voice; rate?: number; gain?: number }> = {
  crash16: { label: '16" crash', short: '16', voice: 'crash1', rate: 1.12 },
  crash18: { label: '18" crash', short: '18', voice: 'crash2', rate: 1 },
  crash20: { label: '20" crash', short: '20', voice: 'crash2', rate: 0.9 },
  splash: { label: 'Splash', short: 'sp', voice: 'crash1', rate: 1.6, gain: 0.7 },
  china: { label: 'China', short: 'ch', voice: 'china' },
  chinaSmall: { label: 'Small china', short: 'c·', voice: 'china', rate: 1.3, gain: 0.8 },
  ride2: { label: 'Second ride', short: 'r2', voice: 'ride', rate: 0.88 },
  rideBell: { label: 'Ride bell', short: 'rb', voice: 'rideBell' },
  cowbell: { label: 'Cowbell', short: 'cb', voice: 'bell' },
  agogoHi: { label: 'Agogô high', short: 'a↑', voice: 'bell', rate: 1.5, gain: 0.85 },
  agogoLo: { label: 'Agogô low', short: 'a↓', voice: 'bell', rate: 1.18, gain: 0.85 },
  bellBig: { label: 'Large bell', short: 'b↓', voice: 'rideBell', rate: 0.8 },
  tomHi2: { label: 'High-mid tom', short: 'h2', voice: 'tomHi', rate: 0.9 },
  tomMid2: { label: 'Low-mid tom', short: 'm2', voice: 'tomMid', rate: 0.9 },
  tomFloor2: { label: 'Low floor tom', short: 'f2', voice: 'tomLo', rate: 0.86 },
}
