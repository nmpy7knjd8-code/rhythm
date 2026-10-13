// Renders the first bars of songs with fast rolls and compares every scheduled hit with the time implied by the transcription data
// (step × step length + sub-step fraction). Reports max error and the smallest intervals found (proves 32nds/sextuplets survive).
import { chromium } from 'playwright'
import { readFileSync } from 'fs'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/'
const songs = (process.argv[3] ?? 'sober:0,fool:0,tomsawyer:0,schism:3').split(',').map(x => x.split(':'))
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const p = await b.newPage(); await p.goto(url, { waitUntil: 'networkidle' })
await p.getByRole('button', { name: 'Browse rhythms' }).click(); await p.waitForTimeout(300)
const A = { kick: 'low', snare: 'back', closedHat: 'tick', openHat: 'open', pedalHat: 'pedal', ride: 'ride', rideBell: 'rideBell', crash1: 'crash1', crash2: 'crash2', china: 'china', tomHi: 'tomHi', tomMid: 'tomMid', tomFloor: 'tomLo', crossStick: 'accent', cowbell: 'bell', shaker: 'shaker' }
let fail = 0
for (const [id, sec] of songs) {
  const d = JSON.parse(readFileSync(`public/songs/${id}.json`)); const s = d.sections[+sec]
  const exp = []; let t = 0
  s.bars.slice(0, 3).forEach((bar, i) => {
    const stepSec = s.ticksPerStep[i] * 60 / s.bpm[i] / 12; const n = Object.values(bar).find(v => typeof v === 'string').length
    for (const [k, str] of Object.entries(bar)) if (!k.startsWith('_')) [...str].forEach((c, st) => { if (c !== '.' && A[k]) exp.push({ v: A[k], t: t + st * stepSec }) })
    for (const [k, m] of Object.entries(bar._sub ?? {})) for (const [st, l] of Object.entries(m)) for (const [fr] of l) if (A[k]) exp.push({ v: A[k], t: t + (+st + (typeof fr === "string" ? fr.split("/").reduce((a, b) => a / b) : fr)) * stepSec, inner: true })
    t += n * stepSec
  })
  const r = await p.evaluate(async ({ id, sec, dur }) => { await window.__pulseLoadSong(id, sec); const e = window.__pulseEngine; e.trace = []; await e.start(); await new Promise(r => setTimeout(r, dur)); e.stop(); return e.trace }, { id, sec: +sec, dur: t * 1000 + 600 })
  const meta = JSON.parse(readFileSync('src/data/songs.json')).find(x => x.id === id)
  const hum = (s.humanize ? (s.humanize.lateMs + s.humanize.jitterMs) / 1000 : 0) + (meta?.drift ? 2 * meta.drift / 1000 : 0) // groove-drift songs: tolerance = the drift's full swing
  const t0 = r[0]?.t ?? 0, firstExp = Math.min(...exp.map(x => x.t))
  const got = r.filter(x => x.t - t0 < t - firstExp - 1e-6).map(x => ({ v: x.voice, t: x.t - t0 + firstExp })).filter(x => !x.v.startsWith('crash') || true)
  let maxErr = 0, maxIn = 0, unmatched = 0
  for (const e of exp) { const m = got.filter(g => g.v === e.v).reduce((a, g) => Math.min(a, Math.abs(g.t - e.t)), 9); if (m > (e.inner ? 0.0045 : 0.001) + hum) unmatched++; else if (e.inner) maxIn = Math.max(maxIn, m); else maxErr = Math.max(maxErr, m) }
  const ints = [...new Set(got.map(g => g.t))].sort((a, b) => a - b).slice(1).map((x, i, arr) => x - (i ? arr[i - 1] : got[0].t))
  console.log(`${id} [${s.name}]: expected ${exp.length}, scheduled ${got.length}, grid strokes max error ${(maxErr * 1000).toFixed(3)} ms, inner roll strokes max drift ${(maxIn * 1000).toFixed(2)} ms, unmatched ${unmatched}, smallest intervals ${[...new Set(ints.map(x => Math.round(x * 1000)))].sort((a, b) => a - b).slice(0, 4).join(', ')} ms`)
  if (unmatched) fail++
}
await b.close(); process.exit(fail)
