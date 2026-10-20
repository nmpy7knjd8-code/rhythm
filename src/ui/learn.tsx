import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Voice } from '../engine/types'
import { VOICES } from '../engine/types'
import type { PulseEvent } from '../engine/audio'
import type { Song } from '../data/songs'
import { loadSongBars, sectionOf } from '../data/songs'
import { getLesson, type Lesson, type LessonBar, type Limb } from '../learn'
import { LIMBS, LIMB_NAME, VOICE_LABEL } from '../learn/speech'
import { AUTHORED } from '../learn/authored'
import { ago, bests, recallPractice, recordLoop, reviewPick, savePractice, sectionKey, type PracticeMemory } from '../learn/memory'
import { usePlayer, useHeardPos } from './player'
import { KitView } from './kitview'
import { scoredVoices } from '../midi/map'
import { ticksPerStep } from '../engine/pattern'
import { kit } from '../midi/kit'
import { lapCounts, PASS, tally } from '../midi/score'
import { SyncDetails } from './sync'
import { KitReadout, KitSettings, MARK, readout, scorer, useKit, useKitScore, useMarks, useWaitMode } from './kit'

const FEET = new Set<Voice>(['low', 'pedal'])
const VOICE_NAME = (v: Voice) => VOICE_LABEL[v][0].toUpperCase() + VOICE_LABEL[v].slice(1)
const VOICE_MARK: Record<Voice, string> = { low: 'K', back: 'S', tick: 'H', open: 'O', pedal: 'P', ride: 'R', rideBell: 'B', crash1: 'C', crash2: 'C', china: 'X', tomHi: 'T', tomMid: 'T', tomLo: 'F', accent: 'x', bell: 'B', shaker: 'Sh' }
const LIMB_SHORT: Record<Limb, string> = { rightHand: 'R hand', leftHand: 'L hand', rightFoot: 'R foot', leftFoot: 'L foot' }
/** Authored lesson for the whole section when one exists, else the derived lesson (optionally for an inclusive bar range). */
function lessonFor(song: Song, i: number, range?: [number, number]): Lesson {
  if (!range) return AUTHORED[`${song.raw.id}:${i}`] ?? getLesson(song, i)
  try { return getLesson(song, i, range) } catch { return getLesson(song, i) }
}

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

const pill = (on: boolean) => `h-11 px-4 rounded-full text-[13px] whitespace-nowrap active:scale-95 ${on ? 'bg-amber text-ink' : 'bg-white/[0.06] text-bone/80'}`
const sq = (on: boolean, kind: 'mute' | 'solo') => `w-11 h-11 rounded-full text-[13px] font-medium active:scale-95 ${on ? (kind === 'solo' ? 'bg-amber text-ink' : 'bg-bone text-ink') : 'bg-white/[0.06] text-bone/70'}`

