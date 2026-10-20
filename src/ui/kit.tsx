import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import * as Tone from 'tone'
import type { Pattern, Voice } from '../engine/types'
import { hitsAt, subHitsAt, ticksPerStep } from '../engine/pattern'
import { kit } from '../midi/kit'
import { Scorer, type HitResult, type Tally } from '../midi/score'
import { clearMarks, marks, putMark, store, type Mark } from '../midi/marks'
import { heardAt } from '../midi/clock'
import { SoundSync } from './sync'
import { DRUM_NAME, PADS, UNSCORED, drumOf, groupAt } from '../midi/map'

export const useKit = () => useSyncExternalStore(kit.watch, kit.get)

/** Verdicts for one bar's notes, keyed `step:voice`. */
export const useMarks = (bar: number) => useSyncExternalStore(marks.watch, marks.get).get(bar)

export const readout = store<{ last: HitResult | null; lap: Tally | null; wait: { text: string; bad: boolean } | null }>({ last: null, lap: null, wait: null })
export const scorer = new Scorer()

export const MARK: Record<Mark, { label: string; arrow: string; color: string }> = {
  early: { label: 'Early', arrow: '←', color: 'text-sky-400' },
  on: { label: 'On time', arrow: '', color: 'text-emerald-400' },
  late: { label: 'Late', arrow: '→', color: 'text-rose-400' },
  miss: { label: 'Missed', arrow: '', color: 'text-mute' },
}

export interface ScoreSource {
  active: boolean
  /** the voices the drummer is meant to play now; the rest are never expected */
  voices: Set<Voice>
  clock: () => { timeline: { t: number; bar: number; step: number; listen?: boolean }[]; ctx: AudioContext }
  /** what the drummer should play in this song bar (the step being practised, else the full bar) */
  pattern: (bar: number) => Pattern | undefined
}

/** While active: turn each heard step into notes to play, match kit hits to them, and call missed notes. */
export function useKitScore(src: ScoreSource) {
  const live = useRef(src); live.current = src
  useEffect(() => {
    if (!src.active) return
    scorer.reset(); clearMarks(); readout.set({ ...readout.get(), last: null })
    let lastT = -Infinity
    const poll = () => {
      const { timeline, ctx } = live.current.clock()
      for (const e of timeline) {
        if (e.t <= lastT) continue
        lastT = e.t
        if (e.step === 0) clearMarks(e.bar)
        const p = e.listen ? undefined : live.current.pattern(e.bar); if (!p) continue
        const stepSec = 5 / Tone.getTransport().bpm.getValueAtTime(e.t) * ticksPerStep(p)
        const add = (voice: Parameters<Scorer['hit']>[0], frac: number) => {
          if (UNSCORED.has(voice) || !live.current.voices.has(voice)) return
          const t = e.t + frac * stepSec
          scorer.add({ id: `${t}:${voice}`, voice, t, at: heardAt(ctx, t), bar: e.bar, step: e.step, frac })
        }
        for (const h of hitsAt(p, e.step)) add(h.voice, 0)
        for (const h of subHitsAt(p, e.step)) add(h.voice, h.frac)
      }
      for (const r of scorer.sweep(performance.now() - kit.offset())) putMark(r.note, 'miss')
    }
    poll()
    const id = setInterval(poll, 20)
    const off = kit.onHit(h => {
      poll()
      const r = scorer.hit(h.voice, h.at - kit.offset(), new Set([...live.current.voices].map(drumOf)))
      if (r.kind === 'hit') putMark(r.note, r.verdict)
      if (r.kind !== 'extra') readout.set({ ...readout.get(), last: r })
    })
    return () => { clearInterval(id); off() }
  }, [src.active])
}

type Pos = { bar: number; step: number }

