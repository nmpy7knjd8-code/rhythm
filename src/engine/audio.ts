import * as Tone from 'tone'
import type { Kit, KitVoice, Layer, Voice, Arrangement, Pattern, Fill } from './types'
import { TICKS_PER_BAR, hitsAt, stepForTick, swingOffset, audibleLayers, ticksPerStep , subHitsAt, VARIANTS, fracOf } from './pattern'

type Inst = { trigger: (t: number, v: number, r?: number, gm?: number, gate?: number, tip?: boolean) => void; choke?: (t: number) => void; dispose: () => void }

// ---- sample bank: lazy, cached, shared across kits/layers ----
let SAMPLE_BASE = ''
export const setSampleBase = (b: string) => { SAMPLE_BASE = b }
const buffers = new Map<string, Tone.ToneAudioBuffer>()
const loading = new Map<string, Promise<void>>()
function loadFile(f: string): Promise<void> {
  if (!loading.has(f)) loading.set(f, new Promise<void>(res => {
    const b = new Tone.ToneAudioBuffer(SAMPLE_BASE + f, () => { buffers.set(f, b); res() }, () => res())
  }))
  return loading.get(f)!
}
/** Preload every sample a kit uses. Resolves with progress callbacks; safe to call repeatedly. */
export async function preloadKit(kit: Kit, onProgress?: (done: number, total: number) => void) {
  const files = Object.values(kit.voices).flatMap(v => v.layers?.flatMap(l => l.files) ?? [])
  let done = 0
  await Promise.all(files.map(f => loadFile(f).then(() => onProgress?.(++done, files.length))))
}

function makeSynth(kv: KitVoice, g: Tone.Gain): Inst {
  if (kv.kind === 'membrane') {
    const s = new Tone.MembraneSynth({ pitchDecay: kv.pitchDecay ?? 0.05, octaves: 4, envelope: { attack: 0.001, decay: (kv.decay ?? 0.3), sustain: 0, release: 0.05 } }).connect(g)
    return { trigger: (t, v, r = 1) => s.triggerAttackRelease((kv.pitch ?? 60) * r, (kv.decay ?? 0.3), t, v), dispose: () => s.dispose() }
  }
  if (kv.kind === 'noise') {
    const f = new Tone.Filter(kv.tone ?? 6000, kv.tone && kv.tone > 4000 ? 'highpass' : 'bandpass').connect(g)
    const s = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: (kv.decay ?? 0.3), sustain: 0 } }).connect(f)
    const body = kv.pitch ? new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 1.5, envelope: { attack: 0.001, decay: (kv.decay ?? 0.3) * 0.6, sustain: 0 } }).connect(g) : null
    return {
      trigger: (t, v, r = 1) => { s.triggerAttackRelease((kv.decay ?? 0.3), t, v); body?.triggerAttackRelease(kv.pitch! * r, (kv.decay ?? 0.3) * 0.6, t, v * 0.6) },
      choke: t => s.triggerRelease(t),
      dispose: () => { s.dispose(); f.dispose(); body?.dispose() },
    }
  }
  const s = new Tone.MetalSynth({ harmonicity: kv.tone ?? 5.1, modulationIndex: 16, resonance: 3000, octaves: 1.2, envelope: { attack: 0.001, decay: (kv.decay ?? 0.3), release: 0.05 } }).connect(g)
  return { trigger: (t, v, r = 1) => s.triggerAttackRelease((kv.pitch ?? 300) * r, (kv.decay ?? 0.3), t, v), choke: t => s.triggerRelease(t), dispose: () => s.dispose() }
}

