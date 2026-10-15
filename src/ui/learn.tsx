import { useEffect, useMemo, useRef, useState } from 'react'
import type { Voice } from '../engine/types'
import { VOICES } from '../engine/types'
import type { PulseEvent } from '../engine/audio'
import type { Song } from '../data/songs'
import { loadSongBars, shownBpm } from '../data/songs'
import { getLesson, type Lesson, type LessonBar, type Limb } from '../learn'
import { LIMBS, LIMB_NAME, VOICE_LABEL } from '../learn/speech'
import { AUTHORED } from '../learn/authored'
import { recallPractice, savePractice, type PracticeMemory } from '../learn/memory'
import { usePlayer } from './player'
import { KitView } from './kitview'

const FEET = new Set<Voice>(['low', 'pedal'])
const VOICE_NAME = (v: Voice) => VOICE_LABEL[v][0].toUpperCase() + VOICE_LABEL[v].slice(1)
const VOICE_MARK: Record<Voice, string> = { low: 'K', back: 'S', tick: 'H', open: 'O', pedal: 'P', ride: 'R', rideBell: 'B', crash1: 'C', crash2: 'C', china: 'X', tomHi: 'T', tomMid: 'T', tomLo: 'F', accent: 'x', bell: 'B', shaker: 'Sh' }
const LIMB_SHORT: Record<Limb, string> = { rightHand: 'R hand', leftHand: 'L hand', rightFoot: 'R foot', leftFoot: 'L foot' }
/** Authored lesson for the whole section when one exists, else the derived lesson (optionally for an inclusive bar range). */
function lessonFor(song: Song, i: number, range?: [number, number]): Lesson {
  if (!range) return AUTHORED[`${song.raw.id}:${i}`] ?? getLesson(song, i)
  try { return getLesson(song, i, range) } catch { return getLesson(song, i) }
}
const sectionOf = (s: Song, bar: number) => Math.max(0, s.sections.findIndex(x => bar >= x.start && bar < x.start + x.bars))

/** null = no practice filter, so the engine plays the full mix. */
function allowedVoices(limb: PracticeMemory['limb'], muted: Voice[], solo: Voice[]): Voice[] | null {
  if (limb === 'all' && !muted.length && !solo.length) return null
  let list: Voice[] = limb === 'feet' ? [...FEET] : limb === 'hands' ? VOICES.filter(v => !FEET.has(v)) : [...VOICES]
  if (solo.length) list = list.filter(v => solo.includes(v))
  else if (muted.length) list = list.filter(v => !muted.includes(v))
  return list
}

function say(text: string) {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
  if (!synth || !text) return
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1.12; u.volume = 0.9
    synth.cancel(); synth.resume(); synth.speak(u)
  } catch { /* this browser has no speech engine */ }
}

const pill = (on: boolean) => `h-9 px-3 rounded-full text-[13px] border whitespace-nowrap active:scale-95 ${on ? 'bg-amber text-ink border-amber' : 'border-white/[0.18] text-bone/80'}`
const sq = (on: boolean, kind: 'mute' | 'solo') => `w-9 h-9 rounded-full text-[12px] font-medium border active:scale-95 ${on ? (kind === 'solo' ? 'bg-amber text-ink border-amber' : 'bg-bone text-ink border-bone') : 'border-white/15 text-bone/70'}`

interface Cell { voice: Voice; ghost: boolean; off: boolean }

/** Keep the active pill of a horizontal row in view (near center), scrolling only the row,
 *  and leave the row alone for 2 s after the user touches or scrolls it. */
function useCenterActive(key: unknown) {
  const ref = useRef<HTMLDivElement>(null)
  const quiet = useRef(0)
  const auto = useRef(0)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const hold = () => { if (performance.now() > auto.current) quiet.current = performance.now() + 2000 }
    el.addEventListener('touchstart', hold, { passive: true }); el.addEventListener('pointerdown', hold); el.addEventListener('wheel', hold, { passive: true }); el.addEventListener('scroll', hold, { passive: true })
    return () => { el.removeEventListener('touchstart', hold); el.removeEventListener('pointerdown', hold); el.removeEventListener('wheel', hold); el.removeEventListener('scroll', hold) }
  }, [])
  useEffect(() => {
    let timer = 0
    const go = () => {
      const el = ref.current, pill = el?.querySelector<HTMLElement>('[data-active]')
      if (!el || !pill) return
      const wait = quiet.current - performance.now()
      if (wait > 0) { timer = window.setTimeout(go, wait + 50); return } // the user is scrolling: try again when they stop
      const left = pill.offsetLeft - (el.clientWidth - pill.offsetWidth) / 2
      if (Math.abs(el.scrollLeft - left) < 2) return
      auto.current = performance.now() + 800 // our own smooth scroll fires scroll events; don't count them as the user's
      el.scrollTo({ left, behavior: 'smooth' })
    }
    go()
    return () => clearTimeout(timer)
  }, [key])
  return ref
}