interface Cell { voice: Voice; ghost: boolean; off: boolean; strokes: number }

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
  const minCol = syllables.some(x => x.length > 2) ? 22 : 18 // long syllables (trip, let) get a smaller font instead of wider columns
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
    // strokes faster than the grid on the same drum (rolls, tremolos, 32nds) show as tremolo slashes on the cell
    return ns[0] ? { voice: ns[0].voice, ghost: ns[0].tier === 'ghost', off: !!ns[0].frac, strokes: bar.notes.filter(n => n.step === i && n.voice === ns[0].voice).length } : null
  }) }))
  const span = (a: number, b: number) => Array.from({ length: b - a }, (_, j) => a + j)
  const marks = useMarks(bar.songBar)
  return <div className="mt-2" role="img" aria-label="Bar notation with the count under each beat">
    {lines.map(([a, b]) => <div key={a} className={a > 0 ? 'mt-3' : ''}>
      {rows.map(({ limb, cells }) => {
        const hot = step >= a && step < b && !!cells[step]
        return <div key={limb} className="flex items-stretch">
          <span className={`w-12 shrink-0 self-center text-[13px] leading-none ${hot ? 'text-amber' : 'text-mute'}`}>{LIMB_SHORT[limb]}</span>
          <div className="flex-1"><div className="flex" style={{ width: `${(b - a) / widest * 100}%` }}>
            {span(a, b).map(i => {
              const c = cells[i], now = i === step, mine = c ? !sounds(c.voice) : false
              return <div key={i} data-s={i} className={`relative flex-1 h-9 flex items-center justify-center ${beatStart.has(i) && i > a ? 'border-l border-white/10' : ''} ${now ? 'bg-amber/20' : ''}`}>
                {c && <span className={`grid place-items-center rounded-full font-semibold leading-none transition-transform duration-75 ${c.ghost || c.off ? 'w-3.5 h-3.5 text-[8px]' : 'w-[18px] h-[18px] text-[10px]'} ${now && !mine ? 'bg-amber text-ink scale-110' : mine ? 'bg-transparent text-bone/70 ring-1 ring-bone/40' : 'bg-bone/85 text-ink'}`}>{VOICE_MARK[c.voice]}</span>}
                {c && marks?.get(`${i}:${c.voice}`) && (({ m }) => <span data-mark={m} className={`absolute bottom-0 right-0 text-[10px] leading-none font-semibold ${MARK[m].color}`}>{m === 'early' ? '←' : m === 'late' ? '→' : m === 'on' ? '•' : '×'}</span>)(marks.get(`${i}:${c.voice}`)!)}
                {c && c.strokes > 1 && <span aria-label={`${c.strokes} strokes`} className={`absolute top-0 left-1/2 ml-1.5 text-[9px] leading-none font-semibold tracking-[-0.15em] ${now ? 'text-amber' : 'text-bone/70'}`}>{'/'.repeat(c.strokes > 4 ? 3 : c.strokes > 2 ? 2 : 1)}</span>}
              </div>
            })}
          </div></div>
        </div>
      })}
      <div className="flex mt-0.5">
        <span className="w-12 shrink-0" />
        <div className="flex-1"><div className="flex" style={{ width: `${(b - a) / widest * 100}%` }}>{span(a, b).map(i => <span key={i} className={`flex-1 text-center leading-none py-1 ${beatStart.has(i) ? 'text-[13px]' : syllables[i].length > 2 ? 'text-[9px] tracking-tight' : 'text-[11px]'} ${i === step ? 'text-amber' : beatStart.has(i) ? 'text-bone' : 'text-mute'}`}>{syllables[i]}</span>)}</div></div>
      </div>
      {showStick && <div className="flex">
        <span className="w-12 shrink-0 text-[13px] text-mute self-center">Stick</span>
        <div className="flex-1"><div className="flex" style={{ width: `${(b - a) / widest * 100}%` }}>{span(a, b).map(i => <span key={i} className={`flex-1 text-center text-[10px] leading-none py-0.5 ${i === step ? 'text-amber' : 'text-mute'}`}>{sticking[i]}</span>)}</div></div>
      </div>}
    </div>)}
  </div>
}

/** A labelled native select: compact, 44 px tall, and the phone's own picker. */
function Choice({ label, value, options, show, set }: { label: string; value: number; options: number[]; show: (n: number) => string; set: (n: number) => void }) {
  return <label className="flex flex-col gap-0.5 text-[13px] text-mute">{label}
    <select value={value} onChange={e => set(+e.target.value)} className="h-11 w-full min-w-0 rounded-xl bg-white/[0.06] px-2 text-[15px] text-bone tabular-nums">
      {options.map(n => <option key={n} value={n}>{show(n)}</option>)}
    </select>
  </label>
}

/** Learn the section that's playing: notation, limbs, and the practice tools. */
export function LearnPanel() {
  const P = usePlayer()
  const song = P.song!
  // getLesson needs the song's bars: load them before the panel (and its hooks) render
  const [ready, setReady] = useState(song.bars.length > 0)
  const [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (song.bars.length) { setReady(true); return }
    let on = true; setFailed(false)
    loadSongBars(song).then(() => { if (on) setReady(true) }, () => { if (on) setFailed(true) })
    return () => { on = false }
  }, [song, attempt])
  if (ready && song.bars.length) return <Learn />
  if (failed) return <div className="flex items-center gap-3 text-[15px] text-mute">Couldn't load this song.<button onClick={() => setAttempt(n => n + 1)} className="h-11 px-4 rounded-full bg-white/[0.06] text-bone">Retry</button></div>
  return <p className="text-[15px] text-mute">Loading the part…</p>
}