function makeInst(kv: KitVoice, out: Tone.ToneAudioNode, washy = false): Inst {
  const eqs: Tone.Filter[] = []
  if (kv.eq?.peak) eqs.push(new Tone.Filter({ type: 'peaking', frequency: kv.eq.peak[0], gain: kv.eq.peak[1], Q: kv.eq.peak[2] }))
  if (kv.eq?.shelf) eqs.push(new Tone.Filter({ type: 'highshelf', frequency: kv.eq.shelf[0], gain: kv.eq.shelf[1] }))
  if (kv.eq?.lp) eqs.push(new Tone.Filter({ type: 'lowpass', frequency: kv.eq.lp, rolloff: -12, Q: 0.5 }))
  const g = new Tone.Gain(kv.gain ?? 1)
  if (eqs.length) { g.chain(...eqs, out) } else g.connect(out)
  if (kv.kind !== 'sample') { const s = makeSynth(kv, g); return { ...s, dispose: () => { s.dispose(); g.dispose() } } }
  const layers = kv.layers ?? []
  layers.forEach(l => l.files.forEach(loadFile))
  const fb = kv.fallback ? makeSynth(kv.fallback, g) : null
  const rr = layers.map(() => 0)
  let last = '', seed = 1, lp: Tone.Filter | null = null
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const live = new Set<Tone.ToneBufferSource>()
  let lastT = -9
  return {
    trigger: (t, v, r = 1, gm = 1, gate = 0, tip = false) => {
      let li = layers.findIndex(l => v <= l.vel + 1e-6); if (li < 0) li = layers.length - 1
      const lo = li ? layers[li - 1].vel : 0
      const rel = (v - lo) / Math.max(0.01, layers[li].vel - lo) // position within layer
      // near a layer boundary, borrow from the neighbouring layer 30% of the time (gain stays matched to v)
      let pick = li
      if (rel > 0.85 && li < layers.length - 1 && rnd() < 0.3) pick = li + 1
      else if (rel < 0.15 && li > 0 && rnd() < 0.3) pick = li - 1
      // random round-robin, never the same file twice in a row
      const files = layers[pick].files.filter(x => x !== last).length ? layers[pick].files.filter(x => x !== last) : layers[pick].files
      const f = files[Math.floor(rnd() * files.length)]; rr[li]++; last = f
      const buf = buffers.get(f)
      if (!buf) { fb?.trigger(t, v, r); return }
      const src = new Tone.ToneBufferSource(buf).connect(tip ? (lp ??= new Tone.Filter(7000, 'lowpass').connect(g)) : g)
      const wob = 1 + ((rr[li] * 0.61803) % 1 - 0.5) * 0.016 // ±0.8% pitch per stroke
      src.playbackRate.value = (kv.rate ?? 1) * r * wob
      src.onended = () => { live.delete(src); src.dispose() }
      live.add(src)
      // a crash/china/open hat that is still ringing doesn't give a fresh sharp transient: soften the attack of quick repeats (2-8 ms fade-in from the onset)
      if (kv.eq?.attack) src.fadeIn = kv.eq.attack
      if (washy) { const dt = t - lastT; if (dt > 0 && dt < 0.6) src.fadeIn = Math.max(kv.eq?.attack ?? 0, 0.002 + 0.006 * (1 - dt / 0.6)); lastT = t }
      src.start(t, 0, undefined, (0.55 + 0.45 * Math.min(1, rel)) * gm)
      if (gate > 0) { src.fadeOut = 0.03; src.stop(t + gate) } // gated / dampened drum
    },
    choke: t => { live.forEach(s => { try { s.fadeOut = 0.06; s.stop(t) } catch { /* already stopped */ } }); fb?.choke?.(t) }, // ~60 ms damping, like a foot closing the hat
    dispose: () => { fb?.dispose(); lp?.dispose(); g.dispose(); eqs.forEach(f => f.dispose()) },
  }
}

interface Channel { gain: Tone.Gain; insts: Partial<Record<Voice, Inst>> }
export interface SoundProfile { snare?: number; snareGate?: number; toms?: number; tomGate?: number; cym?: number }
interface HitCtx { bar: number; pos: number; beat: number; sub: number; n?: number; stroke: number }
const VOICE_IDX: Partial<Record<Voice, number>> = { low: 1, back: 2, tick: 3, open: 4, pedal: 5, ride: 6, crash1: 7, crash2: 8, tomHi: 9, tomMid: 10, tomLo: 11 }
/** Deterministic hash in [-1, 1] (same hit → same value every playthrough). */
const hash = (a: number, b: number, c: number) => { const x = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return (x - Math.floor(x)) * 2 - 1 }
/** Beat length in ticks for accents: dotted quarter (18) in compound x/8 meters, else quarter (12). */
const beatTicksOf = (p: Pattern) => { const m = /^(\d+)\/8$/.exec(p.timeSig ?? ''); return m && +m[1] % 3 === 0 && +m[1] > 3 ? 18 : 12 }
export type StepListener = (layerSteps: Record<string, number>, bar: number) => void
const FILL_ID = 'fill', FX_ID = 'fx', SONG_ID = 'song'
/** Deterministic ±0.8 ms drift (kept under the 1 ms timing-audit tolerance) on inner roll strokes so rolls aren't machine-perfect. */
/** Timing drift for inner roll strokes only (the on-step strokes stay exactly on the grid). Below 12 strokes/s: the old ±0.8 ms.
 *  Faster: ±2-4 ms scaled by speed, from slow overlapping sines over the song position (smooth, non-repeating, not white noise),
 *  plus a small left/right hand unevenness. Clamped to 20% of the stroke gap so strokes never reorder. */