/** Big bar grid from the lesson's notes: one row per limb, the count under the beats, the current note lit. */
function Notation({ bar, step, sounds }: { bar: LessonBar; step: number; sounds: (v: Voice) => boolean }) {
  const steps = bar.pattern.steps
  const syllables = bar.count.beats.flatMap(b => b.grid)
  const beatStart = new Set(bar.count.beats.map(b => b.step))
  const sticking = Array.from({ length: steps }, (_, i) => { const h = new Set(bar.notes.filter(n => n.step === i && !n.frac && (n.limb === 'rightHand' || n.limb === 'leftHand')).map(n => n.stick)); return h.size === 2 ? 'RL' : h.size ? [...h][0] : '' })
  const showStick = sticking.some(Boolean)
  const minCol = syllables.some(x => x.length > 2) ? 30 : 18
  // Wrap at beat boundaries so the bar never scrolls sideways: as many whole beats per line as fit.
  const fit = Math.max(1, Math.floor(310 / minCol))
  const starts = bar.count.beats.map(b => b.step)
  const lines: [number, number][] = []
  starts.forEach((s, k) => {
    const e = starts[k + 1] ?? steps, last = lines[lines.length - 1]
    if (last && e - last[0] <= fit) last[1] = e; else lines.push([s, e])
  })
  const widest = Math.max(...lines.map(([a, b]) => b - a))
  const rows = LIMBS.map(limb => ({ limb, cells: Array.from({ length: steps }, (_, i): Cell | null => {
    const ns = bar.notes.filter(n => n.limb === limb && n.step === i).sort((x, y) => (x.frac ? 1 : 0) - (y.frac ? 1 : 0) || y.velocity - x.velocity)
    return ns[0] ? { voice: ns[0].voice, ghost: ns[0].tier === 'ghost', off: !!ns[0].frac } : null
  }) }))
  const span = (a: number, b: number) => Array.from({ length: b - a }, (_, j) => a + j)
  return <div className="mt-2" role="img" aria-label="Bar notation with the count under each beat">
    {lines.map(([a, b]) => <div key={a} className={a > 0 ? 'mt-3' : ''}>
      {rows.map(({ limb, cells }) => {
        const hot = step >= a && step < b && !!cells[step]
        return <div key={limb} className="flex items-stretch">
          <span className={`w-12 shrink-0 self-center text-[11px] leading-none ${hot ? 'text-amber' : 'text-mute'}`}>{LIMB_SHORT[limb]}</span>
          <div className="flex-1"><div className="flex" style={{ width: `${(b - a) / widest * 100}%` }}>
            {span(a, b).map(i => {
              const c = cells[i], now = i === step, mine = c ? !sounds(c.voice) : false
              return <div key={i} className={`flex-1 h-9 flex items-center justify-center ${beatStart.has(i) && i > a ? 'border-l border-white/10' : ''} ${now ? 'bg-amber/20' : ''}`}>
                {c && <span className={`grid place-items-center rounded-full font-semibold leading-none transition-transform duration-75 ${c.ghost || c.off ? 'w-3.5 h-3.5 text-[8px]' : 'w-[18px] h-[18px] text-[10px]'} ${now && !mine ? 'bg-amber text-ink scale-110' : mine ? 'bg-transparent text-bone/70 ring-1 ring-bone/40' : 'bg-bone/85 text-ink'}`}>{VOICE_MARK[c.voice]}</span>}
              </div>
            })}
          </div></div>
        </div>
      })}
      <div className="flex mt-0.5">
        <span className="w-12 shrink-0" />
        <div className="flex-1"><div className="flex" style={{ width: `${(b - a) / widest * 100}%` }}>{span(a, b).map(i => <span key={i} className={`flex-1 text-center leading-none py-1 ${beatStart.has(i) ? 'text-[13px]' : 'text-[11px]'} ${i === step ? 'text-amber' : beatStart.has(i) ? 'text-bone' : 'text-mute'}`}>{syllables[i]}</span>)}</div></div>
      </div>
      {showStick && <div className="flex">
        <span className="w-12 shrink-0 text-[10px] text-mute self-center">Stick</span>
        <div className="flex-1"><div className="flex" style={{ width: `${(b - a) / widest * 100}%` }}>{span(a, b).map(i => <span key={i} className={`flex-1 text-center text-[10px] leading-none py-0.5 ${i === step ? 'text-amber' : 'text-mute'}`}>{sticking[i]}</span>)}</div></div>
      </div>}
    </div>)}
  </div>
}

