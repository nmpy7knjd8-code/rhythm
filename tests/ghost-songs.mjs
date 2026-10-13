// Plays ghost-heavy songs (tempo x8) and counts snare hits per tier (2 ghost, 1 soft, 0 full) as scheduled by the engine.
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/', ids = (process.argv[3] ?? 'fool,50ways,purdie,funkydrummer,4646,questlove,hollow').split(',')
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto(url, { waitUntil: 'networkidle' })
for (const id of ids) {
  const r = await p.evaluate(async id => { await window.__pulseLoadSong(id, 0); const e = window.__pulseEngine; e.trace = []; const base = e.songBaseBpm; await e.start(); e.setBpm(base * 8)
    await new Promise(r => setTimeout(r, 8000)); e.stop(); const c = { 0: 0, 1: 0, 2: 0 }; for (const x of e.trace) if (x.voice === 'back') c[x.tier]++; return c }, id)
  console.log(id.padEnd(13), `ghost ${r[2]}  soft ${r[1]}  full ${r[0]}`)
}
await b.close()