const rollJitter = (bar: number, step: number, frac: number, stroke = 1, j = 0) => {
  const rate = 1 / stroke
  if (rate < 12) { const x = Math.sin((bar * 131 + step * 17 + frac * 7) * 12.9898) * 43758.5453; return ((x - Math.floor(x)) * 2 - 1) * 0.0008 }
  const amp = Math.min(0.004, 0.002 + (rate - 12) / 12 * 0.002), u = bar * 4 + step + frac
  const smooth = 0.6 * Math.sin(u * 1.37) + 0.4 * Math.sin(u * 0.53 + 1.1)
  const hand = (j % 2 ? 0.35 : -0.35)
  return Math.max(-0.2 * stroke, Math.min(0.2 * stroke, amp * (0.75 * smooth + 0.25 * hand)))
}
/** Visual hit bus: Kit view subscribes; callbacks fire via Tone.Draw at the hit's audio time. */
export const hitBus = new Set<(voice: Voice, vel: number, variant?: string) => void>()

/** Thin Tone.js wrapper. All timing runs on Tone.Transport at a 48-tick-per-bar grid. */
export class RhythmEngine {
  private layers: Layer[] = []
  private channels = new Map<string, Channel>()
  private kit!: Kit
  private swing = 0
  /** Song feel 0..1: 1 = as transcribed (tab shuffle + human roll feel), 0 = straight and exact. */
  private feel = 1.6 // fixed at 160% by the player
  /** Feel 0-2: 0 exact, 1 the natural feel (default), above 1 swings harder and loosens the human variation. */
  setFeel(f: number) { this.feel = Math.max(0, Math.min(2, f)) }
  /** Seconds to move a shuffled off-beat back toward straight (0 at feel 1). Straight bars never move. */
  private feelShift(p: Pattern, pos: number, tps: number, stepSec: number) {
    if (!p.feel || this.feel === 1) return 0
    const u = p.feel === '16th' ? 1 / 8 : 1 / 4, w = pos * tps / TICKS_PER_BAR, r = w % u
    if (Math.abs(r - u * 2 / 3) > 1e-6) return 0
    // the written shuffle off-beat sits at 2/3 of the pair (2:1). Feel f puts it at 1/2 + f/6: 0 straight, 1 triplet, capped at 0.8 (4:1) so it never reaches the next note
    return (u / 6) * (Math.min(this.feel, 1.8) - 1) * (TICKS_PER_BAR / tps) * stepSec
  }
  private tick = 0
  private bar = 0
  private eventId: number | null = null
  private listeners = new Set<StepListener>()
  private bus = new Tone.Compressor({ threshold: -14, ratio: 3, attack: 0.005, release: 0.15 }).toDestination()
  private master = new Tone.Gain(0.8).connect(this.bus)
  /** One light shared room (about 0.7 s, about -20 dB, low end filtered out of the send so the kick stays dry and tight). */
  readonly room = (() => { const r = new Tone.Reverb({ decay: 0.7, preDelay: 0.008, wet: 1 }); const hp = new Tone.Filter(300, 'highpass'); const g = new Tone.Gain(0.1)
    this.master.connect(hp); hp.connect(r); r.connect(g); g.connect(this.bus); return r })()
  private arrangement: { arr: Arrangement; resolve: (ids: string[]) => Pattern[] } | null = null
  private fill: Fill | null = null
  private fillEvery = 0
  onSection?: (index: number) => void
  /** Song-form mode: a flat list of one-bar patterns played in order. */
  private song: { bars: Pattern[]; loop: [number, number] | null } | null = null
  private songBar = 0
  private songTick = 0
  private lastTime = -1
  private late = false
  /** hits dropped because the scheduler was catching up after a stall (diagnostics) */
  skipped = 0
  private pendingJump: number | null = null
  onSongBar?: (bar: number) => void
  /** Fired when a song plays past its last bar (not when a section loop wraps). */
  onSongEnd?: () => void
  setSong(bars: Pattern[] | null) { this.song = bars ? { bars, loop: null } : null; this.songBar = 0; this.songTick = 0; this.pendingJump = null }
  setSongLoop(loop: [number, number] | null) { if (this.song) this.song.loop = loop }
  /** Jump to a bar: immediately if stopped, otherwise at the next bar line. */
  jumpSong(bar: number, onBeat = false) { if (!this.playing) { this.songBar = bar; this.songTick = 0 } else if (onBeat) this.pendingBeatJump = bar; else this.pendingJump = bar }
  /** Bar to restart at on the next beat (12 ticks = one quarter), set by section taps. */
  private pendingBeatJump: number | null = null
  private songStep(time: number, tickSec: number) {
    if (this.pendingBeatJump !== null && this.songTick % 12 === 0) { this.songBar = this.pendingBeatJump; this.songTick = 0; this.pendingBeatJump = null; this.pendingJump = null }
    const song = this.song!
    if (!song.bars.length) return
    if (!(this.songBar >= 0 && this.songBar < song.bars.length)) { this.songBar = 0; this.songTick = 0 }
    const p = song.bars[this.songBar]; const tps = Math.max(1, ticksPerStep(p) || 1)
    let len = p.steps * tps
    if (!(len > 0) || !isFinite(len)) len = TICKS_PER_BAR // guard: a bar can never be empty or non-finite
    if (this.songTick >= len) this.songTick = len - 1
    if (this.songTick === 0) {
      const b = this.songBar; Tone.getDraw().schedule(() => this.onSongBar?.(b), time)
      // tempo map: each bar may carry its own tempo; change it exactly on the bar line
      const want = (p.suggestedBpm ?? 0) * this.songTempoScale
      if (want > 0 && isFinite(want) && Math.abs(Tone.getTransport().bpm.getValueAtTime(time) - want) > 0.01) Tone.getTransport().bpm.setValueAtTime(want, time)
    }
    tickSec = 5 / Tone.getTransport().bpm.getValueAtTime(time + 1e-6) // after any tempo change at this instant
    if (p.tempoAt) for (const [f, bpm] of p.tempoAt) { const at = fracOf(f) * len; if (this.songTick === Math.ceil(at - 1e-9)) Tone.getTransport().bpm.setValueAtTime(bpm * this.songTempoScale, Math.max(time - (Math.ceil(at - 1e-9) - at) * tickSec, this.lastTime)) }
    if (this.songTick % tps === 0) {
      const step = this.songTick / tps; const stepSec = tickSec * tps
      let t = time
      const fl = this.feel
      if (p.humanize) { const r = Math.sin((this.songBar * 97 + step) * 12.9898) * 43758.5453; t += fl * (p.humanize.lateMs + ((r - Math.floor(r)) * 2 - 1) * p.humanize.jitterMs) / 1000 }
      this.hz = { bar: this.songBar, pos: step * tps, beat: beatTicksOf(p), sub: -1, stroke: stepSec }
      const bt = (this.songBar * len + this.songTick) / 12 // song position in quarter beats (smooth for these steady-meter grooves)
      if (p.grace) this.playGraces(SONG_ID, p, step, t, stepSec, f => this.feelShift(p, step + f, tps, stepSec) + this.driftAt('low', bt))
      for (const h of hitsAt(p, step)) this.play(SONG_ID, h.voice, t + this.feelShift(p, step, tps, stepSec) + this.driftAt(h.voice, bt), h.velocity, h.graces, stepSec, p.variant?.[h.voice]?.[step])
      this.playSubs(SONG_ID, p, step, t, stepSec, this.songBar, beatTicksOf(p), tps, f => this.feelShift(p, step + f, tps, stepSec) + this.driftAt('low', bt), fl); this.hz = null
      const b = this.songBar; Tone.getDraw().schedule(() => this.listeners.forEach(f => f({ [SONG_ID]: step }, b)), time)
    }
    if (++this.songTick >= len) {
      this.songTick = 0
      let next = this.pendingJump ?? this.songBar + 1; this.pendingJump = null
      if (song.loop && next >= song.loop[1]) next = song.loop[0]
      if (next >= song.bars.length) { next = 0; Tone.getDraw().schedule(() => this.onSongEnd?.(), time) }
      this.songBar = next
    }
  }
  onBar?: (bar: number, inFill: boolean) => void