/** Learn the section that's playing: notation, limbs, and the practice tools. */
export function LearnPanel() {
  const P = usePlayer()
  const song = P.song!
  // getLesson needs the song's bars: load them before the panel (and its hooks) render
  const [ready, setReady] = useState(song.bars.length > 0)
  useEffect(() => { if (song.bars.length) { setReady(true); return }; let on = true; void loadSongBars(song).then(() => { if (on) setReady(true) }); return () => { on = false } }, [song])
  return ready && song.bars.length ? <Learn /> : <p className="text-sm text-mute">Loading the part…</p>
}

function Learn() {
  const P = usePlayer()
  const song = P.song!
  const saved = recallPractice(song.raw.id)
  const [countIn, setCountIn] = useState(saved?.countIn ?? false)
  const [click, setClick] = useState(saved?.click ?? false)
  const [voice, setVoice] = useState(saved?.voice ?? false)
  const [limb, setLimb] = useState<PracticeMemory['limb']>(saved?.limb ?? 'all')
  const [muted, setMuted] = useState<Voice[]>(saved?.muted ?? [])
  const [solo, setSolo] = useState<Voice[]>(saved?.solo ?? [])
  const [stepOn, setStepOn] = useState(saved?.stepOn ?? false)
  const [step, setStep] = useState(saved?.step ?? 0)
  const [trainer, setTrainer] = useState(saved?.trainer ?? false)
  const [every, setEvery] = useState<2 | 4 | 8>(saved?.every ?? 4)
  const [loops, setLoops] = useState(saved?.loops ?? 0)
  const [pin, setPin] = useState<number | null>(saved?.pin ?? null)
  const [countFlash, setCountFlash] = useState<number | null>(null)

  const selected = P.barLoop ? sectionOf(song, P.barLoop[0]) : P.loopSection !== null ? P.loopSection : sectionOf(song, P.songBar)
  const secRow = useCenterActive(`${song.raw.id}:${selected}`)
  const barRow = useCenterActive(P.playing ? P.songBar : -1)
  const secR = song.sections[selected]
  // the bar-range loop (inclusive), clipped to this section; the steps and tempos then cover just those bars
  const range = useMemo((): [number, number] | undefined => {
    if (!P.barLoop || !secR) return undefined
    const a = Math.max(P.barLoop[0], secR.start), b = Math.min(P.barLoop[1], secR.start + secR.bars - 1)
    return a <= b ? [a, b] : undefined
  }, [P.barLoop, secR])
  const full: Lesson = useMemo(() => lessonFor(song, selected), [song, selected])
  const lesson: Lesson = useMemo(() => range ? lessonFor(song, selected, range) : full, [song, selected, range, full])
  const stepI = Math.min(step, Math.max(0, lesson.steps.length - 1))
  const cur = lesson.steps[stepI]
  const allow = useMemo(() => allowedVoices(limb, muted, solo), [limb, muted, solo])
  // stacked layers: on a step, each lesson bar plays that step's pattern (the full bar with the later layers removed)
  const stepBars = useMemo(() => stepOn && cur ? new Map(cur.bars.map(b => [b.songBar, b.pattern])) : null, [stepOn, cur])

  const sec = song.sections[selected]
  const inSec = !!sec && P.songBar >= sec.start && P.songBar < sec.start + sec.bars
  const view = pin !== null && sec && pin >= sec.start && pin < sec.start + sec.bars ? pin : inSec ? P.songBar : (sec?.start ?? 0)
  const shown: LessonBar | undefined = (stepOn && cur ? cur.bars : full.bars).find(b => b.songBar === view) ?? full.bars.find(b => b.songBar === view)

  const { subscribe } = P
  const [playStep, setPlayStep] = useState(-1)
  useEffect(() => subscribe(s => { if (!Object.keys(s).length) setPlayStep(-1); else if (s.song !== undefined) setPlayStep(s.song) }), [subscribe])

  const sounds = (v: Voice) => !allow || allow.includes(v)
  const pct = Math.round((P.bpm / (song.raw.bpm || 1)) * 100)
  const loopR: [number, number] | null = P.barLoop ? [P.barLoop[0], P.barLoop[1] + 1] : P.loopSection !== null && song.sections[P.loopSection] ? [song.sections[P.loopSection].start, song.sections[P.loopSection].start + song.sections[P.loopSection].bars] : null

  const live = useRef({ playing: P.playing, range: loopR, pct, base: song.raw.bpm, every, trainer, loops })
  live.current = { playing: P.playing, range: loopR, pct, base: song.raw.bpm, every, trainer, loops }
  const setBpm = useRef(P.setBpm); setBpm.current = P.setBpm
  const onPulse = useRef<(e: PulseEvent) => void>(() => {})
  const onBar = useRef<(bar: number) => void>(() => {})
  const lastBar = useRef<number | null>(null)
  const loopKey = useRef('')
  const voiceOn = useRef(voice); voiceOn.current = voice
  const words = useRef<string[]>([])
  words.current = shown ? shown.count.beats.map(b => b.spoken.split(' ')[0]) : []

  onPulse.current = e => {
    if (e.countIn) setCountFlash(e.beat + 1)
    else if (countFlash !== null) setCountFlash(null)
    if (!voiceOn.current) return
    say(e.countIn ? String(e.beat + 1) : (words.current[e.beat] ?? String(e.beat + 1)))
  }
  onBar.current = bar => {
    const L = live.current
    const key = L.range ? `${L.range[0]}:${L.range[1]}` : ''
    if (key !== loopKey.current) { loopKey.current = key; lastBar.current = null }
    const prev = lastBar.current
    lastBar.current = bar
    if (!L.trainer || !L.playing || !L.range || prev === null) return
    const [a, b] = L.range
    const wrapped = b - a === 1 ? prev === a && bar === a : prev === b - 1 && bar === a
    if (!wrapped) return
    const n = L.loops + 1
    L.loops = n; setLoops(n)
    if (n % L.every !== 0 || L.pct >= 100) return
    const next = Math.min(100, L.pct + 5)
    L.pct = next
    setBpm.current(L.base * next / 100)
  }

  const { learn } = P
  useEffect(() => {
    // Only subscribe while something is listening. An idle tab adds no callbacks to the scheduler.
    learn.onPulse(voice || countIn ? e => onPulse.current(e) : null)
    learn.onBar(trainer ? bar => onBar.current(bar) : null)
    return () => { learn.onPulse(null); learn.onBar(null) }
  }, [learn, voice, countIn, trainer])
  useEffect(() => () => { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel() }, [])
  useEffect(() => {
    learn.voices(allow)
    learn.bars(stepBars)
    learn.metronome(click)
    learn.countIn(countIn)
  }, [learn, allow, stepBars, click, countIn])

  useEffect(() => { savePractice(song.raw.id, { countIn, click, voice, limb, muted, solo, stepOn, step: stepI, trainer, every, loops, pin }) }, [song.raw.id, countIn, click, voice, limb, muted, solo, stepOn, stepI, trainer, every, loops, pin])

  const setPct = (n: number) => { setLoops(0); live.current.loops = 0; live.current.pct = n; P.setBpm(song.raw.bpm * n / 100) }
  const lockSection = (i: number) => { setPin(null); setStep(0); P.setLoopSection(i); P.jumpSection(i) }
  const toggleMute = (v: Voice) => { setSolo(s => s.filter(x => x !== v)); setMuted(m => m.includes(v) ? m.filter(x => x !== v) : [...m, v]) }
  const toggleSolo = (v: Voice) => { setMuted(m => m.filter(x => x !== v)); setSolo(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]) }
  const chooseStep = (i: number) => {
    const s = lesson.steps[i]; if (!s) return
    setStep(i); setStepOn(true)
    if (voice) say(s.speak)
  }
  const startTrainer = () => {
    const next = !trainer
    setTrainer(next); setLoops(0); live.current.loops = 0
    if (next && !P.barLoop && P.loopSection === null && sec) P.setLoopSection(selected)
  }

  const localBar = sec ? view - sec.start + 1 : 1
  const playingNotes = full.bars.find(b => b.songBar === P.songBar)?.notes ?? []
  const hotLimb = (l: Limb) => P.playing && playStep >= 0 && playingNotes.some(n => n.limb === l && n.step === playStep)

  if (!sec) return <p className="text-sm text-mute">Loading the part…</p>

  return <div className="space-y-4">
    <div ref={secRow} className="relative flex gap-1.5 overflow-x-auto no-sheet-drag -mx-4 px-4 pb-0.5" aria-label="Sections">
      {song.sections.map((s, i) => <button key={i} data-active={i === selected || undefined} aria-pressed={i === selected} onClick={() => lockSection(i)} className={`shrink-0 h-9 max-w-[148px] truncate px-3 rounded-full text-[13px] border active:scale-95 ${i === selected ? 'bg-amber text-ink border-amber' : 'border-white/[0.16] text-bone/80'}`}>{s.name}</button>)}
    </div>

    <div>
      <div ref={barRow} className="relative flex gap-1 overflow-x-auto no-sheet-drag -mx-4 px-4" aria-label={`${sec.name} bars`}>
        {Array.from({ length: sec.bars }, (_, j) => {
          const n = sec.start + j
          const inR = !!P.barLoop && n >= P.barLoop[0] && n <= P.barLoop[1]
          return <button key={n} data-active={(P.playing && n === P.songBar) || undefined} aria-label={`Learn bar ${n + 1}`} onClick={() => { setPin(null); P.pickBar(n) }} className={`shrink-0 w-9 h-9 rounded-md text-[13px] tabular-nums ${inR ? 'bg-amber text-ink font-medium' : P.loopPick === n ? 'ring-1 ring-amber text-amber bg-amber/10' : 'bg-white/[0.06] text-bone/75'} ${n === P.songBar && P.playing ? 'outline outline-1 outline-bone/70' : ''}`}>{j + 1}</button>
        })}
      </div>
      {(P.barLoop || P.loopPick !== null) && <p className="mt-1.5 text-[12px] text-bone/60 leading-snug">
        {P.barLoop ? <>Looping bars {P.barLoop[0] - sec.start + 1}–{P.barLoop[1] - sec.start + 1}. <button className="text-amber underline underline-offset-2" onClick={P.clearBarLoop}>Clear</button></> : P.loopPick !== null ? `Bar ${P.loopPick - sec.start + 1} selected. Tap the end bar.` : null}
      </p>}
    </div>

    <p className="text-[14px] leading-snug text-bone/85">{lesson.overview.summary}</p>

    <div>
      <div className="mx-auto w-[200px]"><KitView bars={song.bars.slice(sec.start, sec.start + sec.bars)} /></div>
      <p className="text-center text-[11px] text-mute -mt-1">The kit lights what you hear.</p>
    </div>

    <div>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium truncate">{sec.name} · bar {localBar}</div>
          <div className="text-[12px] text-mute">{shown ? `${shown.count.timeSig} · ${shown.count.counting}` : lesson.overview.meter}</div>
        </div>
        <button aria-label="Previous bar" disabled={!sec || view <= sec.start} onClick={() => setPin(Math.max(sec.start, view - 1))} className="w-9 h-9 rounded-full bg-white/[0.06] text-lg disabled:opacity-30">‹</button>
        <button aria-label="Next bar" disabled={!sec || view >= sec.start + sec.bars - 1} onClick={() => setPin(Math.min(sec.start + sec.bars - 1, view + 1))} className="w-9 h-9 rounded-full bg-white/[0.06] text-lg disabled:opacity-30">›</button>
        {pin !== null && <button onClick={() => setPin(null)} className="h-9 px-3 rounded-full text-[13px] text-amber">Follow</button>}
      </div>
      {countFlash !== null && <div className="h-11 grid place-items-center text-[34px] leading-none font-medium text-amber tabular-nums" aria-live="polite">{countFlash}</div>}
      {shown ? <Notation bar={shown} step={P.playing && view === P.songBar ? playStep : -1} sounds={sounds} /> : <p className="mt-3 text-sm text-mute">This bar hasn’t loaded.</p>}
      <p className="mt-1.5 text-[11px] text-mute leading-snug">Amber is the note to play now. An outlined note is muted, so you play it. {shown ? `Count: ${shown.count.counting}` : ''}</p>
    </div>

    <section>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] uppercase tracking-[0.12em] text-mute">Build it up</span>
        <button aria-pressed={stepOn} onClick={() => { const next = !stepOn; setStepOn(next); if (next && voice && cur) say(cur.speak) }} className={pill(stepOn)}>Steps</button>
      </div>
      {stepOn && cur && <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
        <div className="text-[12px] text-mute tabular-nums">Step {stepI + 1} of {lesson.steps.length}</div>
        <div className="mt-0.5 text-[16px] font-medium">{cur.title}</div>
        <p className="mt-1 text-[13px] leading-snug text-bone/75">{cur.speak}</p>
        <div className="mt-3 flex gap-2">
          <button className="h-11 flex-1 rounded-xl bg-white/[0.06] text-[14px] disabled:opacity-30" disabled={stepI === 0} onClick={() => chooseStep(stepI - 1)}>Previous</button>
          <button className="h-11 flex-1 rounded-xl bg-white/[0.06] text-[14px] disabled:opacity-30" disabled={stepI >= lesson.steps.length - 1} onClick={() => chooseStep(stepI + 1)}>Next</button>
        </div>
      </div>}
    </section>

    <section>
      <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-mute">Practice tempo <span className="text-bone tabular-nums normal-case tracking-normal">{Math.min(999, Math.max(0, pct))}% · {shownBpm(song, P.bpm)} BPM</span></div>
      <input type="range" min={50} max={100} step={5} value={Math.min(100, Math.max(50, Math.round(pct / 5) * 5))} onChange={e => setPct(+e.target.value)} className="slider slider-lg no-sheet-drag w-full" style={{ height: 44 }} aria-label="Practice tempo" />
      <div className="mt-1 flex gap-1">{([['Start', lesson.tempos.startBpm], ['Middle', lesson.tempos.middleBpm], ['Full', lesson.tempos.fullBpm]] as const).map(([l, bpm]) => { const n = Math.round(bpm / (lesson.tempos.songBpm || bpm) * 100)
        return <button key={l} onClick={() => setPct(n)} className={`h-9 flex-1 rounded-full text-[13px] border active:scale-95 ${pct === n ? 'bg-bone text-ink border-bone' : 'border-white/10 text-bone/70'}`}>{l} {Math.round(bpm)}</button> })}</div>
      <p className="mt-1.5 text-[11px] text-mute leading-snug">{lesson.tempos.note}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button aria-pressed={trainer} onClick={startTrainer} className={pill(trainer)}>Speed trainer</button>
        <span className="text-[12px] text-mute">+5% every</span>
        {([2, 4, 8] as const).map(n => <button key={n} aria-pressed={every === n} onClick={() => { setEvery(n); setLoops(0) }} className={`w-9 h-9 rounded-full text-[13px] border active:scale-95 ${every === n ? 'bg-bone text-ink border-bone' : 'border-white/15 text-bone/70'}`}>{n}</button>)}
      </div>
      <p className="mt-1.5 text-[12px] text-bone/60 leading-snug">{trainer ? (pct >= 100 ? 'At full tempo.' : `${loops % every} of ${every} loops · next ${Math.min(100, pct + 5)}%`) : 'After each group of loops, the tempo climbs 5% until the recording.'}</p>
    </section>

    <div className="flex flex-wrap gap-2">
      <button aria-pressed={countIn} onClick={() => setCountIn(v => !v)} className={pill(countIn)}>Count-in</button>
      <button aria-pressed={click} onClick={() => setClick(v => !v)} className={pill(click)}>Click</button>
      <button aria-pressed={voice} onClick={() => { const next = !voice; setVoice(next); if (next) say('Counting out loud.'); else if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel() }} className={pill(voice)}>Voice</button>
    </div>

    {!!allow && allow.length === 0 && <p className="text-[13px] text-amber leading-snug">{limb === 'all' ? 'Every voice is muted. Reset the limbs below to hear the part again.' : `Nothing in this step is played by the ${limb}. Switch back to All.`}</p>}
    <div className="grid grid-cols-3 gap-1 p-0.5 rounded-full bg-white/[0.05]" role="group" aria-label="Hands and feet">
      {([['all', 'All', 'All'], ['hands', 'Hands', 'Hands only'], ['feet', 'Feet', 'Feet only']] as const).map(([k, label, name]) => <button key={k} aria-label={name} aria-pressed={limb === k} onClick={() => setLimb(k)} className={`h-9 min-w-0 rounded-full text-[13px] active:scale-95 ${limb === k ? 'bg-bone text-ink' : 'text-bone/70'}`}>{label}</button>)}
    </div>

    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-[0.12em] text-mute">What each limb does</span>
        {(limb !== 'all' || muted.length > 0 || solo.length > 0) && <button className="h-9 px-2 text-[13px] text-mute" onClick={() => { setLimb('all'); setMuted([]); setSolo([]) }}>Reset</button>}
      </div>
      <p className="text-[12px] text-bone/55 leading-snug">Right-handed kit: hats and ride in the right hand, snare in the left. Mute a voice to play it yourself. Solo it to hear it alone.</p>
      {lesson.limbs.filter(l => l.hits > 0).map(l => <article key={l.limb} className={`rounded-2xl border p-3 transition-colors duration-75 ${hotLimb(l.limb) ? 'border-amber/50 bg-amber/[0.07]' : 'border-white/[0.06] bg-white/[0.03]'}`}>
        <div className={`text-[15px] font-medium ${hotLimb(l.limb) ? 'text-amber' : ''}`}>{LIMB_NAME[l.limb]}</div>
        <p className="mt-1 text-[13px] leading-snug text-bone/75">{l.summary}</p>
        <div className="mt-2 flex flex-col gap-1.5">{l.voices.map(v => <div key={v} className="flex items-center gap-2 h-9">
          <span className={`flex-1 min-w-0 truncate text-[14px] ${sounds(v) ? '' : 'line-through text-mute'}`}>{VOICE_NAME(v)}</span>
          <button aria-label={`Mute ${VOICE_NAME(v)}`} aria-pressed={muted.includes(v)} onClick={() => toggleMute(v)} className={sq(muted.includes(v), 'mute')}>M</button>
          <button aria-label={`Solo ${VOICE_NAME(v)}`} aria-pressed={solo.includes(v)} onClick={() => toggleSolo(v)} className={sq(solo.includes(v), 'solo')}>S</button>
        </div>)}</div>
      </article>)}
    </section>

    <details className="group border-t border-white/[0.06]">
      <summary className="h-11 flex items-center justify-between text-[14px] cursor-pointer list-none [&::-webkit-details-marker]:hidden">Common mistakes <span className="text-mute text-lg leading-none group-open:rotate-90 transition-transform">›</span></summary>
      <ul className="space-y-3 pb-2">{lesson.tips.filter(t => t.kind === 'mistake').map(t => <li key={t.id} className="text-[13px] leading-snug text-bone/75">{t.text}</li>)}</ul>
    </details>
    <details className="group border-t border-white/[0.06]">
      <summary className="h-11 flex items-center justify-between text-[14px] cursor-pointer list-none [&::-webkit-details-marker]:hidden">How to practice <span className="text-mute text-lg leading-none group-open:rotate-90 transition-transform">›</span></summary>
      <ul className="space-y-2 pb-2 list-disc pl-4">{[...lesson.tips.filter(t => t.kind === 'technique').map(t => t.text), ...lesson.techniqueNotes].map(t => <li key={t} className="text-[13px] leading-snug text-bone/75">{t}</li>)}</ul>
    </details>
    {!AUTHORED[`${song.raw.id}:${selected}`] && <p className="text-[11px] text-mute leading-snug">Practice plan from this section’s notes. A written lesson replaces it.</p>}
  </div>
}
