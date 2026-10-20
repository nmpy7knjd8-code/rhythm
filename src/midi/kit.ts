import type { Voice } from '../engine/types'
import { DEFAULT_MAP, drumOf, noteOn } from './map'

/** How Pulse's audio reaches the drummer's ears. Each route keeps its own calibrated delay (ms the sound arrives after
 *  what the browser reports), used by the highlight in Now playing and Learn it and by kit scoring. */
export type Route = 'aux' | 'device' | 'bluetooth'
export const ROUTES: { id: Route; label: string; short: string }[] = [
  { id: 'aux', label: 'Cable into the kit’s Aux In', short: 'Cable' },
  { id: 'device', label: 'This device’s speaker or headphones', short: 'This device' },
  { id: 'bluetooth', label: 'Bluetooth (to the kit or headphones)', short: 'Bluetooth' },
]
/** Starting guesses before calibration: a cable or the device's own output adds nothing the browser misses; Bluetooth
 *  (A2DP) typically adds 150–300 ms. */
export const ROUTE_DELAY: Record<Route, number> = { aux: 0, device: 0, bluetooth: 200 }
export type Status = 'off' | 'asking' | 'denied' | 'none' | 'connected'
export interface KitState {
  supported: boolean; status: Status; device: string; open: boolean
  route: Route; delays: Partial<Record<Route, number>>; pads: Record<number, Voice>; asking: Voice | null
}
export interface Hit { voice: Voice; note: number; velocity: number; at: number }
interface Best { score: number; pct: number; at: number }
interface Stored { route?: Route; delays?: KitState['delays']; pads?: Record<number, Voice>; best?: Record<string, Record<string, Best>> }

const KEY = 'pulse.kit.v1'
const read = (): Stored => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Stored } catch { return {} } }
const write = (s: Stored) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode */ } }

type MidiInput = { name?: string | null; onmidimessage: ((e: { data: Uint8Array | null; timeStamp: number }) => void) | null }
type MidiAccess = { inputs: Map<string, MidiInput>; onstatechange: (() => void) | null }
const nav = () => (typeof navigator === 'undefined' ? undefined : navigator) as (Navigator & { requestMIDIAccess?: (o?: object) => Promise<MidiAccess> }) | undefined

const saved = typeof localStorage === 'undefined' ? {} : read()
let state: KitState = {
  supported: !!nav()?.requestMIDIAccess, status: 'off', device: '', open: false,
  // older `offsets` were measured on a clock without the reported output latency: not carried over
  route: saved.route ?? 'aux', delays: saved.delays ?? {}, pads: saved.pads ?? {}, asking: null,
}
const watchers = new Set<() => void>()
const hitters = new Set<(h: Hit) => void>()
const remotes = new Set<() => void>()
let access: MidiAccess | null = null
let recent: { drum: string; at: number }[] = []

function set(p: Partial<KitState>) {
  state = { ...state, ...p }
  if ('route' in p || 'delays' in p || 'pads' in p) { const { offsets: _old, ...rest } = read() as Stored & { offsets?: unknown }; void _old; write({ ...rest, route: state.route, delays: state.delays, pads: state.pads }) }
  watchers.forEach(f => f())
}

function onMessage(e: { data: Uint8Array | null; timeStamp: number }) {
  const on = e.data && noteOn(e.data); if (!on) return
  const [note, velocity] = on
  if (state.asking) { const pads = { ...state.pads, [note]: state.asking }; set({ pads, asking: null }); return }
  const voice = state.pads[note] ?? DEFAULT_MAP[note]; if (!voice) return
  const h: Hit = { voice, note, velocity, at: e.timeStamp }
  hitters.forEach(f => f(h))
  // kit as a remote: Tom 1, Tom 2 and the kick together (within 80 ms)
  recent = [...recent.filter(r => h.at - r.at < 80), { drum: drumOf(voice), at: h.at }]
  if (['tom1', 'tom2', 'kick'].every(d => recent.some(r => r.drum === d))) { recent = []; remotes.forEach(f => f()) }
}

function attach() {
  if (!access) return
  const inputs = [...access.inputs.values()]
  for (const i of inputs) i.onmidimessage = onMessage
  set({ status: inputs.length ? 'connected' : 'none', device: inputs.map(i => i.name || 'MIDI device').join(', ') })
}

export const kit = {
  get: () => state,
  watch(f: () => void) { watchers.add(f); return () => { watchers.delete(f) } },
  onHit(f: (h: Hit) => void) { hitters.add(f); return () => { hitters.delete(f) } },
  onRemote(f: () => void) { remotes.add(f); return () => { remotes.delete(f) } },
  /** Ask for MIDI (Chrome shows its permission prompt the first time). */
  async connect() {
    const req = nav()?.requestMIDIAccess; if (!req) return
    if (access) { attach(); return }
    set({ status: 'asking', open: true })
    try { access = await req.call(nav(), { sysex: false }); access.onstatechange = attach; attach() } catch { set({ status: 'denied' }) }
  },
  /** Connect quietly when MIDI was already allowed, so a plugged-in kit shows up without a tap. */
  async auto() {
    if (access || !state.supported) return
    try { const p = await navigator.permissions?.query({ name: 'midi' as PermissionName }); if (p?.state === 'granted') await kit.connect() } catch { /* no permissions API */ }
  },
  setOpen: (open: boolean) => set({ open }),
  setRoute: (route: Route) => set({ route }),
  setOffset: (ms: number) => set({ delays: { ...state.delays, [state.route]: Math.round(Math.max(-200, Math.min(600, ms))) } }),
  /** this route's delay in ms: calibrated, else the route's starting guess */
  offset: () => state.delays[state.route] ?? ROUTE_DELAY[state.route],
  calibrated: () => state.delays[state.route] !== undefined,
  askPad: (v: Voice | null) => set({ asking: v }),
  /** Heard times (performance.now ms) of the last calibration's clicks. */
  calClicks: [] as number[],
  resetPads: () => set({ pads: {} }),
  best: (song: string, sec: string): Best | undefined => read().best?.[song]?.[sec],
  /** Keep the best loop score for a section (score 0–1 at tempo pct). */
  recordBest(song: string, sec: string, score: number, pct: number) {
    const s = read(), b = (s.best ??= {}), cur = b[song]?.[sec]
    if (cur && (cur.score > score || (cur.score === score && cur.pct >= pct))) return
    b[song] = { ...b[song], [sec]: { score, pct, at: Date.now() } }; write(s)
  },
}
if (typeof window !== 'undefined') (window as unknown as { __pulseKit: typeof kit }).__pulseKit = kit