function Learn() {
  const P = usePlayer()
  const song = P.song!
  const saved = recallPractice(song.raw.id)
  const [countIn, setCountIn] = useState(saved?.countIn ?? false)
  const [click, setClick] = useState(saved?.click ?? false)
  const [voice, setVoice] = useState(saved?.voice ?? false)
  const [limb, setLimb] = useState<PracticeMemory['limb']>(saved?.limb ?? 'all')
  const [muted, setMuted] = useState<Voice[]>([]) // mutes and solos are for this visit only
  const [solo, setSolo] = useState<Voice[]>([])
  const [stepOn, setStepOn] = useState(saved?.stepOn ?? false)
  const [step, setStep] = useState(saved?.step ?? 0)
  const [trainer, setTrainer] = useState(saved?.trainer ?? false)
  const [from, setFrom] = useState(saved?.from ?? 60)
  const [to, setTo] = useState(saved?.to ?? 100)
  const [by, setBy] = useState(saved?.by ?? 5)
  const [every, setEvery] = useState<PracticeMemory['every']>(saved?.every ?? 2)
  const [callResp, setCallResp] = useState(false)
  const [yours, setYours] = useState(false)
  const [loops, setLoops] = useState(saved?.loops ?? 0)
  const [pin, setPin] = useState<number | null>(saved?.pin ?? null)
  const [countFlash, setCountFlash] = useState<number | null>(null)
  const [kitOpen, setKitOpen] = useState(false)
  const k = useKit(), connected = k.status === 'connected'
  const [kitPanel, setKitPanel] = useState(false)
  useEffect(() => { void kit.auto() }, [])

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
  // a section the drummer sits out: no lesson, just a way on to the next section with drums (after this one, else from the top)
  const silent = full.steps.length === 0
  const nextDrums = useMemo(() => {
    if (!silent) return -1
    const order = song.sections.map((_, k) => (selected + 1 + k) % song.sections.length)
    return order.find(k => k !== selected && lessonFor(song, k).steps.length > 0) ?? -1
  }, [silent, song, selected])
  const stepI = Math.min(step, Math.max(0, lesson.steps.length - 1))
  const cur = lesson.steps[stepI]
  const allow = useMemo(() => allowedVoices(limb, muted, solo), [limb, muted, solo])
  const scored = useMemo(() => scoredVoices(limb, muted, solo), [limb, muted, solo])
  // stacked layers: on a step, each lesson bar plays that step's pattern (the full bar with the later layers removed)
  const stepBars = useMemo(() => stepOn && cur ? new Map(cur.bars.map(b => [b.songBar, b.pattern])) : null, [stepOn, cur])

  const sec = song.sections[selected]
  const heard = useHeardPos()
  const playStep = heard?.step ?? -1
  const nowBar = heard?.bar ?? P.songBar
  const inSec = !!sec && nowBar >= sec.start && nowBar < sec.start + sec.bars
  const followed = pin !== null && sec && pin >= sec.start && pin < sec.start + sec.bars ? pin : inSec ? nowBar : (sec?.start ?? 0)
  // what the drummer should play in a song bar: the step being practised when its grid matches, else the full bar
  const scorePattern = (bar: number) => { const p = song.bars[bar], o = stepBars?.get(bar); return o && p && o.steps === p.steps && ticksPerStep(o) === ticksPerStep(p) ? o : p }
  const [wait, setWait] = useState(false)
  const waitRange: [number, number] = P.barLoop ? [P.barLoop[0], P.barLoop[1] + 1] : sec ? [sec.start, sec.start + sec.bars] : [0, 1]
  const waitPos = useWaitMode(wait && connected && !silent, scorePattern, scored, waitRange, followed, `${[...scored].sort()}|${stepOn ? stepI : '-'}`)
  const view = waitPos ? waitPos.bar : followed
  const shown: LessonBar | undefined = (stepOn && cur ? cur.bars : full.bars).find(b => b.songBar === view) ?? full.bars.find(b => b.songBar === view)


  const sounds = (v: Voice) => !allow || allow.includes(v)
  const pct = Math.round((P.bpm / (song.raw.bpm || 1)) * 100)
  const loopR: [number, number] | null = P.barLoop ? [P.barLoop[0], P.barLoop[1] + 1] : P.loopSection !== null && song.sections[P.loopSection] ? [song.sections[P.loopSection].start, song.sections[P.loopSection].start + song.sections[P.loopSection].bars] : null

  // a lap counts toward the best tempo when it is the whole section, the full part (not a step), at one tempo throughout
  const secKey = sec ? sectionKey(selected, sec.name) : ''
  const counts = !silent && !callResp && !P.barLoop && P.loopSection === selected && (!stepOn || stepI === lesson.steps.length - 1)
  const [records, setRecords] = useState(() => bests(song.raw.id))
  const [kitBest, setKitBest] = useState(() => kit.best(song.raw.id, secKey))
  useEffect(() => setKitBest(kit.best(song.raw.id, secKey)), [song.raw.id, secKey])
  const live = useRef({ playing: P.playing, range: loopR, pct, base: song.raw.bpm, to, by, every, trainer, loops, counts, secKey, callResp, kit: connected })
  live.current = { playing: P.playing, range: loopR, pct, base: song.raw.bpm, to, by, every, trainer, loops, counts, secKey, callResp, kit: connected }
  const lapT = useRef<number | null>(null)
  /** Audio time the latest pass through song bar `a` started (from the engine's heard-step timeline). */
  const barStartT = (a: number) => { const tl = P.learn.clock().timeline; for (let i = tl.length - 1; i >= 0; i--) if (tl[i].bar === a && tl[i].step === 0) return tl[i].t; return null }
  const lap = useRef<{ key: string; pct: number } | null>(null)
  const setBpm = useRef(P.setBpm); setBpm.current = P.setBpm
  const onPulse = useRef<(e: PulseEvent) => void>(() => {})
  const onBar = useRef<(bar: number, yours: boolean) => void>(() => {})
  const lastBar = useRef<number | null>(null)
  const loopKey = useRef('')

  onPulse.current = e => {
    if (e.countIn) setCountFlash(e.beat + 1)
    else if (countFlash !== null) setCountFlash(null)
  }
  onBar.current = (bar, mine) => {
    setYours(mine)
    const L = live.current
    const key = L.range ? `${L.range[0]}:${L.range[1]}` : ''
    if (key !== loopKey.current) { loopKey.current = key; lastBar.current = null }
    const prev = lastBar.current
    lastBar.current = bar
    if (!L.playing || !L.range) return
    const [a, b] = L.range
    // in 'I play, you play' a loop ends only where a heard bar begins, so each heard bar and the played bar after it share one tempo
    // (a one-bar or odd-length loop then takes two laps: once heard, once played)
    const boundary = bar === a && !(L.callResp && mine)
    if (prev === null) { lap.current = boundary ? { key, pct: L.pct } : null; lapT.current = boundary ? barStartT(a) : null; return } // a lap only counts from the loop's first bar
    const wrapped = b - a === 1 ? prev === a && bar === a : prev === b - 1 && bar === a
    if (!wrapped || !boundary) return
    // a connected kit scores the lap that just ended: notes already judged between the two downbeats
    const t0 = barStartT(a), from = lapT.current; lapT.current = t0
    const score = L.kit && from !== null && t0 !== null ? tally(scorer.between(from, t0)) : null
    if (score?.total) readout.set({ ...readout.get(), lap: score })
    // a full lap: from the loop's first bar round to it again, at one tempo throughout
    const full = lap.current?.key === key && lap.current.pct === L.pct
    lap.current = { key, pct: L.pct }
    if (!full) return
    if (L.counts) { recordLoop(song.raw.id, L.secKey, L.pct); setRecords(bests(song.raw.id)) }
    if (L.counts && score?.total) { kit.recordBest(song.raw.id, L.secKey, score.score, L.pct); setKitBest(kit.best(song.raw.id, L.secKey)) }
    if (!L.trainer) return
    if (L.kit && !lapCounts(score)) return // with a kit, a loop with notes to score counts only when played well
    const n = L.loops + 1
    L.loops = n; setLoops(n)
    if (n % L.every !== 0 || L.pct >= L.to) return
    const next = Math.min(L.to, L.pct + L.by)
    L.pct = next; lap.current = { key, pct: next }
    setBpm.current(L.base * next / 100)
  }
  useEffect(() => { if (!P.playing) { lastBar.current = null; lap.current = null; lapT.current = null } }, [P.playing])

  const { learn } = P
  useEffect(() => {
    // Only subscribe while something is listening. An idle tab adds no callbacks to the scheduler.
    learn.onPulse(countIn ? e => onPulse.current(e) : null)
    learn.onBar(!silent ? (bar, mine) => onBar.current(bar, mine) : null)
    return () => { learn.onPulse(null); learn.onBar(null) }
  }, [learn, countIn, silent])
  useEffect(() => () => { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel() }, [])
  useKitScore({ active: connected && P.playing && !silent, clock: learn.clock, voices: scored, pattern: scorePattern })
  const wasPlaying = useRef(P.playing)
  useEffect(() => { if (P.playing && !wasPlaying.current) setWait(false); wasPlaying.current = P.playing }, [P.playing]) // pressing Play leaves wait mode
  // the kit as a remote: Tom 1 + Tom 2 + kick together start playback (only while stopped, so a fill never stops it)
  const start = useRef(() => {}); start.current = () => { if (!P.playing && !wait) void P.toggle() } // never while waiting: a tom+kick fill must not end Wait mode
  useEffect(() => connected ? kit.onRemote(() => start.current()) : undefined, [connected])
  useEffect(() => readout.set({ last: null, lap: null, wait: null }), [song.raw.id, selected])
  useEffect(() => { learn.callResponse(callResp); setYours(false); return () => learn.callResponse(false) }, [learn, callResp])
  useEffect(() => {
    learn.voices(allow)
    learn.bars(stepBars)
    learn.metronome(click)
    learn.countIn(countIn)
  }, [learn, allow, stepBars, click, countIn])
  // spoken count: recorded clips scheduled by the engine on each grid step (numbers only when the subdivisions get fast)
  const countMap = useMemo(() => voice ? new Map([...full.bars, ...lesson.bars].map(b => [b.songBar, b.count.beats.flatMap(x => x.grid)])) : null, [voice, full, lesson])
  useEffect(() => { learn.count(countMap) }, [learn, countMap])
  useEffect(() => () => learn.count(null), [learn])

  useEffect(() => { savePractice(song.raw.id, { countIn, click, voice, limb, stepOn, step: stepI, trainer, from, to, by, every, loops, pin }) }, [song.raw.id, countIn, click, voice, limb, stepOn, stepI, trainer, from, to, by, every, loops, pin])

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
    setTrainer(next)
    if (next) setPct(from); else { setLoops(0); live.current.loops = 0 }
    if (next && !P.barLoop && P.loopSection === null && sec) P.setLoopSection(selected)
  }

  const localBar = sec ? view - sec.start + 1 : 1
  const playingNotes = full.bars.find(b => b.songBar === (heard?.bar ?? P.songBar))?.notes ?? []
  const hotLimb = (l: Limb) => P.playing && playStep >= 0 && playingNotes.some(n => n.limb === l && n.step === playStep)

  if (!sec) return <p className="text-[15px] text-mute">Loading the part…</p>

  // progress: this section's best tempo, and one earlier-practised section worth a revisit
  const mine = records[secKey]
  const keys = song.sections.map((x, i) => sectionKey(i, x.name)), dueKey = reviewPick(records, keys, secKey)
  const due = dueKey ? { index: keys.indexOf(dueKey), best: records[dueKey] } : null
  const looping = !!P.barLoop || P.loopSection !== null
  const toggleSteps = () => { const next = !stepOn; setStepOn(next); if (next && voice && cur) say(cur.speak) }
  const nudge = (d: number) => setPct(Math.min(100, Math.max(50, Math.round(pct / 5) * 5 + d)))
  const details = (label: string, body: ReactNode, onToggle?: (open: boolean) => void) => <details className="group" onToggle={onToggle && (e => onToggle((e.currentTarget as HTMLDetailsElement).open))}>
    <summary className="h-11 flex items-center justify-between text-[15px] cursor-pointer list-none [&::-webkit-details-marker]:hidden">{label} <span className="text-mute text-lg leading-none group-open:rotate-90 transition-transform">›</span></summary>
    {body}
  </details>

  return <div className="space-y-4">
    <div ref={secRow} className="relative flex gap-1.5 overflow-x-auto no-sheet-drag -mx-4 px-4 pb-0.5" aria-label="Sections">
      {song.sections.map((s, i) => <button key={i} data-active={i === selected || undefined} aria-pressed={i === selected} onClick={() => lockSection(i)} className={`shrink-0 max-w-[148px] truncate ${pill(i === selected)}`}>{s.name}</button>)}
    </div>

    {due && <div className="-my-1 flex items-center gap-2 text-[13px] text-mute">
      <button onClick={() => lockSection(due.index)} className="h-11 min-w-0 truncate text-left text-amber">Review {song.sections[due.index].name}: {due.best.pct}%, {ago(due.best.last)}</button>
    </div>}

    <div>
      <div ref={barRow} className="relative flex gap-1 overflow-x-auto no-sheet-drag -mx-4 px-4" aria-label={`${sec.name} bars`}>
        {Array.from({ length: sec.bars }, (_, j) => {
          const n = sec.start + j
          const inR = !!P.barLoop && n >= P.barLoop[0] && n <= P.barLoop[1]
          return <button key={n} data-active={(P.playing && n === P.songBar) || undefined} aria-label={`Learn bar ${n + 1}`} onClick={() => { setPin(null); P.pickBar(n) }} className={`shrink-0 w-11 h-11 rounded-lg text-[13px] tabular-nums ${inR ? 'bg-amber text-ink font-medium' : P.loopPick === n ? 'ring-1 ring-amber text-amber bg-amber/10' : 'bg-white/[0.06] text-bone/75'} ${n === P.songBar && P.playing ? 'outline outline-1 outline-bone/70' : ''}`}>{j + 1}</button>
        })}
      </div>
      {(P.barLoop || P.loopPick !== null) && <p className="mt-1.5 text-[13px] text-bone/60 leading-snug">
        {P.barLoop ? <>Looping bars {P.barLoop[0] - sec.start + 1}–{P.barLoop[1] - sec.start + 1}. <button className="h-11 -my-3 px-1 text-amber underline underline-offset-2" onClick={P.clearBarLoop}>Clear</button></> : P.loopPick !== null ? `Bar ${P.loopPick - sec.start + 1} selected. Tap the end bar.` : null}
      </p>}
    </div>

    {silent ? <div className="card p-3">
      <div className="text-[16px] font-medium">No drums here</div>
      <p className="mt-1 text-[15px] leading-snug text-bone">The drums sit out {sec.name}.</p>
      {nextDrums >= 0 && <button onClick={() => lockSection(nextDrums)} className="mt-3 h-11 w-full rounded-xl bg-amber text-ink text-[15px] font-medium truncate px-3">Go to {song.sections[nextDrums].name}</button>}
    </div> : <>
    {/* the practice bar: what you reach for while playing, kept in reach above the notation as the page scrolls (Play is in the sheet header, always visible) */}
    <div className="sticky -top-4 z-10 -mx-4 px-4 py-2 bg-[#141416] flex items-center gap-1.5" role="toolbar" aria-label="Practice">
      <div className="flex items-center rounded-full bg-white/[0.06]">
        <button aria-label="Slower" disabled={pct <= 50} onClick={() => nudge(-5)} className="w-11 h-11 text-xl leading-none disabled:opacity-30">−</button>
        <span className="w-12 text-center text-[15px] tabular-nums">{pct}%</span>
        <button aria-label="Faster" disabled={pct >= 100} onClick={() => nudge(5)} className="w-11 h-11 text-xl leading-none disabled:opacity-30">+</button>
      </div>
      <button aria-pressed={stepOn} onClick={toggleSteps} className={`h-11 px-4 rounded-full text-[15px] active:scale-95 ${stepOn ? 'bg-amber text-ink' : 'bg-white/[0.06] text-bone/80'}`}>Steps</button>
      <button aria-pressed={looping} onClick={() => P.setLoopSection(looping ? null : selected)} className={`h-11 px-4 rounded-full text-[15px] active:scale-95 ${looping ? 'bg-amber text-ink' : 'bg-white/[0.06] text-bone/80'}`}>Loop</button>
    </div>

    <div>
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium truncate">{sec.name} · bar {localBar}</div>
          <div className="flex gap-2 text-[13px] text-mute">
            <span className="min-w-0 truncate">{shown ? `${shown.count.timeSig} · ${shown.count.counting}` : lesson.overview.meter}</span>
            {mine && <span className="ml-auto shrink-0 tabular-nums">Best <span className="text-bone">{mine.pct}%</span>, {ago(mine.last)}</span>}
          </div>
        </div>
        {pin !== null && <button onClick={() => setPin(null)} className="h-11 px-3 rounded-full text-[13px] text-amber">Follow</button>}
        <button aria-label="Previous bar" disabled={!sec || view <= sec.start} onClick={() => setPin(Math.max(sec.start, view - 1))} className="w-11 h-11 rounded-full bg-white/[0.06] text-lg disabled:opacity-30">‹</button>
        <button aria-label="Next bar" disabled={!sec || view >= sec.start + sec.bars - 1} onClick={() => setPin(Math.min(sec.start + sec.bars - 1, view + 1))} className="w-11 h-11 rounded-full bg-white/[0.06] text-lg disabled:opacity-30">›</button>
      </div>
      {connected && <KitReadout best={kitBest} />}
      {callResp && <div className={`mt-1 h-7 text-[15px] font-medium ${P.playing && yours ? 'text-amber' : 'text-bone/70'}`} aria-live="polite">{P.playing ? (yours ? 'Your turn: play this bar' : 'Listen') : 'I play, you play: press Play'}</div>}
      <div className="relative">
        {shown ? <Notation bar={shown} step={waitPos ? (view === waitPos.bar ? waitPos.step : -1) : P.playing && heard && view === heard.bar ? playStep : -1} sounds={sounds} /> : <p className="mt-3 text-[15px] text-mute">This bar hasn’t loaded.</p>}
        {/* the count-in is a small badge over the notation's corner: nothing moves, and the first bar stays readable */}
        {countFlash !== null && <div className="absolute -top-1 right-0 w-11 h-11 rounded-full grid place-items-center bg-amber text-ink text-[22px] leading-none font-semibold tabular-nums shadow-lg shadow-black/50 pointer-events-none" aria-live="polite">{countFlash}</div>}
      </div>
      <p className="mt-1.5 text-[13px] text-bone leading-snug">Amber is the note to play now. An outlined note is muted, so you play it.</p>
    </div>

    {stepOn && cur && <div className="card p-3">
      <div className="text-[13px] text-mute tabular-nums">Step {stepI + 1} of {lesson.steps.length}</div>
      <div className="mt-0.5 text-[16px] font-medium">{cur.title}</div>
      <p className="mt-1 text-[15px] leading-snug text-bone">{cur.speak}</p>
      <div className="mt-3 flex gap-2">
        <button className="h-11 flex-1 rounded-xl bg-white/[0.06] text-[15px] disabled:opacity-30" disabled={stepI === 0} onClick={() => chooseStep(stepI - 1)}>Previous</button>
        <button className="h-11 flex-1 rounded-xl bg-white/[0.06] text-[15px] disabled:opacity-30" disabled={stepI >= lesson.steps.length - 1} onClick={() => chooseStep(stepI + 1)}>Next</button>
      </div>
    </div>}

    <section>
      <div className="mb-1 text-[13px] text-mute">Practice tempo <span className="text-bone tabular-nums">{Math.min(999, Math.max(0, pct))}% · {Math.round(lesson.tempos.songBpm * pct / 100)} BPM</span></div>
      <input type="range" min={50} max={100} step={5} value={Math.min(100, Math.max(50, Math.round(pct / 5) * 5))} onChange={e => setPct(+e.target.value)} className="slider slider-lg no-sheet-drag w-full" style={{ height: 44 }} aria-label="Practice tempo" />
      <div className="mt-1 flex gap-1">{([['Start', lesson.tempos.startBpm], ['Middle', lesson.tempos.middleBpm], ['Full', lesson.tempos.fullBpm]] as const).map(([l, bpm]) => { const n = Math.round(bpm / (lesson.tempos.songBpm || bpm) * 100)
        return <button key={l} onClick={() => setPct(n)} className={`h-11 flex-1 rounded-full text-[13px] active:scale-95 ${pct === n ? 'bg-bone text-ink' : 'bg-white/[0.06] text-bone/70'}`}>{l} {Math.round(bpm)}</button> })}</div>
      <p className="mt-1.5 text-[13px] text-bone leading-snug">{lesson.tempos.note}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button aria-pressed={trainer} onClick={startTrainer} className={pill(trainer)}>Speed trainer</button>
        <span className="text-[13px] text-mute text-right">{trainer ? (pct >= to ? `At ${to}%.` : `${loops % every} of ${every} full loop${every > 1 ? 's' : ''}${connected ? ` at ${PASS * 100}%+` : ''} · next ${Math.min(to, pct + by)}%`) : connected ? `Climbs after full loops at ${PASS * 100}%+` : 'Climbs only after full loops'}</span>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        <Choice label="From" value={from} options={[50, 55, 60, 65, 70, 75, 80, 85, 90, 95]} show={n => `${n}%`} set={n => { setFrom(n); if (n >= to) setTo(Math.min(100, n + 5)) }} />
        <Choice label="To" value={to} options={[55, 60, 65, 70, 75, 80, 85, 90, 95, 100].filter(n => n > from)} show={n => `${n}%`} set={setTo} />
        <Choice label="Climb" value={by} options={[2, 5, 10]} show={n => `+${n}%`} set={setBy} />
        <Choice label="Loops" value={every} options={[1, 2, 4, 8]} show={n => `×${n}`} set={n => { setEvery(n as PracticeMemory['every']); setLoops(0); live.current.loops = 0 }} />
      </div>
    </section>

    <div className="flex flex-wrap gap-2">
      <button aria-pressed={countIn} onClick={() => setCountIn(v => !v)} className={pill(countIn)}>Count-in</button>
      <button aria-pressed={click} onClick={() => setClick(v => !v)} className={pill(click)}>Click</button>
      <button aria-pressed={voice} onClick={() => setVoice(!voice)} className={pill(voice)}>Voice</button>
      <button aria-pressed={callResp} onClick={() => setCallResp(v => !v)} className={pill(callResp)}>I play, you play</button>
      {connected && !silent && <button aria-pressed={wait} onClick={() => { if (P.playing) void P.toggle(); setWait(v => !v) }} className={pill(wait)}>Wait mode</button>}
      {k.supported && <button aria-pressed={kitPanel} onClick={() => { setKitPanel(v => !v); if (k.status === 'off') void kit.connect() }} className={pill(kitPanel)}>{connected ? 'Kit' : 'Connect kit'}</button>}
    </div>
    {kitPanel && <KitSettings before={async () => { if (P.playing) await P.toggle() }} />}
    {callResp && <p className="-mt-2 text-[13px] text-bone leading-snug">A bar of the part, then a bar of click alone for you to play it back.</p>}

    {!!allow && allow.length === 0 && <p className="text-[15px] text-amber leading-snug">{limb === 'all' ? 'Every voice is muted. Reset the limbs below to hear the part again.' : `Nothing in this step is played by the ${limb}. Switch back to All.`}</p>}
    <div className="grid grid-cols-3 gap-1 p-0.5 rounded-full bg-white/[0.05]" role="group" aria-label="Hands and feet">
      {([['all', 'All', 'All'], ['hands', 'Hands', 'Hands only'], ['feet', 'Feet', 'Feet only']] as const).map(([k, label, name]) => <button key={k} aria-label={name} aria-pressed={limb === k} onClick={() => setLimb(k)} className={`h-11 min-w-0 rounded-full text-[13px] active:scale-95 ${limb === k ? 'bg-bone text-ink' : 'text-bone/70'}`}>{label}</button>)}
    </div>

    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-mute">What each limb does</span>
        {(limb !== 'all' || muted.length > 0 || solo.length > 0) && <button className="h-11 px-2 text-[13px] text-mute" onClick={() => { setLimb('all'); setMuted([]); setSolo([]) }}>Reset</button>}
      </div>
      <p className="text-[15px] text-bone leading-snug">Right-handed kit: hats and ride in the right hand, snare in the left. Mute a voice to play it yourself. Solo it to hear it alone.</p>
      {lesson.limbs.filter(l => l.hits > 0).map(l => <article key={l.limb} className={`card p-3 transition-colors duration-75 ${hotLimb(l.limb) ? 'bg-amber/20' : ''}`}>
        <div className={`text-[15px] font-medium ${hotLimb(l.limb) ? 'text-amber' : ''}`}>{LIMB_NAME[l.limb]}</div>
        <p className="mt-1 text-[15px] leading-snug text-bone">{l.summary}</p>
        <div className="mt-2 flex flex-col gap-1">{l.voices.map(v => <div key={v} className="flex items-center gap-2 h-11">
          <span className={`flex-1 min-w-0 truncate text-[15px] ${sounds(v) ? '' : 'line-through text-mute'}`}>{VOICE_NAME(v)}</span>
          <button aria-label={`Mute ${VOICE_NAME(v)}`} aria-pressed={muted.includes(v)} onClick={() => toggleMute(v)} className={sq(muted.includes(v), 'mute')}>M</button>
          <button aria-label={`Solo ${VOICE_NAME(v)}`} aria-pressed={solo.includes(v)} onClick={() => toggleSolo(v)} className={sq(solo.includes(v), 'solo')}>S</button>
        </div>)}</div>
      </article>)}
    </section>

    <div>
      {/* first of the folded panels: Bluetooth users need it before anything else */}
      {!kitPanel && <SyncDetails before={async () => { if (P.playing) await P.toggle() }} />}
      {details('About this section', <div className="pb-2">
        <p className="text-[15px] leading-snug text-bone">{lesson.overview.summary}</p>
        {/* the kit only mounts (and animates) while this is open */}
        {kitOpen && <div className="mt-2"><div className="mx-auto w-[200px]"><KitView bars={song.bars.slice(sec.start, sec.start + sec.bars)} /></div>
          <p className="text-center text-[13px] text-bone -mt-1">The kit lights what you hear.</p></div>}
      </div>, setKitOpen)}
      {details('Common mistakes', <ul className="space-y-3 pb-2">{lesson.tips.filter(t => t.kind === 'mistake').map(t => <li key={t.id} className="text-[15px] leading-snug text-bone">{t.text}</li>)}</ul>)}
      {details('How to practice', <ul className="space-y-2 pb-2 list-disc pl-4">{[...lesson.tips.filter(t => t.kind === 'technique').map(t => t.text), ...lesson.techniqueNotes].map(t => <li key={t} className="text-[15px] leading-snug text-bone">{t}</li>)}</ul>)}
    </div>
    {!AUTHORED[`${song.raw.id}:${selected}`] && <p className="text-[13px] text-bone leading-snug">Practice plan from this section’s notes. A written lesson replaces it.</p>}
    </>}
  </div>
}
