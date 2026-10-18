import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { RhythmEngine, preloadKit, setSampleBase, sampleAlign, type PulseEvent } from '../engine/audio'
import type { Arrangement, ArrangementPos, Fill, Layer, Pattern, SectionIndex, Voice } from '../engine/types'
import { VOICES, sectionIndex } from '../engine/types'
import { KitView } from './kitview'
import { velocityOf, ticksPerStep, VARIANTS, fracOf } from '../engine/pattern'
import { KITS } from '../data/kits'
import { PATTERNS, RHYTHMS } from '../data/rhythms'
import { FILLS, FILL_EVERY } from '../data/fills'
import { SONGS, loadSongBars, shownBpm, type Song } from '../data/songs'
import * as Tone from 'tone'
import { applyTuning, applyShift, type Tuning } from '../engine/pitch'
import { forgetPractice } from '../learn/memory'
import { LearnPanel } from './learn'
import { cleanSectionName } from '../data/sectionName'

setSampleBase(`${import.meta.env.BASE_URL}samples/acoustic/`)
export const ALL_FILLS: Fill[] = [...FILLS, ...SONGS.flatMap(s => s.fills.map(f => ({ ...f, category: 'Song fills' })))]

interface Ctx {
  layers: Layer[]; playing: boolean; bpm: number; swing: number; feel: number; setFeel: (f: number) => void; kitId: string; arrangementPos: ArrangementPos | null; arrangement: Arrangement | null
  tuning: Tuning; setTuning: (t: Tuning) => void
  fillId: string | null; fillEvery: number; setFill: (id: string | null, every?: number) => void; inFill: boolean
  kitProgress: number // 0..1 sample loading
  load: (p: Pattern, add?: boolean) => void
  /** Play `a` from the start of section `from` (default 0).
   *  Already playing this arrangement: seek on the next beat, keep the current tempo.
   *  Otherwise load `a` (tempo becomes a.bpm, song and layers cleared) and start there. */
  playArrangement: (a: Arrangement, from?: SectionIndex) => Promise<void>
  update: (id: string, patch: Partial<Layer>) => void
  remove: (id: string) => void
  toggle: () => Promise<void>; setBpm: (n: number) => void; setSwing: (n: number) => void; setKit: (id: string) => void
  subscribe: RhythmEngine['subscribe']
  /** the song step being heard right now (audio clock, output latency included) */
  songPos: (ahead?: number) => { bar: number; step: number } | null
  song: Song | null; songBar: number; loopSection: number | null
  /** bar-range loop: loopMode on = bar taps pick [start, end] (inclusive, 0-based song bars) */
  loopMode: boolean; setLoopMode: (on: boolean) => void; barLoop: [number, number] | null; loopPick: number | null; pickBar: (n: number) => void; clearBarLoop: () => void
  loadSong: (s: Song, section?: number) => Promise<void>; queue: Song[]; enqueue: (s: Song) => void; unqueue: (i: number) => void; next: () => Promise<void>; shuffle: (pool: Song[]) => Promise<void>; playRange: (s: Song, start: number, end: number) => Promise<void>; jumpBar: (bar: number, onBeat?: boolean) => void; jumpSection: (i: number) => void; setLoopSection: (i: number | null) => void
  /** Bumps when a song is loaded, so Learn it can start clean. */
  loadId: number
  learn: {
    voices: (v: Voice[] | null) => void
    bars: (m: Map<number, Pattern> | null) => void
    metronome: (on: boolean) => void
    countIn: (on: boolean) => void
    onPulse: (fn: ((e: PulseEvent) => void) | null) => void
    onBar: (fn: ((bar: number, yours: boolean) => void) | null) => void
    /** "I play, you play": every other bar is the click alone */
    callResponse: (on: boolean) => void
    /** spoken count: song bar → syllable per grid step, or null for off */
    count: (words: Map<number, string[]> | null) => void
    /** read-only: the engine's heard-step timeline and the audio context, for scoring a connected kit */
    clock: () => { timeline: RhythmEngine['timeline']; ctx: AudioContext }
  }
}
export const sectionOf = (s: Song, bar: number) => Math.max(0, s.sections.findIndex(x => bar >= x.start && bar < x.start + x.bars))
const C = createContext<Ctx>(null!)
export const usePlayer = () => useContext(C)
let n = 0

