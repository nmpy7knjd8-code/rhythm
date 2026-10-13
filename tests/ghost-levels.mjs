// Records isolated snare hits per tier (ghost '3', soft '5', backbeat '7', accent '9') through the real engine at the shipped feel
// and reports the mean attack level (RMS of 60 ms after each onset) per tier in dB relative to the backbeat, for every kit.
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/', kits = (process.argv[3] ?? 'acoustic').split(',')
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const p = await b.newPage(); await p.goto(url, { waitUntil: 'networkidle' })
for (const kit of kits) {
  const r = await p.evaluate(async ({ kit }) => {
    window.__pulseSetKit(kit); await new Promise(r => setTimeout(r, 3000))
    const e = window.__pulseEngine, T = { ghost: '3', soft: '5', backbeat: '7', accent: '9' }
    const mk = c => ({ id: 'lv', name: 'lv', steps: 16, stepsPerBeat: 4, ticksPerStep: 3, suggestedBpm: 60, timeSig: '4/4', tracks: { back: (c + '...').repeat(4) } })
    const bars = Object.values(T).flatMap(c => [mk(c), mk(c)])
    e.stop(); e.setSong(bars); e.setSongBaseBpm?.(60); e.setBpm?.(60); e.jumpSong(0)
    const tctx = e.bus.context.rawContext, dest = tctx.createMediaStreamDestination(); e.bus.connect(dest)
    const ctx = window.__rec ??= new AudioContext(); await ctx.resume()
    const chunks = []; const proc = ctx.createScriptProcessor(4096, 1, 1); const src = ctx.createMediaStreamSource(dest.stream); src.connect(proc); proc.connect(ctx.destination)
    proc.onaudioprocess = ev => chunks.push(new Float32Array(ev.inputBuffer.getChannelData(0)))
    await new Promise(r => setTimeout(r, 300)); await e.start(); await new Promise(r => setTimeout(r, 32500)); e.stop()
    proc.disconnect(); src.disconnect(); e.bus.disconnect(dest)
    const n = chunks.reduce((a, c) => a + c.length, 0), d = new Float32Array(n); let o = 0; for (const c of chunks) { d.set(c, o); o += c.length }
    // hits every 1 s; find each onset as the first sample above 3x the noise after the previous hit window
    const sr = ctx.sampleRate, ons = []; let i = 0
    const thr = 0.002
    while (i < n && ons.length < 32) { if (Math.abs(d[i]) > thr) { ons.push(i); i += Math.floor(0.8 * sr) } else i++ }
    const lv = ons.map(s => { let q = 0; const w = Math.floor(0.06 * sr); for (let k = 0; k < w; k++) q += (d[s + k] ?? 0) ** 2; return 10 * Math.log10(q / w + 1e-12) })
    const names = Object.keys(T), res = {}
    names.forEach((k, j) => { const a = lv.slice(j * 8, j * 8 + 8); res[k] = a.reduce((x, y) => x + y, 0) / a.length })
    return { found: ons.length, res }
  }, { kit })
  const bb = r.res.backbeat, f = k => (r.res[k] - bb).toFixed(1)
  console.log(kit.padEnd(10), `hits ${r.found}/32`, `ghost ${f('ghost')} dB  soft ${f('soft')} dB  backbeat 0  accent ${f('accent')} dB`)
}
await b.close()
