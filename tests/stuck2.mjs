import { chromium } from 'playwright'
const id = process.argv[2]
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage()
await p.goto('http://localhost:4173/rhythm/', { waitUntil: 'networkidle' })
const r = await p.evaluate(async (id) => {
  await window.__pulseLoadSong(id, 2); const e = window.__pulseEngine; e.trace = []; const log = []
  await e.start()
  for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 200)); if (i === 8 || i === 9 || i === 10) e.setBpm(140 + i * 10); const n = e.trace.length; log.push(e.songBar + ':' + n) }
  e.stop(); return log.join(' ')
}, id)
console.log(id, r); await b.close()