/** Feel is fixed at 160% everywhere (Garrett): harder swing (still capped at 4:1) and a looser human touch. */
const FEEL = 0.9
export function PlayerProvider({ children }: { children: ReactNode }) {
  const eng = useRef<RhythmEngine>()
  const [layers, setLayers] = useState<Layer[]>([])
  const [playing, setPlaying] = useState(false)
  const [bpm, setBpmS] = useState(100)
  const [swing, setSwingS] = useState(0)
  const [feel, setFeelS] = useState(FEEL)
  const [kitId, setKitId] = useState('acoustic')
  const [queue, setQueue] = useState<Song[]>([])
  const live = useRef<Ctx | null>(null) // latest context, for engine callbacks
  const [arrangement, setArr] = useState<Arrangement | null>(null)
  const [arrangementPos, setArrPos] = useState<ArrangementPos | null>(null)
  const [tuning, setTuning] = useState<Tuning>({})
  const [fillId, setFillId] = useState<string | null>(null)
  const [fillEvery, setFillEvery] = useState(4)
  const [inFill, setInFill] = useState(false)
  const [kitProgress, setKitProgress] = useState(0)
  const [song, setSong] = useState<Song | null>(null)
  const [songBar, setSongBar] = useState(0)
  const [loopSection, setLoopS] = useState<number | null>(null)
  const [loopMode, setLoopModeS] = useState(false), [barLoop, setBarLoop] = useState<[number, number] | null>(null), [loopPick, setLoopPick] = useState<number | null>(null)
  const [loadId, setLoadId] = useState(0)
  const clearBars = () => { setBarLoop(null); setLoopPick(null) }

  const e = useCallback(() => {
    if (!eng.current) {
      eng.current = new RhythmEngine(); eng.current.setKit(KITS[0]); eng.current.setFeel(FEEL); eng.current.onArrangementPos = setArrPos
      eng.current.onBar = (_b, f) => setInFill(f); eng.current.onSongBar = setSongBar
      eng.current.onSongEnd = () => { if (live.current?.queue.length) void live.current.next() }
      ;(window as unknown as { __pulseEngine?: RhythmEngine; __pulseAlign?: typeof sampleAlign }).__pulseEngine = eng.current; (window as unknown as { __pulseAlign?: typeof sampleAlign }).__pulseAlign = sampleAlign
    }
    return eng.current
  }, [])

  useEffect(() => { if (!arrangement && !song) e().setLayers(layers) }, [layers, arrangement, song, e])
  useEffect(() => {
    const kit = KITS.find(k => k.id === kitId)!
    e().setKit(applyShift(applyTuning(kit, tuning), song?.raw.tuning?.shift as Partial<Record<Voice, number>> | undefined))
  }, [kitId, tuning, song, e])
  useEffect(() => { e().setFill(ALL_FILLS.find(f => f.pattern.id === fillId) ?? null, fillId ? fillEvery : 0) }, [fillId, fillEvery, e])

  const resetPractice = useCallback((songId?: string) => { e().clearPractice(); if (songId) forgetPractice(songId); setLoadId(n => n + 1) }, [e])
  const learnVoices = useCallback((v: Voice[] | null) => { e().practiceVoices = v ? new Set(v) : null }, [e])
  const learnBars = useCallback((m: Map<number, Pattern> | null) => { e().practiceBars = m }, [e])
  const learnMetronome = useCallback((on: boolean) => { e().metronome = on }, [e])
  const learnCountIn = useCallback((on: boolean) => { e().countInOn = on }, [e])
  const learnOnPulse = useCallback((fn: ((ev: PulseEvent) => void) | null) => { e().onPulse = fn ?? undefined }, [e])
  const learnOnBar = useCallback((fn: ((bar: number, yours: boolean) => void) | null) => { e().onLearnBar = fn ?? undefined }, [e])
  const learnCallResponse = useCallback((on: boolean) => { e().setCallResponse(on) }, [e])
  const learnCount = useCallback((w: Map<number, string[]> | null) => { e().setCount(w) }, [e])
  const learnClock = useCallback(() => ({ timeline: e().timeline, ctx: e().rawCtx() }), [e])
  const learn = useMemo(() => ({ voices: learnVoices, bars: learnBars, metronome: learnMetronome, countIn: learnCountIn, onPulse: learnOnPulse, onBar: learnOnBar, count: learnCount, callResponse: learnCallResponse, clock: learnClock }), [learnCallResponse, learnVoices, learnBars, learnMetronome, learnCountIn, learnOnPulse, learnOnBar, learnCount, learnClock])

  const preload = useCallback((id: string) => {
    const kit = KITS.find(k => k.id === id)!
    if (!Object.values(kit.voices).some(v => v.kind === 'sample')) { setKitProgress(1); return }
    void preloadKit(kit, (d, t) => setKitProgress(d / t))
  }, [])

  const value = useMemo<Ctx>(() => ({
    layers, playing, bpm, swing, feel, setFeel: (f: number) => { setFeelS(f); e().setFeel(f) }, kitId, arrangementPos, arrangement, tuning, setTuning, fillId, fillEvery, inFill, kitProgress,
    setFill: (id, every) => { setFillId(id); if (every !== undefined) setFillEvery(every) },
    song, songBar, loopSection,
    loopMode, barLoop, loopPick,
    setLoopMode: on => { setLoopModeS(on); if (!on && barLoop) e().setSongLoop(null); clearBars() },
    clearBarLoop: () => { if (barLoop) e().setSongLoop(null); clearBars() },
    pickBar: n => {
      if (loopPick === null) { setLoopPick(n); return }
      const a = Math.min(loopPick, n), b = Math.max(loopPick, n); setLoopPick(null); setBarLoop([a, b]); setLoopS(null)
      const en = e(); en.setSongLoop([a, b + 1])
      if (en.playing) { if (songBar < a || songBar > b) { void en.wake(); en.jumpSong(a, true) } } else { en.jumpSong(a); setSongBar(a) }
    },
    queue,
    enqueue: sg => setQueue(q => [...q, sg]),
    unqueue: i => setQueue(q => q.filter((_, j) => j !== i)),
    next: async () => {
      const q = live.current?.queue ?? []; if (!q.length) return
      const [sg, ...rest] = q; setQueue(rest)
      await live.current!.loadSong(sg); await live.current!.toggle()
    },
    // play a random song now and queue 4 more (no repeats)
    shuffle: async pool => {
      const a = [...pool]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
      const [first, ...rest] = a.slice(0, 5); if (!first) return
      setQueue(rest); await live.current!.loadSong(first); if (!live.current!.playing) await live.current!.toggle()
    },
    loadSong: async (sg, sec) => {
      await loadSongBars(sg)
      const en = e(); en.stop(); setPlaying(false); en.setArrangement(null); en.sound = null; en.drift = 0; setArr(null); setArrPos(null); setLayers([]); clearBars(); resetPractice(sg.raw.id)
      en.setSong(sg.bars); en.sound = sg.raw.sound ?? null; en.drift = sg.raw.drift ?? 0; const st = sec === undefined ? (sg.raw.firstDrumBar ?? 0) : (sg.sections[sec]?.start ?? 0); en.jumpSong(st); setSong(sg); setSongBar(st); setLoopS(null); setSwingS(0); en.setSwing(0);
      setBpmS(sg.raw.bpm); en.setSongBaseBpm(sg.raw.bpm)
    },
    /** Play bars [start, end) of a song (0-based), looping that range. */
    playRange: async (sg, a, b) => {
      await loadSongBars(sg)
      const en = e(); en.stop(); setPlaying(false); en.setArrangement(null); en.sound = null; en.drift = 0; setArr(null); setArrPos(null); setLayers([]); resetPractice(sg.raw.id)
      const n = sg.bars.length; const st = Math.max(0, Math.min(a, n - 1)), end = Math.max(st + 1, Math.min(b, n))
      en.setSong(sg.bars); en.sound = sg.raw.sound ?? null; en.drift = sg.raw.drift ?? 0; en.jumpSong(st); setSong(sg); setSongBar(st); setLoopS(null); setSwingS(0); en.setSwing(0);
      setBpmS(sg.raw.bpm); en.setSongBaseBpm(sg.raw.bpm); en.setSongLoop([st, end])
      preload(kitId); await en.start(); setPlaying(true)
    },
    jumpBar: (b, onBeat) => { void e().wake(); e().jumpSong(b, onBeat); if (!e().playing) setSongBar(b) },
    jumpSection: i => { if (!song) return; const st = song.sections[i].start; void e().wake(); e().jumpSong(st, true); if (!e().playing) setSongBar(st)
      if (loopSection !== null && loopSection !== i) { setLoopS(i); e().setSongLoop([st, st + song.sections[i].bars]) } },
    setLoopSection: i => { setLoopS(i); clearBars(); e().setSongLoop(i === null || !song ? null : [song.sections[i].start, song.sections[i].start + song.sections[i].bars]) },
    load: (p, add) => {
      resetPractice(); e().setSong(null); e().sound = null; e().drift = 0; setSong(null)
      e().setArrangement(null); setArr(null); setArrPos(null)
      const l: Layer = { id: `l${n++}`, pattern: p, volume: 0.85, mute: false, solo: false }
      setLayers(prev => (add ? [...prev, l] : [l]))
      if (!add && p.suggestedBpm) { setBpmS(p.suggestedBpm); e().setBpm(p.suggestedBpm) }
      if (!add) { const s = p.suggestedSwing ?? 0; setSwingS(s); e().setSwing(s) }
    },
    playArrangement: async (a, from) => {
      const en = e()
      const target = from ?? sectionIndex(0, a.sections.length)!
      if (arrangement?.id === a.id && en.playing) { void en.wake(); en.seekArrangement(target); return }
      resetPractice(); en.setSong(null); en.sound = null; en.drift = 0; setSong(null)
      setArr(a); setBpmS(a.bpm); en.setBpm(a.bpm); setLayers([]); setArrPos(null)
      en.stop(); en.setArrangement(a, ids => ids.map(id => PATTERNS[id]))
      en.seekArrangement(target)
      preload(kitId); await en.start(); setPlaying(true)
    },
    update: (id, patch) => setLayers(ls => ls.map(l => (l.id === id ? { ...l, ...patch } : l))),
    remove: id => setLayers(ls => ls.filter(l => l.id !== id)),
    toggle: async () => {
      const en = e()
      if (en.playing) { en.stop(); setPlaying(false); setArrPos(null); setInFill(false); if (song) { en.jumpSong(songBar) } }
      else { preload(kitId); await en.start(); setPlaying(true) }
    },
    setBpm: v => { setBpmS(v); e().setBpm(v) },
    setSwing: v => { setSwingS(v); e().setSwing(v) },
    setKit: id => { setKitId(id); setKitProgress(0); preload(id) },
    subscribe: l => e().subscribe(l),
    songPos: ahead => e().songPos(ahead),
    loadId, learn,
  }), [layers, playing, bpm, swing, feel, kitId, arrangementPos, arrangement, tuning, fillId, fillEvery, inFill, kitProgress, song, songBar, loopSection, e, preload, queue, loopMode, barLoop, loopPick, loadId, learn, resetPractice])
  live.current = value
  // Lock screen / Control Center: song title and artist, play/pause and next (the queue)
  useEffect(() => {
    const ms = navigator.mediaSession; if (!ms) return
    ms.metadata = new MediaMetadata({ title: song?.raw.song ?? 'Pulse', artist: song ? `${song.raw.artist} · ${song.raw.drummer}` : 'Rhythm practice',
      artwork: [{ src: `${import.meta.env.BASE_URL}icons/icon-512.png`, sizes: '512x512', type: 'image/png' }] })
    ms.playbackState = playing ? 'playing' : 'paused'
    ms.setActionHandler('play', () => { if (!live.current?.playing) void live.current?.toggle(); else void e().wake() })
    ms.setActionHandler('pause', () => { if (live.current?.playing) void live.current?.toggle() })
    try { ms.setActionHandler('nexttrack', queue.length ? () => { void live.current?.next() } : null) } catch { /* unsupported */ }
  }, [song, playing, queue.length])
  useEffect(() => { (window as unknown as { __pulseLoadSong?: (id: string, sec?: number) => Promise<void> }).__pulseLoadSong = async (id, sec) => { const sg = SONGS.find(x => x.raw.id === id); if (sg) await value.loadSong(sg, sec) } }, [value])
  useEffect(() => { (window as unknown as { __pulseSetKit?: (id: string) => void }).__pulseSetKit = value.setKit }, [value]) // used by tests
  useEffect(() => { (window as unknown as { __pulseLoadPattern?: (id: string) => boolean }).__pulseLoadPattern = id => { const pt = Object.values(PATTERNS).find(x => x.id === id || x.id.endsWith('-' + id)); if (pt) value.load(pt, false); return !!pt } }, [value]) // used by tests
  return <C.Provider value={value}>{children}</C.Provider>
}