  setKit(kit: Kit) { this.kit = kit; for (const c of this.channels.values()) this.clearInsts(c) }
  setSwing(s: number) { this.swing = s }
  /** Song tempo scale (slider while a song plays): every bar's own tempo × this factor. */
  songTempoScale = 1
  private songBaseBpm = 0
  setSongBaseBpm(b: number) { this.songBaseBpm = b; this.songTempoScale = 1 }
  setBpm(bpm: number) {
    const bp = Tone.getTransport().bpm, now = Tone.now()
    if (this.song && this.songBaseBpm > 0) {
      // scale the song's tempo map instead of overriding it; replace pending automation rather than ramping over it
      this.songTempoScale = Math.max(0.1, bpm / this.songBaseBpm)
      const cur = this.song.bars[this.songBar]?.suggestedBpm ?? this.songBaseBpm
      bp.cancelScheduledValues(now); bp.setValueAtTime(cur * this.songTempoScale, now); return
    }
    const v = bp.getValueAtTime(now)
    if (Math.abs(v - bpm) < 1e-6) return // same tempo: re-automating an unchanged value corrupts Tone's tick timeline
    bp.cancelScheduledValues(now); bp.setValueAtTime(v, now); bp.linearRampToValueAtTime(bpm, now + 0.05)
  }
  /** Insert `fill` in the last bar of every `every` bars (0 = off). */
  setFill(fill: Fill | null, every: number) { this.fill = fill; this.fillEvery = every }
  subscribe(l: StepListener) { this.listeners.add(l); return () => { this.listeners.delete(l) } }

