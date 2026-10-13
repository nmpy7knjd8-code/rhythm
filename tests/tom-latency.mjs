// Perceived-onset latency per voice vs the kick, from the real output: kick on beats 1/3, test voice on beats 2/4 (60 BPM, loud
// then soft). Reports each hit's [10%, 50%-of-peak] point in ms vs the grid set by the first kick. Late toms show positive values.
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/', kit = process.env.KIT ?? 'acoustic'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const p = await b.newPage({ viewport: { width: 390, height: 844 } }); await p.goto(url, { waitUntil: 'networkidle' })
const r = await p.evaluate(async kit => {
  window.__pulseSetKit(kit); await new Promise(r => setTimeout(r, 3000))
  const e = window.__pulseEngine, tctx = e.bus.context.rawContext, dest = tctx.createMediaStreamDestination(); e.bus.connect(dest)
  const ctx = new AudioContext(); await ctx.resume(); const out = {}
  for (const v of ['back', 'tomHi', 'tomMid', 'tomLo', 'crash1']) {
    const bar = { id: 'l', name: 'l', steps: 16, stepsPerBeat: 4, ticksPerStep: 3, suggestedBpm: 60, timeSig: '4/4', tracks: { low: '9.......9.......', [v]: '....9.......4...' } }
    const chunks = [], proc = ctx.createScriptProcessor(1024, 1, 1), src = ctx.createMediaStreamSource(dest.stream); src.connect(proc); proc.connect(ctx.destination)
    proc.onaudioprocess = ev => chunks.push(new Float32Array(ev.inputBuffer.getChannelData(0)))
    e.stop(); e.setSong([bar, bar]); e.setBpm?.(60); e.jumpSong(0); await new Promise(r => setTimeout(r, 400))
    await e.start(); await new Promise(r => setTimeout(r, 8600)); e.stop(); proc.disconnect(); src.disconnect()
    const n = chunks.reduce((a, c) => a + c.length, 0), x = new Float32Array(n); let o = 0; for (const c of chunks) { x.set(c, o); o += c.length }
    const sr = ctx.sampleRate; let mx = 0; for (let i = 0; i < x.length; i++) mx = Math.max(mx, Math.abs(x[i])); let first = 0; while (Math.abs(x[first]) < 0.05 * mx) first++
    const res = []
    for (let k = 0; k < 8; k++) { const w0 = first - Math.floor(0.03 * sr) + k * sr, w1 = w0 + Math.floor(0.25 * sr); if (w1 > x.length) break; let pk = 0; for (let i = w0; i < w1; i++) pk = Math.max(pk, Math.abs(x[i])); let i10 = w0; while (Math.abs(x[i10]) < 0.1 * pk) i10++; let i50 = w0; while (Math.abs(x[i50]) < 0.5 * pk) i50++; res.push([(i10 - first) / sr * 1000 - k * 1000, (i50 - first) / sr * 1000 - k * 1000].map(y => +y.toFixed(1))) }
    out[v] = res
  }
  return out
}, kit)
for (const [v, o] of Object.entries(r)) console.log(kit, v.padEnd(7), JSON.stringify(o))
await b.close()
