// Forty Six & 2 Drum Solo bar 5 (song bar 96): snare onsets and level as played (no ducking in this song).
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto(url + '?v=' + Date.now(), { waitUntil: 'networkidle' })
console.log(JSON.stringify(await p.evaluate(async () => {
  await window.__pulseLoadSong('4646', 0); await new Promise(r => setTimeout(r, 800)); const e = window.__pulseEngine
  e.jumpSong(96); e.trace = []; await e.start(); await new Promise(r => setTimeout(r, 2500)); e.stop()
  const t = e.trace.filter(x => x.bar === e.trace[0].bar); const t0 = t[0].t
  return { sound: e.sound, snareMs: t.filter(x => x.voice === 'back').map(x => Math.round((x.t - t0) * 1000)), kicks: t.filter(x => x.voice === 'low').length, sixteenthMs: Math.round(15000 / 78) }
})))
await b.close()
