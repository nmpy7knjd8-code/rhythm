import { useEffect, useMemo, useRef } from 'react'
import { hitBus } from '../engine/audio'
import type { Pattern, Voice } from '../engine/types'

/** A piece of the kit, drawn front-on. `voices` are the engine voices that light it. */
interface Piece { id: string; label: string; voices: Voice[]; variants?: string[]; optional?: boolean; draw: 'cym' | 'drum' | 'kick' | 'hat' | 'bell'; x: number; y: number; r: number }
const PIECES: Piece[] = [
  { id: 'crashL', label: 'Crash', voices: ['crash1'], draw: 'cym', x: 70, y: 52, r: 44 },
  { id: 'splash', label: 'Splash', voices: [], variants: ['splash'], optional: true, draw: 'cym', x: 150, y: 30, r: 22 },
  { id: 'crashR', label: 'Crash 2', voices: ['crash2'], optional: true, draw: 'cym', x: 262, y: 40, r: 42 },
  { id: 'china', label: 'China', voices: ['china'], optional: true, draw: 'cym', x: 330, y: 90, r: 30 },
  { id: 'ride', label: 'Ride', voices: ['ride', 'rideBell'], draw: 'cym', x: 300, y: 128, r: 50 },
  { id: 'hat', label: 'Hi-hat', voices: ['tick', 'open', 'pedal'], draw: 'hat', x: 40, y: 140, r: 32 },
  { id: 'tomHi', label: 'Tom 1', voices: ['tomHi'], draw: 'drum', x: 150, y: 110, r: 25 },
  { id: 'tomMid', label: 'Tom 2', voices: ['tomMid'], draw: 'drum', x: 210, y: 110, r: 28 },
  { id: 'bell', label: 'Bell', voices: ['bell'], optional: true, draw: 'bell', x: 180, y: 66, r: 12 },
  { id: 'snare', label: 'Snare', voices: ['back', 'accent'], draw: 'drum', x: 98, y: 186, r: 32 },
  { id: 'floor', label: 'Floor', voices: ['tomLo'], draw: 'drum', x: 276, y: 206, r: 38 },
  { id: 'kick', label: 'Kick', voices: ['low'], draw: 'kick', x: 184, y: 206, r: 58 },
]

function Shape({ p }: { p: Piece }) {
  const { x, y, r } = p
  if (p.draw === 'cym') return <ellipse cx={x} cy={y} rx={r} ry={r * 0.2} />
  if (p.draw === 'hat') return <g><ellipse cx={x} cy={y - 4} rx={r} ry={r * 0.2} /><ellipse cx={x} cy={y + 4} rx={r} ry={r * 0.2} /></g>
  if (p.draw === 'bell') return <path d={`M${x - r} ${y + r * .6} L${x - r * .5} ${y - r * .6} L${x + r * .5} ${y - r * .6} L${x + r} ${y + r * .6} Z`} />
  if (p.draw === 'kick') return <circle cx={x} cy={y} r={r} />
  return <g><rect x={x - r} y={y - r * 0.55} width={r * 2} height={r * 1.1} rx={4} /><ellipse cx={x} cy={y - r * 0.55} rx={r} ry={r * 0.18} /></g>
}

/** Minimal front-view kit; each piece flashes amber, scaled by velocity, exactly when it sounds (Tone.Draw). */
export function KitView({ bars }: { bars: Pattern[] }) {
  const refs = useRef<Record<string, SVGGElement | null>>({})
  const used = useMemo(() => {
    const v = new Set<string>()
    for (const b of bars) { for (const [k, t] of Object.entries(b.tracks)) if (t && /[^.]/.test(t)) v.add(k); for (const k of Object.keys(b.sub ?? {})) v.add(k); for (const m of Object.values(b.variant ?? {})) for (const x of Object.values(m ?? {})) v.add('var:' + x) }
    return v
  }, [bars])
  const shown = useMemo(() => PIECES.filter(p => !p.optional || p.voices.some(v => used.has(v)) || p.variants?.some(x => used.has('var:' + x))), [used])
  useEffect(() => {
    const byVoice = new Map<string, Piece>(); for (const p of shown) p.voices.forEach(v => byVoice.set(v, p))
    const f = (voice: Voice, vel: number, variant?: string) => {
      const p = (variant === 'splash' && shown.find(x => x.id === 'splash')) || byVoice.get(voice); if (!p) return
      const el = refs.current[p.id]; if (!el) return
      const a = 0.25 + 0.75 * Math.min(1, vel)
      el.animate([{ opacity: a, transform: `scale(${1 + 0.06 * a})` }, { opacity: 0, transform: 'scale(1)' }], { duration: p.draw === 'cym' ? 520 : 260, easing: 'cubic-bezier(.2,.7,.3,1)' })
    }
    hitBus.add(f); return () => { hitBus.delete(f) }
  }, [shown])
  return <figure className="select-none">
    <svg viewBox="0 0 370 270" className="w-full h-auto" role="img" aria-label="Drum kit, lighting up as each piece is hit">
      {shown.map(p => <g key={p.id}>
        <g fill="rgba(255,255,255,0.035)" stroke="rgba(255,255,255,0.22)" strokeWidth={1.2}><Shape p={p} /></g>
        <g ref={el => { refs.current[p.id] = el }} fill="#ffb000" stroke="#ffb000" strokeWidth={1.2} opacity={0} style={{ transformBox: 'fill-box', transformOrigin: 'center', filter: 'drop-shadow(0 0 6px rgba(255,176,0,.55))' }}><Shape p={p} /></g>
        <text x={p.x} y={p.draw === 'kick' ? p.y + 4 : p.y + (p.draw === 'cym' || p.draw === 'hat' ? 20 : p.r * 0.55 + 14)} textAnchor="middle" className="fill-[#8a8a90]" fontSize={13} letterSpacing={0}>{p.label}</text>
      </g>)}
    </svg>
  </figure>
}
