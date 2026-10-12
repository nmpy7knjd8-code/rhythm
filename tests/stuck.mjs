import { chromium } from 'playwright'
const [id, sec, off, secs] = [process.argv[2], +process.argv[3], +process.argv[4], +(process.argv[5] ?? 10)]
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage()
p.on('pageerror', e => console.log('PAGEERROR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('console', m.text().slice(0, 200)) })
await p.goto('http://localhost:4173/rhythm/', { waitUntil: 'networkidle' })
const r = await p.evaluate(async ({ id, sec, off, secs }) => {
  await window.__pulseLoadSong(id, sec); const e = window.__pulseEngine; e.jumpSong(e.songBar + off); e.trace = []; const bars = []
  await e.start(); const T = window.Tone ?? null
  for (let i = 0; i < secs * 4; i++) { await new Promise(r => setTimeout(r, 250)); bars.push(e.songBar) }
  e.stop(); const t = e.trace.map(x => x.t); let back = 0; for (let i = 1; i < t.length; i++) if (t[i] < t[i - 1] - 0.05) back++
  return { bars: bars.join(','), events: t.length, back, span: t.length ? (t[t.length - 1] - t[0]).toFixed(2) : 0 }
}, { id, sec, off, secs })
console.log(id, JSON.stringify(r)); await b.close()
