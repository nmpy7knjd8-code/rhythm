import { useEffect, useState } from 'react'
import { POLYRHYTHMS, POLY_SOURCES, polyBar, polyCount, engineBpm, type Poly } from '../data/polyrhythms'
import { usePlayer, useHeardPos } from './player'
import { kit } from '../midi/kit'
import { SyncDetails } from './sync'
import type { Voice } from '../engine/types'

type Count = 'off' | 'cross' | 'pulse'
type Yours = 'none' | 'cross' | 'pulse'
const VOICE: Record<'cross' | 'pulse', Voice> = { cross: 'bell', pulse: 'low' }
const LAYER_NAME = { cross: 'Cowbell', pulse: 'Kick' }

export function Polyrhythms() {
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const list = all ? POLYRHYTHMS : POLYRHYTHMS.filter(p => p.featured)
  return <>
    <header className="mb-8 rise"><h1 className="text-[42px] leading-[1.1] font-semibold tracking-[-0.025em]">Polyrhythms</h1>
      <p className="mt-3 text-[15px] max-w-[42ch] leading-relaxed text-bone">Two even rhythms in the same span of time. The cowbell plays the cross rhythm, the kick plays the beat. Every ratio from 2 to 9 in lowest terms, plus two named forms.</p></header>
    <div role="group" aria-label="Show" className="inline-flex p-0.5 rounded-full bg-white/[0.05]">
      {([[false, 'Featured'], [true, `All ${POLYRHYTHMS.length}`]] as const).map(([v, l]) =>
        <button key={l} aria-pressed={all === v} onClick={() => setAll(v)} className={`h-9 px-3.5 rounded-full text-[13px] ${all === v ? 'bg-bone text-ink' : 'text-bone/60'}`}>{l}</button>)}
    </div>
    <ul className="mt-5 space-y-2">{list.map(p => <PolyItem key={p.id} p={p} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} />)}</ul>
    <section className="mt-12 text-[13px] text-mute leading-relaxed"><h2 className="text-[15px] text-bone mb-2">Sources</h2>
      <ul className="space-y-1">{Object.values(POLY_SOURCES).map(s => <li key={s.url}><a className="underline decoration-white/20" href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>)}</ul>
      <p className="mt-3">Feels marked "general" describe the shape of the ratio and come from no specific source. Examples are listed only where a source names them.</p></section>
  </>
}

function PolyItem({ p, open, onToggle }: { p: Poly; open: boolean; onToggle: () => void }) {
  return <li className="card">
    <button aria-expanded={open} onClick={onToggle} className="w-full flex items-center gap-3 text-left min-h-11">
      <span className="flex-1 min-w-0"><span className="block text-[15px] font-medium">{p.name}</span>
        <span className="block text-[13px] text-mute">{p.feel}{p.generic ? ' · general' : ''}{p.featured && !p.named ? ' · featured' : ''}{p.named ? ' · named form' : ''}</span></span>
      <Dots p={p} small />
    </button>
    {open && <PolyDetail p={p} />}
  </li>
}

