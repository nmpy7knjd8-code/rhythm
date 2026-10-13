// Renders songs in the real engine and flags any voice with two hits closer than 20 ms (grace notes counted).
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/'
const ids = (process.argv[3] ?? 'moon,cometogether,tomsawyer,levee,purdie,yyz,schism,amen').split(',')
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const p = await b.newPage(); await p.goto(url, { waitUntil: 'networkidle' })
await p.getByRole('button', { name: 'Browse rhythms' }).click(); await p.waitForTimeout(300)
let bad = 0
for (const id of ids) {
  const r = await p.evaluate(async id => {
    await window.__pulseLoadSong(id, 1); const e = window.__pulseEngine; e.trace = []
    await e.start(); await new Promise(r => setTimeout(r, 6000)); e.stop(); return e.trace
  }, id)
  const last = {}; const close = []
  for (const ev of r.sort((a, b) => a.t - b.t)) { const k = ev.src + ':' + ev.voice; if (last[k] !== undefined && ev.t - last[k] < 0.02) close.push(`${ev.voice} ${((ev.t - last[k]) * 1000).toFixed(1)}ms`); last[k] = ev.t }
  console.log(`${id}: ${r.length} events, ${close.length ? 'CLOSE ' + close.slice(0, 4).join(', ') : 'ok'}`); if (close.length) bad++
}
await b.close(); process.exit(bad)