// ---------- shared pieces ----------

export function LoadButtons({ pattern }: { pattern: Pattern }) {
  const { load, layers, toggle, playing } = usePlayer()
  const active = layers.some(l => l.pattern.id === pattern.id)
  return (
    <div className="flex items-center gap-2 mt-4">
      <button className="btn-primary" onClick={async () => { load(pattern); if (!playing) await toggle() }}>
        <PlayGlyph /> Play
      </button>
      <button className="btn-ghost" onClick={() => load(pattern, true)}>{active ? 'Add again' : 'Add layer'}</button>
      {pattern.suggestedBpm && <span className="ml-auto text-[13px] text-mute tabular-nums" title={pattern.bpmNote}>{pattern.suggestedBpm} BPM</span>}
    </div>
  )
}
const PlayGlyph = () => <span className="inline-block w-0 h-0 border-y-[5px] border-y-transparent border-l-[8px] border-l-current" />

const VOICE_LABEL: Record<Voice, string> = {
  crash1: 'Crash', crash2: 'Crash 2', china: 'China', ride: 'Ride', rideBell: 'Bell', open: 'Open HH', tick: 'Hi-hat', pedal: 'Pedal HH',
  tomHi: 'Tom 1', tomMid: 'Tom 2', tomLo: 'Floor', back: 'Snare', accent: 'Rim', low: 'Kick', bell: 'Cowbell', shaker: 'Shaker',
}