  private channel(id: string, volume = 0.85): Channel {
    let c = this.channels.get(id)
    if (!c) { c = { gain: new Tone.Gain(volume).connect(this.master), insts: {} }; this.channels.set(id, c) }
    return c
  }

  setLayers(layers: Layer[]) {
    this.layers = layers
    const ids = new Set([...layers.map(l => l.id), FILL_ID, FX_ID, SONG_ID])
    // A layer leaving (section change) keeps ringing: its cymbals/toms decay naturally, then the channel is freed.
    for (const [id, c] of this.channels) if (!ids.has(id)) { this.channels.delete(id); setTimeout(() => { this.clearInsts(c); c.gain.dispose() }, 8000) }
    for (const l of layers) this.channel(l.id, l.volume).gain.gain.rampTo(l.volume, 0.03)
  }

  setArrangement(arr: Arrangement | null, resolve?: (ids: string[]) => Pattern[]) {
    this.arrangement = arr && resolve ? { arr, resolve } : null
  }

  private clearInsts(c: Channel) { for (const i of Object.values(c.insts)) i?.dispose(); c.insts = {} }

  private inst(channelId: string, v: Voice): Inst | undefined {
    const c = this.channels.get(channelId) ?? this.channel(channelId)
    return (c.insts[v] ??= makeInst(this.kit.voices[v], c.gain, v === 'crash1' || v === 'crash2' || v === 'china' || v === 'open'))
  }

