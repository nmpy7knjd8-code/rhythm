import { useEffect, useMemo, useRef, useState } from 'react'
import type { Pattern, Voice } from '../engine/types'
import { VOICES } from '../engine/types'
import { ticksPerStep, velocityOf } from '../engine/pattern'
import type { PulseEvent } from '../engine/audio'
import type { Song } from '../data/songs'
import { loadSongBars, shownBpm } from '../data/songs'
import { getLesson, type Lesson } from '../learn/types'
import { FEET, LIMB_OF, VOICE_MARK, VOICE_NAME, handSticking, syllablesFor } from '../learn/derive'
import { recallPractice, savePractice, type PracticeMemory } from '../learn/memory'
import { usePlayer } from './player'
import { KitView } from './kitview'

const sectionOf = (s: Song, bar: number) => Math.max(0, s.sections.findIndex(x => bar >= x.start && bar < x.start + x.bars))

/** null = no practice filter, so the engine plays the full mix. */
function allowedVoices(limb: PracticeMemory['limb'], muted: Voice[], solo: Voice[], step: Voice[] | null): Voice[] | null {
  if (limb === 'all' && !muted.length && !solo.length && !step) return null
  let list: Voice[] = limb === 'feet' ? [...FEET] : limb === 'hands' ? VOICES.filter(v => !FEET.has(v)) : [...VOICES]
  if (step) list = list.filter(v => step.includes(v))
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

interface Cell { voice: Voice; vel: number; ghost: boolean }

function cellsOf(p: Pattern, voices: Voice[]): (Cell | null)[] {
  return Array.from({ length: p.steps }, (_, i) => {
    let best: Cell | null = null
    for (const v of voices) {
      const vel = velocityOf(p.tracks[v]?.[i])
      if (vel > 0 && (!best || vel > best.vel)) best = { voice: v, vel, ghost: vel <= 0.35 }
    }
    if (!best) for (const v of voices) if (p.sub?.[v]?.[String(i)]?.length) best = { voice: v, vel: 0.45, ghost: true }
    return best
  })
}

/** Big bar grid: one row per limb, the count under the beats, the current note lit. */
function Notation({ pattern, step, sounds }: { pattern: Pattern; step: number; sounds: (v: Voice) => boolean }) {
  const spb = Math.max(1, pattern.stepsPerBeat || 1)
  const syllables = syllablesFor(pattern)
  const sticking = handSticking(pattern)
  const showStick = sticking.some(s => s !== '·')
  const minCol = syllables.some(s => s.length > 2) ? 34 : 18
  const wide = pattern.steps * minCol + 48 > 364
  const rows = LIMB_OF.map(limb => ({ limb, cells: cellsOf(pattern, limb.voices) }))
  return <div className={`mt-2 ${wide ? 'overflow-x-auto no-sheet-drag -mx-4 px-4' : ''}`}>
    <div role="img" aria-label="Bar notation with the count under each beat" style={{ minWidth: wide ? pattern.steps * minCol + 48 : undefined }}>
      {rows.map(({ limb, cells }) => {
        const hot = step >= 0 && !!cells[step]
        return <div key={limb.id} className="flex items-stretch">
          <span className={`w-12 shrink-0 self-center text-[11px] leading-none ${hot ? 'text-amber' : 'text-mute'}`}>{limb.short}</span>
          <div className="flex-1 flex">
            {cells.map((c, i) => {
              const now = i === step
              const mine = c ? !sounds(c.voice) : false
              return <div key={i} className={`flex-1 h-9 flex items-center justify-center ${i % spb === 0 && i > 0 ? 'border-l border-white/10' : ''} ${now ? 'bg-amber/20' : ''}`}>
                {c && <span className={`grid place-items-center rounded-full font-semibold leading-none transition-transform duration-75 ${c.ghost ? 'w-3.5 h-3.5 text-[8px]' : 'w-[18px] h-[18px] text-[10px]'} ${now && !mine ? 'bg-amber text-ink scale-110' : mine ? 'bg-transparent text-bone/70 ring-1 ring-bone/40' : 'bg-bone/85 text-ink'}`}>{VOICE_MARK[c.voice]}</span>}
              </div>
            })}
          </div>
        </div>
      })}
      <div className="flex mt-0.5">
        <span className="w-12 shrink-0" />
        <div className="flex-1 flex">{syllables.map((s, i) => <span key={i} className={`flex-1 text-center leading-none py-1 ${i % spb === 0 ? 'text-[13px]' : 'text-[11px]'} ${i === step ? 'text-amber' : i % spb === 0 ? 'text-bone' : 'text-mute'}`}>{s}</span>)}</div>
      </div>
      {showStick && <div className="flex">
        <span className="w-12 shrink-0 text-[10px] text-mute self-center">Stick</span>
        <div className="flex-1 flex">{sticking.map((s, i) => <span key={i} className={`flex-1 text-center text-[10px] leading-none py-0.5 ${i === step ? 'text-amber' : 'text-mute'}`}>{s === '·' ? '' : s}</span>)}</div>
      </div>}
    </div>
  </div>
}

/** Learn the section that's playing: notation, limbs, and the practice tools. */
export function LearnPanel() {
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
  const [ready, setReady] = useState(song.bars.length > 0)

  useEffect(() => { if (song.bars.length) { setReady(true); return }; let on = true; void loadSongBars(song).then(() => { if (on) setReady(true) }); return () => { on = false } }, [song])

  const selected = P.barLoop ? sectionOf(song, P.barLoop[0]) : P.loopSection !== null ? P.loopSection : sectionOf(song, P.songBar)
  const lesson: Lesson = useMemo(() => getLesson(song, selected), [song, selected, ready])
  const stepI = Math.min(step, Math.max(0, lesson.steps.length - 1))
  const cur = lesson.steps[stepI]
  const allow = useMemo(() => allowedVoices(limb, muted, solo, stepOn ? cur?.voices ?? null : null), [limb, muted, solo, stepOn, cur])

  const sec = song.sections[selected]
  const inSec = !!sec && P.songBar >= sec.start && P.songBar < sec.start + sec.bars
  const view = pin !== null && sec && pin >= sec.start && pin < sec.start + sec.bars ? pin : inSec ? P.songBar : (sec?.start ?? 0)
  const real = song.bars[view]
  const practicePat = stepOn && cur?.pattern && real && cur.pattern.steps === real.steps && ticksPerStep(cur.pattern) === ticksPerStep(real) ? cur.pattern : null
  const shown = practicePat ?? real

  const { subscribe } = P
  const [playStep, setPlayStep] = useState(-1)
  useEffect(() => subscribe(s => { if (!Object.keys(s).length) setPlayStep(-1); else if (s.song !== undefined) setPlayStep(s.song) }), [subscribe])

  const sounds = (v: Voice) => !allow || allow.includes(v)
  const pct = Math.round((P.bpm / (song.raw.bpm || 1)) * 100)
  const range: [number, number] | null = P.barLoop ? [P.barLoop[0], P.barLoop[1] + 1] : P.loopSection !== null && song.sections[P.loopSection] ? [song.sections[P.loopSection].start, song.sections[P.loopSection].start + song.sections[P.loopSection].bars] : null

  const live = useRef({ playing: P.playing, range, pct, base: song.raw.bpm, every, trainer, loops })
  live.current = { playing: P.playing, range, pct, base: song.raw.bpm, every, trainer, loops }
  const setBpm = useRef(P.setBpm); setBpm.current = P.setBpm
  const onPulse = useRef<(e: PulseEvent) => void>(() => {})
  const onBar = useRef<(bar: number) => void>(() => {})
  const lastBar = useRef<number | null>(null)
  const loopKey = useRef('')
  const voiceOn = useRef(voice); voiceOn.current = voice
  const words = useRef<string[]>([])
  words.current = shown ? syllablesFor(shown).filter((_, i) => i % Math.max(1, shown.stepsPerBeat || 1) === 0) : []

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
    learn.pattern(practicePat)
    learn.metronome(click)
    learn.countIn(countIn)
  }, [learn, allow, practicePat, click, countIn])

  useEffect(() => { savePractice(song.raw.id, { countIn, click, voice, limb, muted, solo, stepOn, step: stepI, trainer, every, loops, pin }) }, [song.raw.id, countIn, click, voice, limb, muted, solo, stepOn, stepI, trainer, every, loops, pin])

  const setPct = (n: number) => { setLoops(0); live.current.loops = 0; live.current.pct = n; P.setBpm(song.raw.bpm * n / 100) }
  const lockSection = (i: number) => { setPin(null); setStep(0); P.setLoopSection(i); P.jumpSection(i) }
  const toggleMute = (v: Voice) => { setSolo(s => s.filter(x => x !== v)); setMuted(m => m.includes(v) ? m.filter(x => x !== v) : [...m, v]) }
  const toggleSolo = (v: Voice) => { setMuted(m => m.filter(x => x !== v)); setSolo(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]) }
  const chooseStep = (i: number) => {
    const s = lesson.steps[i]; if (!s) return
    setStep(i); setStepOn(true)
    if (voice) say(s.say ?? `${s.title}. ${s.focus}`)
  }
  const startTrainer = () => {
    const next = !trainer
    setTrainer(next); setLoops(0); live.current.loops = 0
    if (next && !P.barLoop && P.loopSection === null && sec) P.setLoopSection(selected)
  }

  const localBar = sec ? view - sec.start + 1 : 1
  const spb = Math.max(1, shown?.stepsPerBeat || lesson.grid.stepsPerBeat || 1)
  const playingBar = song.bars[P.songBar]
  const hotLimb = (voices: Voice[]) => P.playing && playStep >= 0 && !!playingBar && voices.some(v => velocityOf(playingBar.tracks[v]?.[playStep]) > 0 || !!playingBar.sub?.[v]?.[String(playStep)]?.length)

  if (!ready || !sec) return <p className="text-sm text-mute">Loading the part…</p>

  return <div className="space-y-4">
    <div className="flex gap-1.5 overflow-x-auto no-sheet-drag -mx-4 px-4 pb-0.5" aria-label="Sections">
      {song.sections.map((s, i) => <button key={i} aria-pressed={i === selected} onClick={() => lockSection(i)} className={`shrink-0 h-9 max-w-[148px] truncate px-3 rounded-full text-[13px] border active:scale-95 ${i === selected ? 'bg-amber text-ink border-amber' : 'border-white/[0.16] text-bone/80'}`}>{s.name}</button>)}
    </div>

    <div>
      <div className="flex gap-1 overflow-x-auto no-sheet-drag -mx-4 px-4" aria-label={`${sec.name} bars`}>
        {Array.from({ length: sec.bars }, (_, j) => {
          const n = sec.start + j
          const inR = !!P.barLoop && n >= P.barLoop[0] && n <= P.barLoop[1]
          return <button key={n} aria-label={`Learn bar ${n + 1}`} onClick={() => { setPin(null); P.pickBar(n) }} className={`shrink-0 w-9 h-9 rounded-md text-[13px] tabular-nums ${inR ? 'bg-amber text-ink font-medium' : P.loopPick === n ? 'ring-1 ring-amber text-amber bg-amber/10' : 'bg-white/[0.06] text-bone/75'} ${n === P.songBar && P.playing ? 'outline outline-1 outline-bone/70' : ''}`}>{j + 1}</button>
        })}
      </div>
      <p className="mt-1.5 text-[12px] text-bone/60 leading-snug min-h-[16px]">
        {P.barLoop ? <>Looping bars {P.barLoop[0] - sec.start + 1}–{P.barLoop[1] - sec.start + 1}. <button className="text-amber underline underline-offset-2" onClick={P.clearBarLoop}>Clear</button></> : P.loopPick !== null ? `Bar ${P.loopPick - sec.start + 1} selected. Tap the end bar.` : 'Tap a start bar, then an end bar, to loop part of the section.'}
      </p>
    </div>

    <p className="text-[14px] leading-snug text-bone/85">{lesson.overview}</p>

    <div>
      <div className="mx-auto w-[200px]"><KitView bars={song.bars.slice(sec.start, sec.start + sec.bars)} /></div>
      <p className="text-center text-[11px] text-mute -mt-1">The kit lights what you hear.</p>
    </div>

    <div>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium truncate">{sec.name} · bar {localBar}</div>
          <div className="text-[12px] text-mute">{lesson.timeSig} · {lesson.countPhrase}</div>
        </div>
        <button aria-label="Previous bar" disabled={!sec || view <= sec.start} onClick={() => setPin(Math.max(sec.start, view - 1))} className="w-9 h-9 rounded-full bg-white/[0.06] text-lg disabled:opacity-30">‹</button>
        <button aria-label="Next bar" disabled={!sec || view >= sec.start + sec.bars - 1} onClick={() => setPin(Math.min(sec.start + sec.bars - 1, view + 1))} className="w-9 h-9 rounded-full bg-white/[0.06] text-lg disabled:opacity-30">›</button>
        {pin !== null && <button onClick={() => setPin(null)} className="h-9 px-3 rounded-full text-[13px] text-amber">Follow</button>}
      </div>
      {countFlash !== null && <div className="h-11 grid place-items-center text-[34px] leading-none font-medium text-amber tabular-nums" aria-live="polite">{countFlash}</div>}
      {shown ? <Notation pattern={shown} step={P.playing && view === P.songBar ? playStep : -1} sounds={sounds} /> : <p className="mt-3 text-sm text-mute">This bar hasn’t loaded.</p>}
      <p className="mt-1.5 text-[11px] text-mute leading-snug">Amber is the note to play now. An outlined note is muted, so you play it. {spb === 4 ? 'Count 1 e & a under each beat.' : ''}</p>
    </div>

    <section>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] uppercase tracking-[0.12em] text-mute">Build it up</span>
        <button aria-pressed={stepOn} onClick={() => { const next = !stepOn; setStepOn(next); if (next && voice && cur) say(cur.say ?? `${cur.title}. ${cur.focus}`) }} className={pill(stepOn)}>Steps</button>
      </div>
      {stepOn && cur && <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
        <div className="text-[12px] text-mute tabular-nums">Step {stepI + 1} of {lesson.steps.length}</div>
        <div className="mt-0.5 text-[16px] font-medium">{cur.title}</div>
        <p className="mt-1 text-[13px] leading-snug text-bone/75">{cur.focus}</p>
        <div className="mt-3 flex gap-2">
          <button className="h-11 flex-1 rounded-xl bg-white/[0.06] text-[14px] disabled:opacity-30" disabled={stepI === 0} onClick={() => chooseStep(stepI - 1)}>Previous</button>
          <button className="h-11 flex-1 rounded-xl bg-white/[0.06] text-[14px] disabled:opacity-30" disabled={stepI >= lesson.steps.length - 1} onClick={() => chooseStep(stepI + 1)}>Next</button>
        </div>
      </div>}
    </section>

    <section>
      <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-mute">Practice tempo <span className="text-bone tabular-nums normal-case tracking-normal">{Math.min(999, Math.max(0, pct))}% · {shownBpm(song, P.bpm)} BPM</span></div>
      <input type="range" min={50} max={100} step={5} value={Math.min(100, Math.max(50, Math.round(pct / 5) * 5))} onChange={e => setPct(+e.target.value)} className="slider no-sheet-drag touch-pan-x w-full" style={{ height: 36 }} aria-label="Practice tempo" />
      <div className="mt-1 flex gap-1">{[50, 60, 75, 85, 100].map(n => <button key={n} onClick={() => setPct(n)} className={`h-9 flex-1 rounded-full text-[13px] border active:scale-95 ${pct === n ? 'bg-bone text-ink border-bone' : 'border-white/10 text-bone/70'}`}>{n}%</button>)}</div>
      <p className="mt-1.5 text-[11px] text-mute leading-snug">Half speed up to the recording. Scales the song’s tempo map, same as Sound.</p>
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
      {lesson.limbs.map(l => <article key={l.id} className={`rounded-2xl border p-3 transition-colors duration-75 ${hotLimb(l.voices) && P.playing ? 'border-amber/50 bg-amber/[0.07]' : 'border-white/[0.06] bg-white/[0.03]'}`}>
        <div className={`text-[15px] font-medium ${hotLimb(l.voices) && P.playing ? 'text-amber' : ''}`}>{l.label}</div>
        <p className="mt-1 text-[13px] leading-snug text-bone/75">{l.summary}</p>
        <div className="mt-2 flex flex-col gap-1.5">{l.voices.map(v => <div key={v} className="flex items-center gap-2 h-9">
          <span className={`flex-1 min-w-0 truncate text-[14px] ${sounds(v) ? '' : 'line-through text-mute'}`}>{VOICE_NAME[v]}</span>
          <button aria-label={`Mute ${VOICE_NAME[v]}`} aria-pressed={muted.includes(v)} onClick={() => toggleMute(v)} className={sq(muted.includes(v), 'mute')}>M</button>
          <button aria-label={`Solo ${VOICE_NAME[v]}`} aria-pressed={solo.includes(v)} onClick={() => toggleSolo(v)} className={sq(solo.includes(v), 'solo')}>S</button>
        </div>)}</div>
      </article>)}
    </section>

    <details className="group border-t border-white/[0.06]">
      <summary className="h-11 flex items-center justify-between text-[14px] cursor-pointer list-none [&::-webkit-details-marker]:hidden">Common mistakes <span className="text-mute text-lg leading-none group-open:rotate-90 transition-transform">›</span></summary>
      <ul className="space-y-3 pb-2">{lesson.mistakes.map(m => <li key={m.title}><div className="text-[14px]">{m.title}</div><p className="text-[13px] leading-snug text-bone/70">{m.fix}</p></li>)}</ul>
    </details>
    <details className="group border-t border-white/[0.06]">
      <summary className="h-11 flex items-center justify-between text-[14px] cursor-pointer list-none [&::-webkit-details-marker]:hidden">How to practice <span className="text-mute text-lg leading-none group-open:rotate-90 transition-transform">›</span></summary>
      <ul className="space-y-2 pb-2 list-disc pl-4">{lesson.tips.map(t => <li key={t} className="text-[13px] leading-snug text-bone/75">{t}</li>)}</ul>
    </details>
    {lesson.source === 'derived' && <p className="text-[11px] text-mute leading-snug">Practice plan from this section’s notes. A written lesson replaces it.</p>}
  </div>
}
