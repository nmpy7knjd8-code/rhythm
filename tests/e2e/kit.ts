import type { Page } from '@playwright/test'

/** A fake Web MIDI kit (an "Alesis Nitro Pro" input) installed before the app loads. `granted` = MIDI already allowed. */
export async function mockKit(page: Page, { granted = true, plugged = true } = {}) {
  await page.addInitScript(({ granted, plugged }) => {
    type Msg = { data: Uint8Array; timeStamp: number }
    const input: { name: string; onmidimessage: ((e: Msg) => void) | null } = { name: 'Alesis Nitro Pro', onmidimessage: null }
    const access = { inputs: new Map(plugged ? [['nitro', input]] : []), onstatechange: null as null | (() => void) }
    Object.defineProperty(navigator, 'requestMIDIAccess', { value: async () => access, configurable: true })
    const q = navigator.permissions.query.bind(navigator.permissions)
    navigator.permissions.query = (async (d: PermissionDescriptor) => d.name === ('midi' as PermissionName) ? { state: granted ? 'granted' : 'prompt' } : q(d)) as typeof navigator.permissions.query
    ;(window as unknown as { __midi: unknown }).__midi = {
      /** a note-on on channel 10, stamped `at` (performance.now ms; default now) */
      hit(note: number, at = performance.now(), velocity = 100) { input.onmidimessage?.({ data: new Uint8Array([0x99, note, velocity]), timeStamp: at }) },
    }
  }, { granted, plugged })
}

/** Nitro Pro note per Pulse voice (user guide §5.2; GM for the rest). */
export const NOTE: Record<string, number> = { low: 36, back: 38, accent: 37, tick: 42, open: 46, pedal: 44, tomHi: 48, tomMid: 45, tomLo: 43, crash1: 49, crash2: 57, china: 52, ride: 51, rideBell: 53, bell: 56 }

type PageNote = { id: string; voice: string; at: number }
/** Wait for the next note to play that is still at least `lead` ms away, and hit it `delta` ms off (a different pad when `voice` is given). */
export async function hitNext(page: Page, delta: number, opts: { voice?: string; lead?: number; skip?: string[] } = {}) {
  return page.evaluate(async ({ delta, opts, NOTE }) => {
    const w = window as unknown as { __pulseScorer: { pending: PageNote[] }; __pulseKit: { offset(): number }; __midi: { hit(n: number, at: number): void } }
    for (let i = 0; i < 400; i++) {
      const n = w.__pulseScorer.pending.find(p => p.at > performance.now() + (opts.lead ?? 30) && !(opts.skip ?? []).includes(p.id))
      if (n) {
        const near = w.__pulseScorer.pending.filter(p => Math.abs(p.at - n.at) < 120).map(p => p.voice)
        const voice = opts.voice ?? n.voice
        if (opts.voice && near.includes(opts.voice)) { await new Promise(r => setTimeout(r, 20)); continue }
        w.__midi.hit(NOTE[voice], n.at + w.__pulseKit.offset() + delta)
        return { id: n.id, voice: n.voice, near }
      }
      await new Promise(r => setTimeout(r, 10))
    }
    throw new Error('no note to hit')
  }, { delta, opts, NOTE })
}

/** Play every note on time from now on (a perfect drummer), until the page closes. */
export async function autoPlay(page: Page) {
  await page.evaluate(NOTE => {
    const w = window as unknown as { __pulseScorer: { pending: PageNote[] }; __pulseKit: { offset(): number }; __midi: { hit(n: number, at: number): void } }
    const done = new Set<string>()
    setInterval(() => {
      for (const n of w.__pulseScorer.pending) if (!done.has(n.id) && n.at < performance.now() + 60) { done.add(n.id); w.__midi.hit(NOTE[n.voice], n.at + w.__pulseKit.offset()) }
    }, 10)
  }, NOTE)
}