/** Wait mode: no playback; the cursor sits on the next note until every drum of it is hit, then moves on (wrapping in `range`). */
export function useWaitMode(on: boolean, pattern: (bar: number) => Pattern | undefined, voices: Set<Voice>, range: [number, number], start: number, filter = ''): Pos | null {
  const [cur, setCur] = useState<(Pos & { left: Voice[] }) | null>(null)
  const live = useRef({ pattern, voices, range, cur }); live.current = { pattern, voices, range, cur }
  const find = (from: Pos, skip: boolean) => {
    const { pattern, voices, range: [a, b] } = live.current
    let bar = Math.min(Math.max(from.bar, a), b - 1), step = from.step + (skip ? 1 : 0)
    for (let n = 0; n < (b - a + 1) * 64; n++) {
      const p = pattern(bar)
      if (p && step < p.steps) { const left = groupAt(p, step, voices); if (left.length) return { bar, step, left }; step++; continue }
      bar = bar + 1 >= b ? a : bar + 1; step = 0
    }
    return null
  }
  const show = (c: { left: Voice[] } | null) => readout.set({ ...readout.get(), wait: c ? { text: `Hit ${c.left.map(v => DRUM_NAME[drumOf(v)]).join(' + ')}`, bad: false } : null })
  useEffect(() => {
    if (!on) { setCur(null); readout.set({ ...readout.get(), wait: null }); return }
    const first = find({ bar: start, step: 0 }, false); setCur(first); show(first)
    const off = kit.onHit(h => {
      const c = live.current.cur; if (!c) return
      const i = c.left.findIndex(v => drumOf(v) === drumOf(h.voice))
      if (i < 0 && ![...live.current.voices].some(v => drumOf(v) === drumOf(h.voice))) return // a pad you're not drilling: ignored
      if (i < 0) { readout.set({ ...readout.get(), wait: { text: `Wrong drum: ${DRUM_NAME[drumOf(h.voice)]}, not ${c.left.map(v => DRUM_NAME[drumOf(v)]).join(' + ')}`, bad: true } }); return }
      const left = c.left.filter((_, j) => j !== i)
      const next = left.length ? { ...c, left } : find(c, true)
      live.current.cur = next; setCur(next); show(next)
    })
    return () => { off(); readout.set({ ...readout.get(), wait: null }) }
  }, [on, range[0], range[1]]) // eslint-disable-line react-hooks/exhaustive-deps -- (re)starts where you are when turned on or the bars change
  // the drill filter changed (Hands/Feet, mute, solo, step): ask again for what the current note now needs, from where you are
  const seen = useRef(filter)
  useEffect(() => {
    if (seen.current === filter) return
    seen.current = filter
    const c = live.current.cur; if (!on || !c) return
    const next = find(c, false); live.current.cur = next; setCur(next); show(next)
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps -- only the filter
  return cur && { bar: cur.bar, step: cur.step }
}

/** One fixed-height line under the bar title: the last hit (Early / On time / Late, or the wrong drum) and the last loop's score. */
export function KitReadout({ best }: { best?: { score: number; pct: number } }) {
  const { last, lap, wait } = useSyncExternalStore(readout.watch, readout.get)
  const m = last?.kind === 'hit' ? MARK[last.verdict] : null
  return <div className="mt-1 h-7 flex items-center justify-between gap-2 text-[15px] tabular-nums" aria-live="polite" data-kit-readout>
    <span className={`min-w-0 truncate font-medium ${wait ? (wait.bad ? 'text-rose-400' : 'text-bone') : m ? m.color : last ? 'text-rose-400' : 'text-mute'}`}>
      {wait ? wait.text : (m && last?.kind === 'hit' ? `${last.verdict === 'early' ? '← ' : ''}${m.label}${last.verdict === 'late' ? ' →' : ''}${last.verdict === 'on' ? '' : ` ${Math.round(Math.abs(last.err))} ms`}`
        : last?.kind === 'wrong' ? `Wrong drum: ${DRUM_NAME[drumOf(last.voice)]}, not ${DRUM_NAME[drumOf(last.want)]}` : 'Play along on your kit')}
    </span>
    <span className="shrink-0 text-[13px] text-mute">{lap && <>Last loop <span className="text-bone">{Math.round(lap.score * 100)}%</span></>}{best && <>{lap ? ' · ' : ''}Best {Math.round(best.score * 100)}% at {best.pct}%</>}</span>
  </div>
}

function Pads() {
  const k = useKit()
  const [i, setI] = useState<number | null>(null)
  const prev = useRef(k.pads)
  useEffect(() => { if (i !== null && k.pads !== prev.current) setI(n => (n === null || n + 1 >= PADS.length ? null : n + 1)) ; prev.current = k.pads }, [k.pads, i])
  useEffect(() => { kit.askPad(i === null ? null : PADS[i].voice) }, [i])
  useEffect(() => () => kit.askPad(null), [])
  const custom = Object.keys(k.pads).length > 0
  if (i !== null) return <div className="flex items-center gap-2">
    <span className="flex-1 text-[15px]" aria-live="polite">Hit <span className="text-amber">{PADS[i].name}</span> <span className="text-mute">({i + 1} of {PADS.length})</span></span>
    <button onClick={() => setI(i + 1 >= PADS.length ? null : i + 1)} className="h-11 px-3 rounded-full bg-white/[0.06] text-[13px]">Skip</button>
    <button onClick={() => setI(null)} className="h-11 px-3 rounded-full bg-white/[0.06] text-[13px]">Done</button>
  </div>
  return <div className="flex items-center gap-2">
    <span className="flex-1 text-[13px] text-mute leading-snug">{custom ? 'Your own pad setup.' : 'Pads use the Nitro Pro’s default notes (General MIDI on other kits).'}</span>
    {custom && <button onClick={kit.resetPads} className="h-11 px-3 rounded-full text-[13px] text-mute">Reset</button>}
    <button onClick={() => setI(0)} disabled={k.status !== 'connected'} className="h-11 px-3 rounded-full bg-white/[0.06] text-[13px] disabled:opacity-40">Set up pads</button>
  </div>
}

const STATUS: Record<string, string> = {
  off: 'Connect your electronic kit with a USB cable, then tap Connect.',
  asking: 'Allow MIDI in Chrome’s prompt.',
  denied: 'MIDI is blocked for this site. Allow it in Chrome’s site settings, then tap Connect.',
  none: 'No kit found. Plug the kit’s USB into this device and switch it on.',
}

/** Kit settings: connection, how Pulse's sound reaches you, calibration, pads. */
export function KitSettings({ before }: { before: () => Promise<void> }) {
  const k = useKit()
  return <div className="card p-3 space-y-3" aria-label="Kit settings" role="group">
    <div className="flex items-center gap-2">
      <p className="flex-1 min-w-0 text-[15px] leading-snug">{k.status === 'connected' ? <><span className="text-emerald-400">●</span> {k.device}</> : STATUS[k.status]}</p>
      {k.status !== 'connected' && <button onClick={() => void kit.connect()} className="h-11 px-4 rounded-full bg-amber text-ink text-[15px] font-medium">Connect</button>}
    </div>
    <p className="text-[13px] text-bone leading-snug">Best: a cable from this device into the kit’s Aux In, headphones in the kit, kit Local on.</p>
    <SoundSync before={before} />
    <Pads />
    <p className="text-[13px] text-mute leading-snug">Hit Tom 1, Tom 2 and the kick together to start.</p>
  </div>
}
if (typeof window !== 'undefined') (window as unknown as { __pulseScorer: Scorer }).__pulseScorer = scorer