  /** Optional event trace for timing tests: every scheduled hit's audio-context time. */
  trace: { t: number; src: string; voice: Voice; bar: number; variant?: string }[] | null = null
  /** Bar length in ticks follows the first layer's own bar (e.g. 42 ticks for 7/8), so fills land on its bar lines. */
  private barTicks(): number {
    const p = this.layers[0]?.pattern; if (!p) return TICKS_PER_BAR
    const len = p.steps * ticksPerStep(p)
    return p.barTicks ?? (len <= TICKS_PER_BAR * 2 && len % 6 === 0 && len !== TICKS_PER_BAR * 2 ? len : TICKS_PER_BAR)
  }
  private play(channelId: string, voice: Voice, t: number, vel: number, graces = 0, stepSec = 0.1, variant?: string) {
    if (this.late || !isFinite(t)) { this.skipped++; return }
    this.trace?.push({ t, src: channelId, voice, bar: this.bar, variant })
    const vr = variant ? VARIANTS[variant] : undefined
    if (vr?.voice) voice = vr.voice
    vel = Math.min(1, vel * (vr?.gain ?? 1))
    const inst = this.inst(channelId, voice); if (!inst) return
    if (hitBus.size) { const v0 = voice, vv = vel; Tone.getDraw().schedule(() => hitBus.forEach(f => f(v0, vv, variant)), t) }
    if (voice === 'tick' || voice === 'pedal') this.channels.get(channelId)?.insts.open?.choke?.(t)
    const hz = this.hz, fl = this.feel
    if (hz && fl > 0) vel = this.humanVel(voice, vel, hz, fl)
    const hh = hz ? hash(hz.bar, hz.pos, 7) : 0
    // flam/drag graces sit before the stroke (the main onset never moves): 18-35 ms apart, 0.25-0.4 of the stroke
    const lk = channelId + voice, prevT = this.lastHit.get(lk) ?? -9; this.lastHit.set(lk, t)
    const g = Math.min(Math.max(0.018, Math.min(0.035, stepSec / 2)) * (hz && fl > 0 ? 1 + 0.2 * hh * fl : 1), 0.4 * Math.max(0, t - prevT) / Math.max(1, graces)) // never closer than 40% of the gap to the previous note
    for (let i = graces; i > 0; i--) inst.trigger(Math.max(0, t - g * i), vel * (0.325 + 0.075 * hh * fl))
    // hi-hat tip (off-beat 16ths, darker) vs shank (on the beat and the "&")
    const tip = !!hz && fl > 0 && (voice === 'tick' || voice === 'open') && hz.pos % (hz.beat / 2) !== 0
    const sp = this.sound, isSn = voice === 'back', isCr = voice === 'crash1' || voice === 'crash2'
    const isTom = voice === 'tomHi' || voice === 'tomMid' || voice === 'tomLo'
    const rate = (vr?.rate ?? 1) * ((isSn ? sp?.snare : isTom ? sp?.toms : isCr || voice === 'ride' ? sp?.cym : 1) ?? 1)
    const gate = (isSn ? sp?.snareGate : isTom ? sp?.tomGate : 0) ?? 0
    inst.trigger(t, vel, rate, isSn || isCr ? this.density(channelId + (isSn ? ':sn' : ':cr'), t, vel, isSn ? 1 : 2) : 1, gate, tip)
  }
  /** Tab grace notes for this step: soft strokes just before the onset, 18-35 ms apart and never closer than 40% of the gap to that drum's previous note. */
  private playGraces(ch: string, p: Pattern, step: number, t: number, stepSec: number, shift: (frac: number) => number) {
    for (const [voice, m] of Object.entries(p.grace!) as [Voice, Record<string, number>][]) for (const [k, n] of Object.entries(m)) {
      const [st, fr] = k.split(':'); if (Number(st) !== step) continue
      const f = fr ? fracOf(fr) : 0, at = t + f * stepSec + shift(f), inst = this.inst(ch, voice); if (!inst) continue
      const prevT = this.lastHit.get(ch + voice) ?? -9, g = Math.min(Math.max(0.018, Math.min(0.035, stepSec / 2)), 0.4 * Math.max(0, at - prevT) / n)
      const hh = hash(this.songBar, step + f, 11)
      for (let i = n; i > 0; i--) inst.trigger(Math.max(0, at - g * i), 0.26 + 0.04 * hh + (n - i) * 0.03) // a drag's second grace a touch louder
    }
  }
  /** Off-grid (sub-step) hits, grouped per drum. Only a real same-drum run (2+ off-grid strokes in the step, or one next to an
   *  on-step stroke of the same drum) gets roll shaping: softer inner strokes, hand alternation, crescendo and the small inner-stroke
   *  timing drift. A lone off-grid note (a syncopated 32nd kick, a triplet note) plays exactly, at its written velocity. */
  private playSubs(ch: string, p: Pattern, step: number, t: number, stepSec: number, bar: number, beat: number, tps: number, shift: (frac: number) => number, fl: number) {
    const subs = subHitsAt(p, step); if (!subs.length) return
    const onStep = new Set(hitsAt(p, step).map(h => h.voice)), by = new Map<Voice, typeof subs>()
    for (const h of subs) { const l = by.get(h.voice) ?? []; l.push(h); by.set(h.voice, l) }
    for (const [voice, l] of by) {
      l.sort((a, b) => a.frac - b.frac)
      const lead = onStep.has(voice), run = voice === 'back' && (l.length >= 2 || lead) // only snare runs are rolls; kick/tom 32nd figures play straight
      l.forEach((h, j) => {
        const at = t + h.frac * stepSec + shift(h.frac)
        if (!run) { this.hz = { bar, pos: (step + h.frac) * tps, beat, sub: -1, stroke: stepSec }; this.play(ch, voice, at, h.velocity, 0, stepSec); return }
        const prev = j ? l[j - 1].frac : lead ? 0 : h.frac - 1 / (l.length + 1), stroke = Math.max(0.001, (h.frac - prev) * stepSec)
        const idx = j + (lead ? 1 : 0) // stroke number in the run (0 = first)
        this.hz = { bar, pos: (step + h.frac) * tps, beat, sub: idx, n: l.length + (lead ? 1 : 0), stroke }
        const inner = idx > 0 // the run's first stroke stays exact
        this.play(ch, voice, at + (inner ? fl * rollJitter(bar, step, h.frac, stroke, idx) : 0), h.velocity, 0, stepSec) // dynamics: hand alternation in humanVel, no flat cut
      })
    }
  }
  /** Position of the hit being played (set by the scheduler), for velocity shaping. */
  private hz: HitCtx | null = null
  /** Velocity shaping (never timing): metric accents on hats/ride/kick, small deterministic per-hit variation plus a slow phrase drift,
   *  and for roll strokes hand alternation, a crescendo through the step, and more spread when strokes are very fast. Scaled by feel. */
  private humanVel(voice: Voice, vel: number, hz: HitCtx, fl: number) {
    const vi = VOICE_IDX[voice] ?? 0
    if (hz.sub < 0 && Math.abs(vel - 0.75) < 0.01) {
      const ib = hz.pos % hz.beat, a = hz.pos === 0 ? 1.04 : ib === 0 ? 1 : ib === hz.beat / 2 ? 0.9 : 0.8
      if (voice === 'tick' || voice === 'ride' || voice === 'open') vel *= 1 + (a - 1) * fl
      else if (voice === 'low') vel *= 1 + (0.94 + 0.06 * a - 1) * fl
    }
    let sp = vel < 0.45 ? 0.06 : voice === 'tick' || voice === 'ride' || voice === 'open' ? 0.04 : voice === 'back' || voice === 'low' ? 0.03 : 0.02
    if (hz.sub >= 0) {
      vel *= hz.sub % 2 === 1 ? 0.95 : 1.02 // alternating hands (about ±3%), not a flat cut
      const up = hash(hz.bar, Math.floor(hz.pos), 3) > -0.3, k = hz.sub / Math.max(1, (hz.n ?? 1) - 1) // mostly crescendo, sometimes decrescendo
      vel *= 0.92 + 0.08 * (up ? k : 1 - k)
      if (hz.stroke < 1 / 12) sp += 0.03 // fast strokes: less even
    }
    const drift = 0.03 * Math.sin(hz.bar * 0.37 + vi) + 0.02 * Math.sin(hz.bar * 0.11)
    return Math.max(0.02, Math.min(1, vel * (1 + fl * (drift + sp * hash(hz.bar, hz.pos, vi)))))
  }
  /** Groove drift (ms, 0 = off). Only hand-picked groove songs set it: the whole kit slowly pushes and pulls together (kick and crashes
   *  exactly on that shared curve), hands get a smaller slow extra of their own. Smooth sines over beats, never white noise. */
  drift = 0
  private driftAt(voice: Voice, beat: number) {
    if (!this.drift) return 0
    const c = 0.65 * Math.sin(beat * 0.19) + 0.35 * Math.sin(beat * 0.071 + 2)
    const hand = voice === 'low' || voice === 'crash1' || voice === 'crash2' ? 0 : 0.25 * Math.sin(beat * 0.43 + (VOICE_IDX[voice] ?? 0))
    return this.feel * this.drift / 1000 * (c + hand) / 1.25
  }
  /** Per-song sound profile (playback rate / gate on the existing samples). */
  sound: SoundProfile | null = null
  private dens = new Map<string, { t: number; lvl: number }>()
  private lastHit = new Map<string, number>()
  /** Repeated snare hits within an 8th note (crash: within a quarter) duck by up to ~4.5 dB (−1.5 dB per dense hit), then recover
   *  as hits space out. Single accents, normal backbeats and ghost notes (soft hits) are untouched. */
  private density(key: string, t: number, vel: number, win: number) {
    if (vel < 0.45 || (this.hz && this.hz.sub >= 0)) return 1 // ghosts and in-between (sub-step) strokes are never ducked
    const eighth = win * 30 / Tone.getTransport().bpm.getValueAtTime(t), d = this.dens.get(key) ?? { t: -9, lvl: 1 }
    const gap = t - d.t
    if (gap < 0) return d.lvl // out-of-order (same step, other source)
    const sn = key.endsWith(':sn'), sixteenth = 15 / Tone.getTransport().bpm.getValueAtTime(t)
    if (sn && gap < sixteenth * 0.9) { d.t = t; this.dens.set(key, d); return d.lvl } // a run faster than 16ths is a fill, not riding: no extra ducking
    d.lvl = gap <= eighth * 1.05 ? Math.max(sn ? 0.75 : 0.6, d.lvl * 0.84) : Math.min(1, d.lvl + (gap / eighth) * 0.1) // floor: snare -2.5 dB, crash -4.4 dB
    d.t = t; this.dens.set(key, d); return d.lvl
  }

