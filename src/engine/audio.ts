import * as Tone from 'tone'
import type { Kit, KitVoice, Layer, Voice, Arrangement, Pattern, Fill } from './types'
import { TICKS_PER_BAR, hitsAt, stepForTick, swingOffset, audibleLayers, ticksPerStep , subHitsAt, VARIANTS, fracOf } from './pattern'

type Inst = { trigger: (t: number, v: number, r?: number) => void; choke?: (t: number) => void; dispose: () => void }

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

function makeInst(kv: KitVoice, out: Tone.ToneAudioNode): Inst {
  const g = new Tone.Gain(kv.gain ?? 1).connect(out)
  if (kv.kind !== 'sample') { const s = makeSynth(kv, g); return { ...s, dispose: () => { s.dispose(); g.dispose() } } }
  const layers = kv.layers ?? []
  layers.forEach(l => l.files.forEach(loadFile))
  const fb = kv.fallback ? makeSynth(kv.fallback, g) : null
  const rr = layers.map(() => 0)
  const live = new Set<Tone.ToneBufferSource>()
  return {
    trigger: (t, v, r = 1) => {
      let li = layers.findIndex(l => v <= l.vel + 1e-6); if (li < 0) li = layers.length - 1
      const files = layers[li].files, f = files[rr[li]++ % files.length]
      const buf = buffers.get(f)
      if (!buf) { fb?.trigger(t, v, r); return }
      const lo = li ? layers[li - 1].vel : 0
      const rel = (v - lo) / Math.max(0.01, layers[li].vel - lo) // position within layer
      const src = new Tone.ToneBufferSource(buf).connect(g)
      const wob = 1 + ((rr[li] * 0.61803) % 1 - 0.5) * 0.016 // ±0.8% pitch per stroke
      src.playbackRate.value = (kv.rate ?? 1) * r * wob
      src.onended = () => { live.delete(src); src.dispose() }
      live.add(src)
      src.start(t, 0, undefined, 0.55 + 0.45 * Math.min(1, rel))
    },
    choke: t => { live.forEach(s => { try { s.stop(t + 0.01) } catch { /* already stopped */ } }); fb?.choke?.(t) },
    dispose: () => { fb?.dispose(); g.dispose() },
  }
}

interface Channel { gain: Tone.Gain; insts: Partial<Record<Voice, Inst>> }
export type StepListener = (layerSteps: Record<string, number>, bar: number) => void
const FILL_ID = 'fill', FX_ID = 'fx', SONG_ID = 'song'
/** Inner roll strokes (between grid steps) are played softer than the stroke on the step, like real sticking:
 *  the middle of a 32nd pair a bit firmer than triplet inner strokes. */
const rollVel = (v: number, frac: number) => Math.min(1, v * (Math.abs(frac - 0.5) < 0.01 ? 0.8 : 0.72))
/** Deterministic ±0.8 ms drift (kept under the 1 ms timing-audit tolerance) on inner roll strokes so rolls aren't machine-perfect. */
const rollJitter = (bar: number, step: number, frac: number) => { const x = Math.sin((bar * 131 + step * 17 + frac * 7) * 12.9898) * 43758.5453; return ((x - Math.floor(x)) * 2 - 1) * 0.0008 }
/** Visual hit bus: Kit view subscribes; callbacks fire via Tone.Draw at the hit's audio time. */
export const hitBus = new Set<(voice: Voice, vel: number, variant?: string) => void>()