/** Both layers on one time line; the heard step lights the last note of each layer. */
function Dots({ p, step = -1, small, yours }: { p: Poly; step?: number; small?: boolean; yours?: Yours }) {
  const rows = (['cross', 'pulse'] as const)
  return <div className={small ? 'w-24 shrink-0 space-y-1.5' : 'relative space-y-4 py-1'} aria-hidden={small ? true : undefined}>
    {!small && step >= 0 && <span className="absolute top-0 bottom-0 w-px bg-amber/50" style={{ left: `${(step / p.steps) * 100}%` }} />}
    {rows.map(r => {
      const hits = [...p[r]].map((c, i) => (c === '.' ? -1 : i)).filter(i => i >= 0)
      const last = step < 0 ? -1 : hits.filter(i => i <= step).pop() ?? -1
      return <div key={r} className="flex items-center gap-2">
        {!small && <span className="w-16 shrink-0 text-[13px] text-mute">{LAYER_NAME[r]}{yours === r ? ' (you)' : ''}</span>}
        <div data-row={r} className={`relative flex-1 ${small ? 'h-2' : 'h-5'}`}>
          <span className="absolute inset-x-0 top-1/2 h-px bg-white/[0.08]" />
          {hits.map(i => <span key={i} data-on={i === last ? '' : undefined}
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full transition-transform duration-75 ${small ? 'w-1.5 h-1.5' : 'w-3.5 h-3.5'} ${i === last ? 'bg-amber scale-125' : r === 'cross' ? 'bg-bone/80' : 'bg-bone/40'}`}
            style={{ left: `${(i / p.steps) * 100 + (small ? 0 : 0)}%` }} />)}
        </div>
      </div>
    })}
  </div>
}

function PolyDetail({ p }: { p: Poly }) {
  const P = usePlayer()
  const mine = P.poly?.name === p.name
  const live = mine && P.playing
  const [bpm, setBpm] = useState(p.start)
  const [count, setCount] = useState<Count>('off')
  const [yours, setYours] = useState<Yours>('none')
  const heard = useHeardPos(false, live)
  const [ks, setKs] = useState(kit.get().status)
  useEffect(() => kit.watch(() => setKs(kit.get().status)), [])
  const [flash, setFlash] = useState(0)
  useEffect(() => yours === 'none' ? undefined : kit.onHit(() => setFlash(f => f + 1)), [yours])

  // count and your layer follow the controls while this one plays
  useEffect(() => { if (mine) P.learn.count(count === 'off' ? null : new Map([[0, polyCount(p, count)]])) }, [mine, count, p, P.learn])
  useEffect(() => { if (mine) P.learn.voices(yours === 'none' ? null : [VOICE[yours === 'cross' ? 'pulse' : 'cross']]) }, [mine, yours, P.learn])
  const play = async () => {
    if (live) { await P.toggle(); return }
    if (mine) { await P.toggle(); return }
    await P.playPoly(p.name, [polyBar(p, bpm)])
  }
  const tempo = (v: number) => { setBpm(v); if (mine) P.setBpm(engineBpm(p, v)) }

  return <div className="mt-3 space-y-4">
    <p className="text-[15px] leading-relaxed text-bone">{p.about}</p>
    {p.aka && <p className="text-[13px] text-mute">Also called {p.aka}.</p>}
    {p.interval && <p className="text-[13px] text-mute">Sped up into pitch, {p.a > p.b ? `${p.a}:${p.b}` : `${p.b}:${p.a}`} is a {p.interval}.</p>}
    <div className={`rounded-xl bg-white/[0.03] px-3 py-3 ${flash % 2 ? 'ring-1 ring-amber/40' : ''}`}><Dots p={p} step={live && heard ? heard.step : -1} yours={yours} /></div>
    <div className="flex items-center gap-3">
      <button className="btn-primary" onClick={() => void play()} aria-label={live ? `Stop ${p.name}` : `Play ${p.name}`}>{live ? 'Stop' : 'Play'}</button>
      <label className="flex-1 flex items-center gap-2 text-[13px] text-mute"><span className="tabular-nums w-16">{bpm} BPM</span>
        <input type="range" min={40} max={160} value={bpm} onChange={e => tempo(+e.target.value)} className="slider no-sheet-drag touch-pan-x" aria-label="Beat tempo" /></label>
    </div>
    <Choice label="Count" value={count} onChange={setCount} options={[['off', 'Off'], ['cross', 'Cowbell'], ['pulse', 'Kick']]} />
    <Choice label="You play" value={yours} onChange={setYours} options={[['none', 'Neither'], ['cross', 'Cowbell'], ['pulse', 'Kick']]} />
    {yours !== 'none' && <p className="text-[13px] text-mute">The {LAYER_NAME[yours].toLowerCase()} goes silent so you can play it.{' '}
      {ks === 'connected' ? 'Your kit is connected: the line lights when you hit a pad.' : <button className="text-amber" onClick={() => void kit.connect()}>Connect a MIDI kit</button>}</p>}
    <SyncDetails before={async () => { if (live) await P.toggle() }} />
    {p.uses.length > 0 && <div><h3 className="text-[13px] text-mute mb-1">Heard in</h3>
      <ul className="space-y-1.5 text-[15px] leading-relaxed text-bone list-disc pl-5 marker:text-bone/30">{p.uses.map(u => <li key={u.text}>{u.text} <a className="text-[13px] text-mute" href={POLY_SOURCES[u.source].url} target="_blank" rel="noreferrer">source</a></li>)}</ul></div>}
  </div>
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return <div className="flex items-center gap-3"><span className="w-16 text-[13px] text-mute">{label}</span>
    <div role="group" aria-label={label} className="inline-flex p-0.5 rounded-full bg-white/[0.05]">
      {options.map(([v, l]) => <button key={v} aria-pressed={value === v} onClick={() => onChange(v)} className={`h-9 px-3 rounded-full text-[13px] ${value === v ? 'bg-bone text-ink' : 'text-bone/60'}`}>{l}</button>)}
    </div></div>
}