  private applySection(bar: number, time: number) {
    if (!this.arrangement) return
    const { arr, resolve } = this.arrangement
    const total = arr.sections.reduce((a, s) => a + s.bars, 0)
    let b = bar % total, idx = 0
    while (b >= arr.sections[idx].bars) { b -= arr.sections[idx].bars; idx++ }
    if (b !== 0 && bar !== 0) return
    const pats = resolve(arr.sections[idx].patternIds)
    this.setLayers(pats.map((p, i) => ({ id: `arr-${i}`, pattern: p, volume: 0.85, mute: false, solo: false })))
    if (arr.sections[idx].crash && bar > 0) this.play(FX_ID, 'crash1', time, 0.9)
    Tone.getDraw().schedule(() => this.onSection?.(idx), time)
  }

  private inFill(bar: number) { return !!this.fill && this.fillEvery > 0 && !this.arrangement && bar % this.fillEvery === this.fillEvery - 1 }

  /** iOS Home Screen app: WebAudio normally stops when the app is backgrounded. Route the mix into a MediaStream played by an
   *  <audio playsinline> element (iOS treats that as media playback) and ask for the 'playback' audio session. Only on iOS, so other
   *  platforms keep the direct, lowest-latency output. Timing is unchanged (all hits keep their relative times); iOS may still suspend it. */
  private bgEl: HTMLAudioElement | null = null
  private backgroundAudio() {
    const nav = navigator as Navigator & { audioSession?: { type: string } }
    try { if (nav.audioSession) nav.audioSession.type = 'playback' } catch { /* unsupported */ }
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    if (!ios || this.bgEl) { void this.bgEl?.play().catch(() => {}); return }
    const raw = Tone.getContext().rawContext as AudioContext
    if (!raw.createMediaStreamDestination) return
    const dest = raw.createMediaStreamDestination()
    this.bus.disconnect(); Tone.connect(this.bus, dest)
    const el = document.createElement('audio'); el.setAttribute('playsinline', ''); el.srcObject = dest.stream; this.bgEl = el
    void el.play().catch(() => { this.bus.disconnect(); this.bus.toDestination(); this.bgEl = null }) // refused: back to the normal output, never silent
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && this.playing) { void Tone.getContext().resume(); void el.play().catch(() => {}) } })
  }
  async start() {
    await Tone.start()
    this.backgroundAudio()
    const tr = Tone.getTransport()
    if (this.eventId !== null) return
    this.tick = 0; this.bar = 0
    const tickLen = `${(tr.PPQ * 4) / TICKS_PER_BAR}i`
    this.songTick = 0
    this.lastTime = -1
    this.eventId = tr.scheduleRepeat(time => {
      // guards: never process the same instant twice (time must increase), and if the main thread stalled and Tone is
      // catching up on ticks that are already in the past, advance the counters silently instead of bursting notes
      if (!(time > this.lastTime)) return
      this.lastTime = time
      this.late = time < Tone.now() - 0.08
      if (this.song) { this.songStep(time, 5 / tr.bpm.getValueAtTime(time)); this.tick++; return } // one tick = 1/48 bar of 4/4 = 5/bpm s
      const BT = this.barTicks()
      const barStart = this.tick % BT === 0
      const fillBar = this.inFill(this.bar)
      if (barStart) {
        this.applySection(this.bar, time)
        if (this.fill?.crashAfter && this.fillEvery && this.bar > 0 && this.inFill(this.bar - 1)) this.play(FX_ID, 'crash1', time, 1)
        const bar = this.bar; Tone.getDraw().schedule(() => this.onBar?.(bar, fillBar), time)
      }
      const steps: Record<string, number> = {}
      const tickSec = Tone.Time(tickLen).toSeconds()
      const sources: { id: string; pattern: Pattern; tickBase: number }[] = fillBar
        ? [{ id: FILL_ID, pattern: this.fill!.pattern, tickBase: this.tick % BT }]
        : audibleLayers(this.layers).map(l => ({ id: l.id, pattern: l.pattern, tickBase: this.tick }))
      for (const s of sources) {
        const step = stepForTick(s.pattern, s.tickBase); if (step === null) continue
        steps[s.id] = step
        const stepSec = tickSec * ticksPerStep(s.pattern)
        const t = time + Math.min(0.6, swingOffset(s.pattern, step, this.swing) * this.feel) * stepSec // natural swing scaled by feel; 0.6 of a step = 4:1 at most
        const tp = ticksPerStep(s.pattern), bt = beatTicksOf(s.pattern)
        this.hz = { bar: this.bar, pos: step * tp, beat: bt, sub: -1, stroke: stepSec }
        for (const h of hitsAt(s.pattern, step)) this.play(s.id, h.voice, t, h.velocity, h.graces, stepSec)
        this.playSubs(s.id, s.pattern, step, t, stepSec, this.bar, bt, tp, () => 0, 1)
        this.hz = null
      }
      if (!fillBar) for (const l of this.layers) if (steps[l.id] === undefined) { const s = stepForTick(l.pattern, this.tick); if (s !== null) steps[l.id] = s }
      if (Object.keys(steps).length) { const bar = this.bar; Tone.getDraw().schedule(() => this.listeners.forEach(f => f(steps, bar)), time) }
      this.tick++
      if (this.tick % this.barTicks() === 0) this.bar++
    }, tickLen, 0)
    tr.start('+0.05')
  }

  stop() {
    const tr = Tone.getTransport()
    if (this.eventId !== null) tr.clear(this.eventId)
    this.eventId = null; tr.stop(); tr.position = 0
    this.listeners.forEach(f => f({}, 0))
    // Stop: fade everything out quickly, then silence what's still ringing and restore levels.
    const now = Tone.now()
    for (const c of this.channels.values()) {
      const g = c.gain.gain, v = g.getValueAtTime(now)
      g.cancelScheduledValues(now); g.setValueAtTime(v, now); g.linearRampToValueAtTime(0, now + 0.15)
      for (const i of Object.values(c.insts)) i?.choke?.(now + 0.16)
      g.setValueAtTime(v, now + 0.2)
    }
  }
  get playing() { return this.eventId !== null }
}