/** Thin Tone.js wrapper. All timing runs on Tone.Transport at a 48-tick-per-bar grid. */
export class RhythmEngine {
  private layers: Layer[] = []
  private channels = new Map<string, Channel>()
  private kit!: Kit
  private swing = 0
  private tick = 0
  private bar = 0
  private eventId: number | null = null
  private listeners = new Set<StepListener>()
  private master = new Tone.Gain(0.8).connect(new Tone.Compressor({ threshold: -14, ratio: 3, attack: 0.005, release: 0.15 }).toDestination())
  private arrangement: { arr: Arrangement; resolve: (ids: string[]) => Pattern[] } | null = null
  private fill: Fill | null = null
  private fillEvery = 0
  onSection?: (index: number) => void
  /** Song-form mode: a flat list of one-bar patterns played in order. */
  private song: { bars: Pattern[]; loop: [number, number] | null } | null = null
  private songBar = 0
  private songTick = 0
  private pendingJump: number | null = null
  onSongBar?: (bar: number) => void
  setSong(bars: Pattern[] | null) { this.song = bars ? { bars, loop: null } : null; this.songBar = 0; this.songTick = 0; this.pendingJump = null }
  setSongLoop(loop: [number, number] | null) { if (this.song) this.song.loop = loop }
  /** Jump to a bar: immediately if stopped, otherwise at the next bar line. */
  jumpSong(bar: number, onBeat = false) { if (!this.playing) { this.songBar = bar; this.songTick = 0 } else if (onBeat) this.pendingBeatJump = bar; else this.pendingJump = bar }
  /** Bar to restart at on the next beat (12 ticks = one quarter), set by section taps. */
  private pendingBeatJump: number | null = null
  private songStep(time: number, tickSec: number) {
    if (this.pendingBeatJump !== null && this.songTick % 12 === 0) { this.songBar = this.pendingBeatJump; this.songTick = 0; this.pendingBeatJump = null; this.pendingJump = null }
    const song = this.song!; const p = song.bars[this.songBar]; const tps = ticksPerStep(p); const len = p.steps * tps
    if (this.songTick === 0) {
      const b = this.songBar; Tone.getDraw().schedule(() => this.onSongBar?.(b), time)
      // tempo map: each bar may carry its own tempo; change it exactly on the bar line
      if (p.suggestedBpm && Math.abs(Tone.getTransport().bpm.getValueAtTime(time) - p.suggestedBpm) > 0.01) Tone.getTransport().bpm.setValueAtTime(p.suggestedBpm, time)
    }
    if (p.tempoAt) for (const [f, bpm] of p.tempoAt) { const at = fracOf(f) * len; if (this.songTick === Math.ceil(at - 1e-9)) Tone.getTransport().bpm.setValueAtTime(bpm, time - (Math.ceil(at - 1e-9) - at) * tickSec) }
    if (this.songTick % tps === 0) {
      const step = this.songTick / tps; const stepSec = tickSec * tps
      let t = time + swingOffset(p, step, this.swing) * stepSec
      if (p.humanize) { const r = Math.sin((this.songBar * 97 + step) * 12.9898) * 43758.5453; t += (p.humanize.lateMs + ((r - Math.floor(r)) * 2 - 1) * p.humanize.jitterMs) / 1000 }
      for (const h of hitsAt(p, step)) this.play(SONG_ID, h.voice, t, h.velocity, h.graces, stepSec, p.variant?.[h.voice]?.[step])
      for (const h of subHitsAt(p, step)) this.play(SONG_ID, h.voice, t + h.frac * stepSec + rollJitter(this.songBar, step, h.frac), rollVel(h.velocity, h.frac), 0, stepSec)
      const b = this.songBar; Tone.getDraw().schedule(() => this.listeners.forEach(f => f({ [SONG_ID]: step }, b)), time)
    }
    if (++this.songTick >= len) {
      this.songTick = 0
      let next = this.pendingJump ?? this.songBar + 1; this.pendingJump = null
      if (song.loop && next >= song.loop[1]) next = song.loop[0]
      if (next >= song.bars.length) next = 0
      this.songBar = next
    }
  }
  onBar?: (bar: number, inFill: boolean) => void

  setKit(kit: Kit) { this.kit = kit; for (const c of this.channels.values()) this.clearInsts(c) }
  setSwing(s: number) { this.swing = s }
  setBpm(bpm: number) { Tone.getTransport().bpm.rampTo(bpm, 0.05) }
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
    return (c.insts[v] ??= makeInst(this.kit.voices[v], c.gain))
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
    this.trace?.push({ t, src: channelId, voice, bar: this.bar, variant })
    const vr = variant ? VARIANTS[variant] : undefined
    if (vr?.voice) voice = vr.voice
    vel = Math.min(1, vel * (vr?.gain ?? 1))
    const inst = this.inst(channelId, voice); if (!inst) return
    if (hitBus.size) { const v0 = voice, vv = vel; Tone.getDraw().schedule(() => hitBus.forEach(f => f(v0, vv, variant)), t) }
    if (voice === 'tick' || voice === 'pedal') this.channels.get(channelId)?.insts.open?.choke?.(t)
    const g = Math.max(0.025, Math.min(0.03, stepSec / 2)) // flam/drag grace spacing: 25-30 ms
    for (let i = graces; i > 0; i--) inst.trigger(Math.max(0, t - g * i), vel * 0.35)
    inst.trigger(t, vel, vr?.rate ?? 1)
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

  async start() {
    await Tone.start()
    const tr = Tone.getTransport()
    if (this.eventId !== null) return
    this.tick = 0; this.bar = 0
    const tickLen = `${(tr.PPQ * 4) / TICKS_PER_BAR}i`
    this.songTick = 0
    this.eventId = tr.scheduleRepeat(time => {
      if (this.song) { this.songStep(time, Tone.Time(tickLen).toSeconds()); this.tick++; return }
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
        const t = time + swingOffset(s.pattern, step, this.swing) * stepSec
        for (const h of hitsAt(s.pattern, step)) this.play(s.id, h.voice, t, h.velocity, h.graces, stepSec)
        for (const h of subHitsAt(s.pattern, step)) this.play(s.id, h.voice, t + h.frac * stepSec + rollJitter(this.bar, step, h.frac), rollVel(h.velocity, h.frac), 0, stepSec)
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
