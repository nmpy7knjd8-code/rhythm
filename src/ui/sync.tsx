import { useState, useSyncExternalStore } from 'react'
import * as Tone from 'tone'
import { kit, ROUTES, type Route } from '../midi/kit'
import { heardAt } from '../midi/clock'
import { calibrate } from '../midi/calibrate'
const useKit = () => useSyncExternalStore(kit.watch, kit.get)

const N = 20, GAP = 0.8 // seconds apart: room for a Bluetooth delay of up to ~400 ms before a tap looks like the next click

/** How Pulse's sound reaches you, and how late it arrives: chosen route, a tap-along (or pad) calibration and a ±10 ms nudge.
 *  One delay per route, used by the highlight in Now playing and Learn it and by kit scoring. */
export function SoundSync({ before }: { before: () => Promise<void> }) {
  const k = useKit()
  const [taps, setTaps] = useState<number[] | null>(null)
  const [msg, setMsg] = useState('')
  const delay = kit.offset()
  const run = async () => {
    await before(); await Tone.start()
    const ctx = Tone.getContext().rawContext as AudioContext
    const synth = new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 2, envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 } }).toDestination()
    const t0 = ctx.currentTime + 0.8, clicks: number[] = [], hits: number[] = []
    for (let i = 0; i < N; i++) { synth.triggerAttackRelease(i % 4 ? 900 : 1400, 0.02, t0 + i * GAP, i % 4 ? 0.5 : 0.8); clicks.push(heardAt(ctx, t0 + i * GAP)) }
    kit.calClicks = clicks
    const add = (at: number) => { hits.push(at); setTaps([...hits]) }
    tap = add
    setMsg(''); setTaps([])
    const off = kit.onHit(h => add(h.at))
    setTimeout(() => {
      off(); tap = null; synth.dispose(); setTaps(null)
      const c = calibrate(clicks, hits)
      if (c) { kit.setOffset(c.offset); setMsg(c.spread > 30 ? 'Saved, but the taps were spread out. Run it again for a steadier number.' : 'Saved.') }
      else setMsg('Too few taps landed near the clicks. Try again.')
    }, (t0 - ctx.currentTime + N * GAP + 0.4) * 1000)
  }
  return <div className="space-y-2">
    <label className="flex flex-col gap-1 text-[13px] text-mute">Pulse sound
      <select value={k.route} onChange={e => kit.setRoute(e.target.value as Route)} className="h-11 rounded-xl bg-white/[0.06] px-2 text-[15px] text-bone">
        {ROUTES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
      </select>
    </label>
    {taps ? <button onPointerDown={e => tap?.(e.timeStamp)} className="w-full h-24 rounded-2xl bg-amber/15 text-amber text-[15px] font-medium touch-manipulation select-none" aria-live="polite">
      Tap here with each click{k.status === 'connected' ? ' (or hit a pad)' : ''}: {taps.length} of {N}
    </button> : <div className="flex items-center gap-1.5">
      <button onClick={run} className="h-11 px-4 rounded-full bg-white/[0.06] text-[15px]">Tap along</button>
      <span className="flex-1" />
      <button aria-label="Highlight earlier" onClick={() => kit.setOffset(delay - 10)} className="w-11 h-11 rounded-full bg-white/[0.06] text-xl leading-none">−</button>
      <span className="w-[72px] text-center text-[15px] tabular-nums" aria-live="polite" data-sound-delay>{delay} ms</span>
      <button aria-label="Highlight later" onClick={() => kit.setOffset(delay + 10)} className="w-11 h-11 rounded-full bg-white/[0.06] text-xl leading-none">+</button>
    </div>}
    <p className="text-[13px] text-bone leading-snug">{msg || (kit.calibrated() ? 'The highlight waits this long for the sound to reach you.' : k.route === 'bluetooth' ? 'Bluetooth adds a delay the browser can’t see. Tap along once to measure it.' : 'If the highlight runs ahead of or behind the sound, tap along once.')}</p>
  </div>
}
let tap: ((at: number) => void) | null = null

/** The same, folded away under one line: for Now playing and Learn it. */
export function SyncDetails({ before }: { before: () => Promise<void> }) {
  const k = useKit()
  return <details className="group" data-sound-sync>
    <summary className="h-11 flex items-center justify-between gap-2 text-[15px] cursor-pointer list-none [&::-webkit-details-marker]:hidden">
      Sync with the sound <span className="flex items-center gap-2 text-[13px] text-mute tabular-nums">{ROUTES.find(r => r.id === k.route)!.short} · {kit.offset()} ms <span className="text-lg leading-none group-open:rotate-90 transition-transform">›</span></span>
    </summary>
    <div className="pb-2"><SoundSync before={before} /></div>
  </details>
}
