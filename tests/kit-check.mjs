// Per kit: ringing cymbals/open hat never choked at bar/section lines, density ducking on dense runs only,
// per-song profile rates on top of the kit, mix trims present, every song (Tool too) stays on the chosen kit; default Acoustic.
import { chromium } from 'playwright'
const U = process.argv[2] || 'https://nmpy7knjd8-code.github.io/rhythm/'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const p = await b.newPage({ viewport: { width: 390, height: 844 } }); await p.goto(U, { waitUntil: 'networkidle' })
for (const kit of ['acoustic', 'acoustic-big', 'acoustic-vintage']) for (const song of ['moon', 'kashmir', 'PAT:th-r-roll', 'PAT:th-gh-base']) {
  const r = await p.evaluate(async ({ kit, song }) => {
    window.__pulseSetKit(kit); await new Promise(r => setTimeout(r, 300))
    if (song.startsWith('PAT:')) window.__pulseLoadPattern(song.slice(4)); else await window.__pulseLoadSong(song, 0); await new Promise(r => setTimeout(r, 300))
    const e = window.__pulseEngine; const log = window.__log = [], chokes = window.__chokes = []; const seen = new Set()
    const kv = e.kit.voices, trims = [kv.accent.gain, kv.open.gain, kv.crash2.gain]
    const orig = (window.__origInst ??= e.inst.bind(e))
    e.inst = (ch, v) => { const i = orig(ch, v); if (!i.__w) { const t0 = i.trigger, c0 = i.choke; i.trigger = (t, vel, rr, gm, gate) => { window.__log.push({ v, t, rr, gm, gate, bar: e.songBar }); return t0(t, vel, rr, gm, gate) }; if (c0) i.choke = t => { window.__chokes.push({ v, t }); return c0(t) }; i.__w = 1 } return i }
    e.setBpm(e.songBaseBpm * 4); e.trace = []; await e.start(); e.setBpm(e.songBaseBpm * 4)
    await new Promise(r => setTimeout(r, 9000)); const tStop = window.Tone ? 0 : e.lastTime; window.__chokes.length; const nCh = chokes.length; e.stop(); chokes.length = nCh
    const bars = new Set(log.map(x => x.bar)).size
    const playChokes = chokes.filter(c => !['open'].includes(c.v) || !log.some(h => (h.v === 'tick' || h.v === 'pedal') && Math.abs(h.t - c.t) < 1e-6))
    const sn = log.filter(h => h.v === 'back'), cr = log.filter(h => h.v.startsWith('crash'))
    return { kitName: e.kit.name, bars, hits: log.length, trims: trims.map(x => +x.toFixed(3)), badChokes: playChokes.length, chokeVoices: [...new Set(playChokes.map(c => c.v))],
      snRate: sn[0]?.rr, snGate: sn[0]?.gate, cymRate: cr[0]?.rr, snDucked: sn.filter(h => h.gm < 0.999).length, snFull: sn.filter(h => h.gm >= 0.999).length, crDucked: cr.filter(h => h.gm < 0.999).length, crFull: cr.filter(h => h.gm >= 0.999).length, minGm: Math.min(...log.map(h => h.gm ?? 1)).toFixed(2) }
  }, { kit, song })
  console.log(kit.padEnd(17), song.padEnd(8), JSON.stringify(r))
}
for (const song of ['schism', 'moon']) { const k = await p.evaluate(async s => { window.__pulseSetKit('acoustic'); await new Promise(r => setTimeout(r, 200)); await window.__pulseLoadSong(s, 0); await new Promise(r => setTimeout(r, 300)); return window.__pulseEngine.kit.name }, song); console.log('auto kit', song, '→', k) }
await p.evaluate(async () => { await window.__pulseLoadSong('lateralus', 0) }); await p.waitForTimeout(400)
console.log('then non-Tool after Tool →', await p.evaluate(async () => { await window.__pulseLoadSong('moon', 0); await new Promise(r => setTimeout(r, 300)); return window.__pulseEngine.kit.name }))
await b.close()