/** Velocity-aware step grid. Rows = voices used, bars show velocity, playhead column glows. */
export function StepGrid({ pattern, current }: { pattern: Pattern; current: number }) {
  const rows = VOICES.filter(v => pattern.tracks[v] || pattern.sub?.[v])
  const dense = pattern.steps > 16
  return (
    <div className={`mt-3 ${dense ? 'overflow-x-auto -mx-1 px-1' : ''}`}>
      <div className="space-y-1" style={{ minWidth: dense ? pattern.steps * 11 : undefined }}>
        {rows.map(v => (
          <div key={v} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[13px] text-mute">{VOICE_LABEL[v]}</span>
            <div className="flex-1 flex gap-[2px]">
              {Array.from({ length: pattern.steps }, (_, i) => {
                const c = pattern.tracks[v]?.[i]; const vel = velocityOf(c)
                const beat = i % pattern.stepsPerBeat === 0 && i > 0
                return (
                  <span key={i} className={`relative flex-1 h-5 rounded-[3px] overflow-hidden ${beat ? 'ml-[3px]' : ''} ${i === current ? 'bg-amber/25' : 'bg-white/[0.04]'}`}>
                    {vel > 0 && <span className={`absolute inset-x-0 bottom-0 rounded-[3px] transition-transform duration-100 ${i === current ? 'bg-amber scale-y-110' : 'bg-bone/70'}`} style={{ height: `${Math.round(25 + vel * 75)}%` }} />}
                    {(c === 'f' || c === 'r') && <span className="absolute top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-ink" />}
                    {pattern.variant?.[v]?.[String(i)] && <span title={VARIANTS[pattern.variant[v]![String(i)]]?.label} className="absolute inset-x-0 bottom-0 grid place-items-center text-[7px] leading-none font-semibold text-ink/75" style={{ height: `max(8px, ${vel > 0 ? Math.round(25 + vel * 75) : 100}%)` }}>{VARIANTS[pattern.variant[v]![String(i)]]?.short}</span>}
                    {pattern.sub?.[v]?.[String(i)]?.map(([fr, sv], j) => <span key={j} className={`absolute bottom-0 w-[2px] rounded-full ${i === current ? 'bg-amber' : 'bg-bone/80'}`} style={{ left: `${fracOf(fr) * 100}%`, height: `${Math.round(25 + sv * 75)}%` }} />)}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** The song bar and step being heard now, read each frame from the audio clock (output latency included).
 *  What is drawn now reaches the screen at the next refresh, somewhere in the frame after it, so it looks 1.5 frames ahead:
 *  the switch lands within half a frame of the sound instead of up to a whole frame late.
 *  `barOnly` re-renders only when the bar changes. An inactive caller runs no frame loop. */
export function useHeardPos(barOnly = false, active = true) {
  const { playing, songPos } = usePlayer()
  const [heard, setHeard] = useState<{ bar: number; step: number } | null>(null)
  useEffect(() => {
    if (!playing || !active) { setHeard(null); return }
    let raf = 0, last = 0, frame = 1 / 60, cur: { bar: number; step: number } | null = null
    const tick = (ts: number) => {
      if (last) frame = Math.min(0.05, frame * 0.9 + (ts - last) / 1000 * 0.1)
      last = ts
      const h = songPos(frame * 1.5)
      if (h?.bar !== cur?.bar || (!barOnly && h?.step !== cur?.step)) { cur = h && { bar: h.bar, step: h.step }; flushSync(() => setHeard(cur)) }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, songPos, barOnly, active])
  return heard
}

function useStep(id: string) {
  const { subscribe } = usePlayer()
  const [cur, setCur] = useState(-1)
  useEffect(() => subscribe(s => { if (!Object.keys(s).length) setCur(-1); else if (s[id] !== undefined) setCur(s[id]) }), [subscribe, id])
  return cur
}

function LayerCard({ layer }: { layer: Layer }) {
  const P = usePlayer()
  const cur = useStep(layer.id)
  const dim = P.layers.some(l => l.solo) ? !layer.solo : layer.mute
  return (
    <div className={`card transition-opacity duration-200 ${dim ? 'opacity-40' : ''}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-medium truncate">{layer.pattern.name}</div>
          <div className="text-[13px] text-mute tabular-nums">{layer.pattern.steps} steps · {(layer.pattern.steps * ticksPerStep(layer.pattern)) / 12} beats</div>
        </div>
        <button aria-pressed={layer.mute} onClick={() => P.update(layer.id, { mute: !layer.mute })} className={`chip-sq ${layer.mute ? 'bg-bone text-ink' : ''}`}>M</button>
        <button aria-pressed={layer.solo} onClick={() => P.update(layer.id, { solo: !layer.solo })} className={`chip-sq ${layer.solo ? 'bg-amber text-ink' : ''}`}>S</button>
        <button aria-label="Remove layer" onClick={() => P.remove(layer.id)} className="chip-sq bg-transparent text-mute">✕</button>
      </div>
      <StepGrid pattern={layer.pattern} current={cur} />
      <input type="range" min={0} max={1} step={0.01} value={layer.volume} onChange={e => P.update(layer.id, { volume: +e.target.value })} className="slider mt-3" aria-label="Layer volume" />
    </div>
  )
}

function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex p-0.5 rounded-full bg-white/[0.05] max-w-full">
      {options.map(o => <button key={String(o.v)} onClick={() => onChange(o.v)} className={`h-9 px-2.5 rounded-full text-[13px] whitespace-nowrap transition-all duration-200 ${value === o.v ? 'bg-bone text-ink shadow' : 'text-bone/60'}`}>{o.l}</button>)}
    </div>
  )
}

export function meterOf(p: Pattern): string {
  if (p.timeSig) return p.timeSig
  const t = p.steps * ticksPerStep(p)
  if (t === 48) return p.stepsPerBeat === 3 || p.stepsPerBeat === 6 ? '12/8' : '4/4'
  if (t === 36) return p.stepsPerBeat === 3 ? '9/8' : '3/4'
  if (t === 24) return p.stepsPerBeat === 3 ? '6/8' : '2/4'
  if (t === 60) return '5/4'
  if (t === 96) return '4/4 ×2'
  return t % 6 === 0 ? `${t / 6}/8` : `${t}/12`
}
interface Item { id: string; name: string; cat: string; meter: string; bpm?: number; pattern?: Pattern; song?: Song }
function useCatalog(): Item[] {
  return useMemo(() => {
    const out: Item[] = []
    for (const r of RHYTHMS) out.push({ id: r.pattern.id, name: r.pattern.name, cat: r.family, meter: meterOf(r.pattern), bpm: r.pattern.suggestedBpm, pattern: r.pattern })
    for (const sg of SONGS) out.push({ id: `song:${sg.raw.id}`, name: sg.raw.song, cat: sg.raw.category === 'Journeys' ? 'Journeys' : 'Songs', meter: sg.raw.timeSig, bpm: shownBpm(sg, sg.raw.bpm), song: sg, pattern: sg.pattern })
    return out
  }, [])
}

/** Searchable list of every rhythm and song. ▶ replaces, + stacks a layer. */
function Browser({ onPicked }: { onPicked?: () => void }) {
  const P = usePlayer(); const all0 = useCatalog()
  // Trance & pulse sits last here too, matching Styles; journeys belong to Story, not the song list
  const all = useMemo(() => [...all0.filter(i => i.cat !== 'Trance & pulse'), ...all0.filter(i => i.cat === 'Trance & pulse')].filter(i => !i.song || (!!i.song.raw.transcription && !i.song.raw.id.startsWith('j-') && !/Traditional/i.test(i.song.raw.artist) && !/\(reference\)|generic/i.test(i.song.raw.song))), [all0])
  const [q, setQ] = useState(''); const [cat, setCat] = useState(''); const [meter, setMeter] = useState('')
  const cats = useMemo(() => [...new Set(all.map(i => i.cat))], [all])
  const meters = useMemo(() => [...new Set(all.map(i => i.meter))].sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b)), [all])
  const ql = q.trim().toLowerCase()
  const items = all.filter(i => (!cat || i.cat === cat) && (!meter || i.meter === meter) && (!ql || `${i.name} ${i.cat} ${i.song?.raw.artist ?? ''} ${i.song?.raw.drummer ?? ''}`.toLowerCase().includes(ql)))
  return <div>
    <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${all.length} rhythms and songs`} className="w-full h-11 px-4 rounded-xl bg-white/[0.06] text-[15px] placeholder:text-mute outline-none focus:bg-white/[0.09]" />
    <div className="mt-2 flex gap-2">
      <select value={cat} onChange={e => setCat(e.target.value)} className="sel flex-1"><option value="">All categories</option>{cats.map(c => <option key={c}>{c}</option>)}</select>
      <select value={meter} onChange={e => setMeter(e.target.value)} className="sel w-28"><option value="">Any meter</option>{meters.map(m => <option key={m}>{m}</option>)}</select>
    </div>
    <ul className="mt-3">{items.slice(0, 200).map(i => <li key={i.id} className="flex items-center gap-2 py-2">
      <div className="flex-1 min-w-0"><div className="text-[15px] truncate">{i.name}</div><div className="text-[13px] text-mute truncate">{i.cat} · {i.meter}{i.bpm ? ` · ${i.bpm} BPM` : ''}</div></div>
      <button aria-label={`Play ${i.name}`} className="w-10 h-10 grid place-items-center rounded-full bg-white/[0.06] active:scale-90" onClick={async () => { if (i.song) { await P.loadSong(i.song) } else P.load(i.pattern!); if (!P.playing || i.song) await P.toggle(); onPicked?.() }}><PlayGlyph /></button>
      {i.pattern && <button aria-label={`Add ${i.name} as a layer`} className="w-10 h-10 grid place-items-center rounded-full bg-white/[0.06] text-lg active:scale-90" onClick={() => P.load(i.pattern!, true)}>+</button>}
    </li>)}</ul>
    {items.length === 0 && <p className="py-6 text-[15px] text-mute">Nothing matches.</p>}
  </div>
}

function FillPicker() {
  const P = usePlayer()
  const groups = useMemo(() => { const g: Record<string, Fill[]> = {}; for (const f of ALL_FILLS) (g[f.category ?? 'Song fills'] ??= []).push(f); return g }, [])
  return <section>
    <Label>Fills</Label>
    <div className="flex gap-2">
      <select value={P.fillId ?? ''} onChange={e => P.setFill(e.target.value || null, P.fillEvery || 4)} className="sel flex-1 min-w-0 w-0 truncate">
        <option value="">No fill</option>
        {Object.entries(groups).map(([g, fs]) => <optgroup key={g} label={g}>{fs.map(f => <option key={f.pattern.id} value={f.pattern.id}>{f.pattern.name}</option>)}</optgroup>)}
      </select>
      <select value={P.fillEvery} onChange={e => P.setFill(P.fillId, +e.target.value)} className="sel w-28 shrink-0" disabled={!P.fillId}>{FILL_EVERY.filter(Boolean).map(v => <option key={v} value={v}>Every {v}</option>)}</select>
    </div>
    {P.fillId && <p className="mt-2 text-[13px] text-bone">{ALL_FILLS.find(f => f.pattern.id === P.fillId)?.description}</p>}
  </section>
}

/** Bottom sheet. Drag anywhere on the header (handle, title, tabs) or pull down on content that is scrolled to the top:
 *  the sheet follows the finger and closes past 40 px or on a quick flick. Close button, tap outside and Esc also close. */
function Sheet({ open, onClose, children, title, subtitle, head, lead, contentPull = true }: { open: boolean; onClose: () => void; children: ReactNode; title?: string; subtitle?: string; head?: ReactNode; lead?: ReactNode; contentPull?: boolean }) {
  const [dy, setDy] = useState(0); const drag = useRef<{ y: number; t: number; lastY: number; lastT: number; active: boolean; fromContent: boolean } | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => { if (!open) setDy(0); else if (scroller.current) scroller.current.scrollTop = 0 }, [open]) // every open starts at the top
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [onClose])
  const start = (y: number, fromContent: boolean) => { drag.current = { y, t: performance.now(), lastY: y, lastT: performance.now(), active: !fromContent, fromContent } }
  const move = (y: number, e?: { cancelable: boolean; preventDefault: () => void }) => {
    const d = drag.current; if (!d) return
    const delta = y - d.y
    if (d.fromContent && !d.active) {
      // content drag only takes over when scrolled to the top and moving down
      if ((scroller.current?.scrollTop ?? 0) <= 0 && delta > 6) { d.active = true; d.y = y } else return
    }
    if (e?.cancelable) e.preventDefault()
    d.t = d.lastT; d.lastT = performance.now(); (d as { prevY?: number }).prevY = d.lastY; d.lastY = y
    setDy(Math.max(0, y - d.y))
  }
  const end = () => {
    const d = drag.current; drag.current = null; if (!d || !d.active) { setDy(0); return }
    const v = (d.lastY - ((d as { prevY?: number }).prevY ?? d.lastY)) / Math.max(1, d.lastT - d.t) // px/ms over the last move
    const dist = d.lastY - d.y
    if (d.fromContent ? dist > 80 || (dist > 30 && v > 0.5) : dist > 32 || (dist > 10 && v > 0.2)) onClose()
    setDy(0)
  }
  // non-passive touchmove on the content so a pull-down at scrollTop 0 can stop native overscroll
  useEffect(() => {
    const el = scroller.current; if (!el) return
    // never start a sheet drag from sliders or other controls; tabs with sliders opt out of pull-to-close entirely
    const ts = (e: TouchEvent) => { if (!contentPull || (e.target as HTMLElement).closest('input,select,textarea,[role=slider],.no-sheet-drag')) { drag.current = null; return } start(e.touches[0].clientY, true) }
    const tm = (e: TouchEvent) => move(e.touches[0].clientY, e)
    const te = () => end()
    el.addEventListener('touchstart', ts, { passive: true }); el.addEventListener('touchmove', tm, { passive: false }); el.addEventListener('touchend', te); el.addEventListener('touchcancel', te)
    return () => { el.removeEventListener('touchstart', ts); el.removeEventListener('touchmove', tm); el.removeEventListener('touchend', te); el.removeEventListener('touchcancel', te) }
  })
  const dragging = dy > 0
  const titleId = useId()
  return <>
    <div onClick={onClose} className={`fixed inset-0 z-40 bg-black/55 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} style={open && dy ? { opacity: Math.max(0.2, 1 - dy / 400) } : undefined} />
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-hidden={!open} className={`fixed inset-x-0 bottom-0 z-50 ${dragging ? '' : 'transition-transform duration-300 ease-out'} ${open ? '' : 'translate-y-full'}`} style={open && dy ? { transform: `translateY(${dy}px)` } : undefined}>
      <div className="max-w-xl mx-auto flex flex-col max-h-[calc(100dvh-0.5rem)] rounded-t-[24px] bg-[#141416] border-t border-white/[0.08] shadow-2xl shadow-black pb-[env(safe-area-inset-bottom)]">
        <div className="shrink-0 touch-none select-none cursor-grab rounded-t-[24px] border-b border-white/[0.06]"
          onTouchStart={e => start(e.touches[0].clientY, false)} onTouchMove={e => move(e.touches[0].clientY)} onTouchEnd={end} onTouchCancel={end}
          onPointerDown={e => { if (e.pointerType === 'mouse' && !(e.target as HTMLElement).closest('button')) { start(e.clientY, false); const mm = (ev: PointerEvent) => move(ev.clientY); const mu = () => { end(); removeEventListener('pointermove', mm); removeEventListener('pointerup', mu) }; addEventListener('pointermove', mm); addEventListener('pointerup', mu) } }}>
          <div className="pt-2 pb-0.5 flex justify-center"><span className="w-10 h-1.5 rounded-full bg-white/30" /></div>
          <div className="relative flex items-center h-12 pl-3 pr-1 gap-3">
            {lead && <div className="flex items-center gap-3 shrink-0">{lead}</div>}
            <div className="min-w-0 flex-1 pr-2"><div id={titleId} className="text-[15px] font-medium truncate">{title || 'Player'}</div>{subtitle && <div className="text-[13px] text-bone truncate">{subtitle}</div>}</div>
            <button aria-label="Close player" onClick={onClose} className="ml-auto h-12 pl-4 pr-3 flex items-center gap-1.5 rounded-full text-[15px] text-bone/85 active:scale-95 shrink-0">
              Close <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>
          </div>
          {head && <div className="px-4 pb-3 flex justify-center">{head}</div>}
        </div>
        <div ref={scroller} className="h-[min(72vh,calc(100dvh-10rem))] min-h-0 shrink overflow-y-auto overscroll-contain px-4 pt-4 pb-5">{children}</div>
      </div>
    </div>
  </>
}

/** Compact player pinned under the nav; details open in a bottom sheet. */
export function PlayerBar() {
  const P = usePlayer()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'now' | 'kit' | 'browse' | 'sound' | 'learn'>('now')
  const sg = P.song; const si = sg ? sectionOf(sg, P.songBar) : 0
  const title = sg ? sg.raw.song : P.arrangement ? P.arrangement.name : P.layers.length ? P.layers.map(l => l.pattern.name).join(' + ') : 'Choose a rhythm'
  const sub = sg && sg.sections[si] ? `${sg.sections[si].name} · bar ${P.songBar - sg.sections[si].start + 1}/${sg.sections[si].bars}${P.loopSection !== null ? ' · looping' : ''}` : P.arrangement && P.arrangementPos ? P.arrangement.sections[P.arrangementPos.section].name : P.inFill ? 'Fill' : P.layers.length ? `${P.layers.length} layer${P.layers.length > 1 ? 's' : ''} · ${KITS.find(k => k.id === P.kitId)!.name}` : 'Tap + to browse'
  const kitLoading = P.kitProgress < 1 && P.playing && KITS.find(k => k.id === P.kitId)!.voices.low.kind === 'sample'
  const show = (t: typeof tab) => { setTab(t); setOpen(true) }
  useEffect(() => { if ((sg && tab === 'browse') || (!sg && tab === 'learn')) setTab('now') }, [sg, tab])
  // live tempo: follows the song's tempo map (per-bar and mid-bar changes) as it plays
  const [live, setLive] = useState<number | null>(null)
  useEffect(() => { if (!sg || !P.playing) { setLive(null); return }
    const id = setInterval(() => setLive(Tone.getTransport().bpm.value), 200); return () => clearInterval(id) }, [sg, P.playing])
  const transport = <>
        <button aria-label={P.playing ? 'Stop' : 'Play'} onClick={P.toggle} disabled={!P.layers.length && !P.arrangement && !P.song}
          className={`relative w-10 h-10 shrink-0 rounded-full bg-amber text-ink grid place-items-center active:scale-90 transition-transform disabled:opacity-25 ${P.playing ? 'pulse-ring' : ''}`}>
          {P.playing ? <span className="w-3 h-3 rounded-[2px] bg-ink" /> : <span className="ml-0.5 w-0 h-0 border-y-[7px] border-y-transparent border-l-[11px] border-l-ink" />}
        </button>
        <button aria-label={P.queue.length ? `Next song (${P.queue.length} queued)` : 'Next song (queue empty)'} onClick={() => void P.next()} disabled={!P.queue.length}
          className="relative -ml-1 w-10 h-10 shrink-0 grid place-items-center rounded-full text-bone/80 active:scale-90 disabled:opacity-25">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2.5v11l8-5.5z" /><rect x="11.5" y="2.5" width="2" height="11" rx="0.6" /></svg>
          {P.queue.length > 0 && <span className="absolute top-0.5 right-0.5 text-[9px] tabular-nums text-amber">{P.queue.length}</span>}
        </button>
  </>
  return createPortal(<>
    <div className="fixed inset-x-0 bottom-0 z-30 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-ink/85 backdrop-blur-xl border-t border-white/[0.06]"><div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 h-14 px-2 rounded-2xl bg-white/[0.05] border border-white/[0.06]">
        {transport}
        <button className="flex-1 min-w-0 text-left" onClick={() => show('now')}>
          <div className="text-[15px] font-medium truncate">{title}</div>
          <div className="text-[13px] text-mute truncate">{kitLoading ? `Loading samples ${Math.round(P.kitProgress * 100)}%` : sub}</div>
        </button>
        <button onClick={() => show('sound')} className="text-[13px] tabular-nums text-mute px-1 h-10" aria-label="Current tempo">{sg ? shownBpm(sg, live ?? P.bpm) : Math.round(P.bpm)}</button>
        <button aria-label="Browse rhythms" onClick={() => show(sg ? 'now' : 'browse')} className="w-10 h-10 shrink-0 grid place-items-center rounded-full bg-white/[0.08] text-xl active:scale-90">{sg ? '⌃' : '+'}</button>
      </div>
    </div></div>
    <Sheet open={open} onClose={() => setOpen(false)} lead={transport} title={sg ? sg.raw.song : title} subtitle={sg ? `${sg.raw.artist} · ${sg.raw.drummer}` : undefined}
      contentPull={tab !== 'sound' && tab !== 'learn'}
      head={<div className="w-full flex flex-col items-center"><Segmented value={tab} onChange={setTab} options={[{ v: 'now', l: 'Now playing' }, { v: 'kit', l: 'Kit view' }, ...(sg ? [] : [{ v: 'browse' as const, l: 'Browse' }]), { v: 'sound', l: 'Sound' }, ...(sg ? [{ v: 'learn' as const, l: 'Learn it' }] : [])]} />{sg && tab === 'now' && <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
        {P.playing && sg.raw.goodPart && <button onClick={() => P.jumpBar(sg.raw.goodPart!.bar, true)} title={sg.raw.goodPart.at && cleanSectionName(sg.raw.goodPart.at)}
          className="h-8 px-3.5 rounded-full text-[13px] text-amber bg-amber/[0.08] active:scale-95">Skip to the good part</button>}
        <button aria-pressed={P.loopMode} onClick={() => P.setLoopMode(!P.loopMode)} className={`h-8 px-3.5 rounded-full text-[13px] active:scale-95 ${P.loopMode ? 'bg-amber text-ink' : 'bg-white/[0.06] text-bone/75'}`}>Loop</button>
        {P.loopMode && (P.barLoop ? <button aria-label="Clear loop" onClick={P.clearBarLoop} className="h-8 pl-3 pr-2.5 rounded-full text-[13px] bg-white/[0.06] text-amber flex items-center gap-1.5">Looping bars {P.barLoop[0] + 1}{P.barLoop[1] > P.barLoop[0] ? `–${P.barLoop[1] + 1}` : ''}<span className="text-bone/60 text-[15px] leading-none">×</span></button>
          : P.loopPick !== null && <span className="text-[13px] text-mute">Bar {P.loopPick + 1} · tap the end bar</span>)}
      </div>}<UpNext key={String(open)} /></div>}>
      {tab === 'now' && <div className="space-y-3">
        {sg && <SongForm />}
        {sg?.raw.tuning && <p className="text-[13px] text-bone">Tuning ({sg.raw.tuning.status}): {sg.raw.tuning.note}</p>}
        {!sg && P.arrangement && <ol className="space-y-1.5 text-[15px]">{P.arrangement.sections.map((s, i) => <li key={i} className={P.arrangementPos?.section === i ? 'text-amber' : 'text-mute'}>{s.name} · {s.bars} bars</li>)}</ol>}
        {!sg && !P.arrangement && (P.layers.length ? P.layers.map(l => <LayerCard key={l.id} layer={l} />) : <p className="text-sm text-mute">Nothing loaded. Open Browse to pick a rhythm, then tap + to stack layers.</p>)}
        {!sg && !P.arrangement && <button className="w-full h-11 rounded-xl bg-white/[0.06] text-[15px] text-bone" onClick={() => setTab('browse')}>+ Add a layer</button>}
      </div>}
      {tab === 'kit' && <KitView bars={sg ? sg.bars : P.layers.map(l => l.pattern)} />}
      {tab === 'browse' && !sg && <Browser />}
      {tab === 'learn' && sg && <LearnPanel key={`${sg.raw.id}:${P.loadId}`} />}
      {tab === 'sound' && <div className="space-y-6">
        <section><Label>Tempo <span className="text-bone tabular-nums">{sg ? shownBpm(sg, live ?? P.bpm) : Math.round(P.bpm)}</span> <span>BPM</span></Label>
          <input type="range" min={40} max={260} value={sg ? shownBpm(sg, P.bpm) : P.bpm} onChange={e => P.setBpm(+e.target.value / (sg?.raw.bpmDisplay ?? 1))} className="slider no-sheet-drag touch-pan-x" aria-label="Tempo" />
          {sg && <p className="mt-1.5 text-[13px] text-bone leading-snug">{sg.raw.bpmNote ?? 'Follows the tab\'s tempo map; the slider scales every tempo change proportionally.'}</p>}
          {P.layers[0]?.pattern.bpmNote && <p className="mt-1.5 text-[13px] text-bone leading-snug">{P.layers[0].pattern.bpmNote}{P.layers[0].pattern.bpmSource && <> <a className="underline underline-offset-2" href={P.layers[0].pattern.bpmSource} target="_blank" rel="noreferrer">source</a></>}</p>}</section>
        <section><Label>Kit</Label>
          <select value={P.kitId} onChange={e => P.setKit(e.target.value)} className="sel w-full">{KITS.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}</select>
          <p className="mt-1.5 text-[13px] text-bone">{KITS.find(k => k.id === P.kitId)!.blurb}</p>
          {P.kitProgress > 0 && P.kitProgress < 1 && <div className="mt-2 h-0.5 rounded bg-white/10 overflow-hidden"><div className="h-full bg-amber transition-[width] duration-200" style={{ width: `${P.kitProgress * 100}%` }} /></div>}</section>
        <FillPicker />
      </div>}
    </Sheet>
  </>, document.body)
}
const Label = ({ children, className = '' }: { children: ReactNode; className?: string }) => <div className={`mb-2 text-[13px] text-mute flex gap-1.5 items-baseline ${className}`}>{children}</div>

/** Section list for the loaded song: tap a row to jump, tap the loop icon to repeat that section. */

/** Muted palette for bar and section variation cues (amber stays reserved for "now"). */
const VAR_COLORS = ['#7d8fa3', '#8fa38a', '#b08a78', '#9a86a8', '#b3a37a', '#7aa39f', '#a3787f', '#8a8f9a']
const barSig = (b: Pattern) => JSON.stringify([b.tracks, b.sub ?? null, b.variant ?? null, b.timeSig ?? ''])
/** Per bar: letter index within its section, whether it departs from the section's main bar (variation, fill, crash).
 *  Per section: a group index shared by sections with identical bar content (Verse 2 = Verse 1). */
function variation(sg: Song) {
  const bars: { k: number; accent: boolean }[] = []; const secGroup: number[] = []; const seen = new Map<string, number>()
  for (const s of sg.sections) {
    const sigs = sg.bars.slice(s.start, s.start + s.bars).map(barSig); const ids = new Map<string, number>(); const count = new Map<string, number>()
    sigs.forEach(x => { if (!ids.has(x)) ids.set(x, ids.size); count.set(x, (count.get(x) ?? 0) + 1) })
    const main = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    sg.bars.slice(s.start, s.start + s.bars).forEach((b, i) => bars.push({ k: ids.get(sigs[i])!, accent: sigs[i] !== main && count.get(sigs[i]) === 1 && (count.get(main!) ?? 0) >= Math.max(2, sigs.length / 3) && !!b }))
    // a section repeats an earlier one when it has the same length and at least 75% of its bars match bar-for-bar
    let g = -1
    for (const [k, gi] of seen) { const o = k.split('\u0001'); if (o.length === sigs.length && o.filter((x, j) => x === sigs[j]).length >= 0.75 * sigs.length) { g = gi; break } }
    if (g < 0) { g = seen.size; seen.set(sigs.join('\u0001'), g) }
    secGroup.push(g)
  }
  return { bars, secGroup, repeats: new Set(secGroup.filter((g, i) => secGroup.indexOf(g) !== i)) }
}

export function SongForm({ song }: { song?: Song }) {
  const P = usePlayer()
  const sg = song ?? P.song!
  const live = P.song?.raw.id === sg.raw.id
  const heardBar = useHeardPos(true, live)?.bar
  const bar = live && P.playing && heardBar !== undefined ? heardBar : P.songBar
  const cur = live ? sectionOf(sg, bar) : -1
  const V = useMemo(() => sg.bars.length ? variation(sg) : null, [sg, sg.bars.length])
  // keep the active section in view as playback moves on; hand scrolling pauses this for a few seconds
  const listRef = useRef<HTMLOListElement>(null), gridRef = useRef<HTMLDivElement>(null), lastUser = useRef(0)
  useEffect(() => {
    const sc = listRef.current?.closest('.overflow-y-auto'); if (!sc) return
    const mark = () => { lastUser.current = Date.now() }
    for (const ev of ['wheel', 'touchmove', 'pointerdown', 'keydown'] as const) sc.addEventListener(ev, mark, { passive: true })
    return () => { for (const ev of ['wheel', 'touchmove', 'pointerdown', 'keydown'] as const) sc.removeEventListener(ev, mark) }
  }, [])
  useEffect(() => {
    if (!live || cur < 0 || Date.now() - lastUser.current < 4000) return
    const li = listRef.current?.children[cur] as HTMLElement | undefined, sc = listRef.current?.closest('.overflow-y-auto') as HTMLElement | null
    if (!li || !sc) return
    const top = (gridRef.current?.offsetHeight ?? 0) + 8, r = li.getBoundingClientRect(), b = sc.getBoundingClientRect()
    if (r.top < b.top + top || r.bottom > b.bottom - 8) sc.scrollTo({ top: sc.scrollTop + (r.top - b.top) - top, behavior: 'smooth' })
  }, [cur, live])
  return <div>
    {live && <div ref={gridRef} className="sticky -top-4 z-10 -mx-4 -mt-4 px-4 pt-4 pb-2 bg-[#141416]"><NowGrid song={sg} /></div>}
    <ol ref={listRef} className="mt-1">{sg.sections.map((s, i) => {
      const on = i === cur; const pct = on ? ((bar - s.start + 1) / s.bars) * 100 : 0
      const go = async () => { if (!live) { await P.loadSong(sg, i); await P.toggle() } else P.jumpSection(i) }
      // the whole row is a tap target; the section name is the real button (keyboard, screen readers), so no control nests inside another
      return <li key={i} onClick={go} className="flex items-center gap-2 py-2 cursor-pointer active:bg-white/[0.03] rounded-lg">
        {V && <span title={V.repeats.has(V.secGroup[i]) ? 'Same bars as another section' : undefined} className="w-1.5 self-stretch my-1 rounded-full shrink-0" style={{ background: VAR_COLORS[V.secGroup[i] % VAR_COLORS.length], opacity: V.repeats.has(V.secGroup[i]) ? 0.9 : 0.35 }} />}
        <div className="flex-1 min-w-0">
          <button aria-label={`Jump to ${s.name}`} onClick={ev => { ev.stopPropagation(); void go() }} className={`block w-full text-left text-[15px] ${on ? 'text-amber' : 'text-bone'}`}>
            <span className="truncate block">{s.name}{V && V.repeats.has(V.secGroup[i]) && V.secGroup.indexOf(V.secGroup[i]) !== i && <span className="ml-1.5 text-[13px] text-mute">= {sg.sections[V.secGroup.indexOf(V.secGroup[i])].name}</span>}</span>
          </button>
          {P.loopMode && live && <div className="flex flex-wrap gap-1 mt-1.5" aria-label={`${s.name} bars`}>
            {Array.from({ length: s.bars }, (_, j) => { const n = s.start + j, inR = !!P.barLoop && n >= P.barLoop[0] && n <= P.barLoop[1]
              return <button key={j} aria-label={`Loop bar ${n + 1}`} onClick={ev => { ev.stopPropagation(); P.pickBar(n) }}
                className={`w-8 h-8 rounded-md text-[13px] tabular-nums ${inR ? 'bg-amber text-ink font-medium' : P.loopPick === n ? 'ring-1 ring-amber text-amber bg-amber/10' : 'bg-white/[0.06] text-bone/60'} ${n === bar && P.playing ? 'outline outline-1 outline-bone/70' : ''}`}>{n + 1}</button> })}
          </div>}
          {!(P.loopMode && live) && V && (on || s.bars <= 64) && <VarStrip bars={V.bars.slice(s.start, s.start + s.bars)} name={s.name} on={on} live={live} now={bar - s.start} jump={j => P.jumpBar(s.start + j)} />}
          {!V && on && <span className="block mt-1 h-0.5 rounded bg-white/10 overflow-hidden"><span className="block h-full bg-amber transition-[width] duration-150" style={{ width: `${pct}%` }} /></span>}
        </div>
        <span className="text-[13px] tabular-nums text-mute">{s.bars}</span>
        {live && <button aria-label={`Loop ${s.name}`} aria-pressed={P.loopSection === i} onClick={ev => { ev.stopPropagation(); P.setLoopSection(P.loopSection === i ? null : i) }} className={`w-8 h-8 grid place-items-center rounded-full text-xs ${P.loopSection === i ? 'bg-amber text-ink' : 'text-mute'}`}>↻</button>}
      </li>
    })}</ol>
  </div>
}

/** A section's bars as colour blocks, one colour per distinct pattern. The playing section's strip is a single control
 *  (tap a bar, or arrow keys, to jump there); the others are just a picture of the form. */
function VarStrip({ bars, name, on, live, now, jump }: { bars: { k: number; accent: boolean }[]; name: string; on: boolean; live: boolean; now: number; jump: (bar: number) => void }) {
  const tap = on && live
  const go = (j: number) => jump(Math.max(0, Math.min(bars.length - 1, j)))
  const control = tap ? {
    role: 'slider', tabIndex: 0, 'aria-label': `Bar in ${name}`, 'aria-valuemin': 1, 'aria-valuemax': bars.length, 'aria-valuenow': Math.max(1, now + 1),
    onClick: (ev: React.MouseEvent<HTMLDivElement>) => { ev.stopPropagation(); const r = ev.currentTarget.getBoundingClientRect(); go(Math.floor((ev.clientX - r.left) / r.width * bars.length)) },
    onKeyDown: (ev: React.KeyboardEvent) => { const d = ev.key === 'ArrowRight' || ev.key === 'ArrowUp' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' ? -1 : 0; if (d) { ev.preventDefault(); ev.stopPropagation(); go(now + d) } },
  } : { 'aria-hidden': true }
  return <div className={`flex gap-[2px] mt-1 ${on ? 'h-6' : 'h-1.5 pointer-events-none'}`} {...control}>
    {bars.map((b, j) => <span key={j} className={`relative flex-1 min-w-[3px] rounded-[2px] ${live && j === now ? 'ring-1 ring-amber' : ''}`} style={{ background: VAR_COLORS[b.k % VAR_COLORS.length], opacity: on ? (live && j <= now ? 1 : 0.55) : 0.4 }}>
      {b.accent && <span className="absolute -top-[3px] left-1/2 -translate-x-1/2 w-[3px] h-[3px] rounded-full bg-amber" />}
      {on && bars.length <= 16 && <span className="absolute inset-0 grid place-items-center text-[9px] leading-none text-ink/70 font-medium">{String.fromCharCode(65 + Math.min(b.k, 25))}</span>}
    </span>)}
  </div>
}

/** The bar being heard, with the step being heard lit. Its own component so the per-step update repaints only the grid. */
function NowGrid({ song }: { song: Song }) {
  const P = usePlayer(), h = useHeardPos()
  const p = song.bars[h?.bar ?? P.songBar]
  return p ? <StepGrid pattern={p} current={P.playing && h ? h.step : -1} /> : null
}

/** "Up next" queue: a quiet one-line summary that opens into a removable list. */
function UpNext() {
  const P = usePlayer(); const [open, setOpen] = useState(false)
  if (!P.queue.length) return null
  return <div className="mt-2.5 w-full text-left">
    <div className="flex items-center gap-3">
    <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex-1 min-w-0 h-9 flex items-center gap-2 text-[13px] text-mute">
      <span>Up next</span>
      <span className="flex-1 min-w-0 truncate text-left text-bone">{P.queue[0].raw.song}{P.queue.length > 1 ? ` +${P.queue.length - 1}` : ''}</span>
      <span className={`text-[18px] leading-none text-bone/60 transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
    </button>
    <button aria-label="Play next song" onClick={() => void P.next()} className="shrink-0 h-9 pl-3 pr-3.5 flex items-center gap-1.5 rounded-full text-[13px] text-bone/85 bg-white/[0.06] active:scale-95">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2.5v11l8-5.5z" /><rect x="11.5" y="2.5" width="2" height="11" rx="0.6" /></svg>Next
    </button>
    </div>
    {open && <ol>{P.queue.map((q, i) => <li key={i} className="flex items-center gap-2 h-11">
      <span className="w-4 text-[13px] text-mute tabular-nums">{i + 1}</span>
      <span className="flex-1 min-w-0 truncate text-[15px]">{q.raw.song} · {q.raw.artist}</span>
      <button aria-label={`Remove ${q.raw.song} from queue`} onClick={() => P.unqueue(i)} className="w-10 h-10 grid place-items-center rounded-full text-mute active:bg-white/[0.06]">✕</button>
    </li>)}</ol>}
  </div>
}
