// Dense-passage spacing as scheduled by the engine: for each song, play the densest 4 bars and compare every consecutive
// pair of onsets (same drum, and all drums) against the transcription's exact gap. Reports the worst gap error (ms) and how many
// gaps are off by > 3 ms or reordered. FEEL env (default 0.9, the shipped feel).
import { chromium } from 'playwright'
import { readFileSync } from 'fs'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/'
const ids = process.argv[3].split(','); const FL = +(process.env.FEEL ?? 0.9)
const A = { kick: 'low', snare: 'back', closedHat: 'tick', openHat: 'open', pedalHat: 'pedal', ride: 'ride', rideBell: 'rideBell', crash1: 'crash1', crash2: 'crash2', china: 'china', tomHi: 'tomHi', tomMid: 'tomMid', tomFloor: 'tomLo', crossStick: 'accent', cowbell: 'bell', shaker: 'shaker' }
const fr = f => typeof f === 'string' ? f.split('/').reduce((a, b) => a / b) : f
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const p = await b.newPage({ viewport: { width: 390, height: 844 } }); await p.goto(url, { waitUntil: 'networkidle' })
const out = []
for (const id of ids) {
  const d = JSON.parse(readFileSync(`public/songs/${id}.json`)); const bars = d.sections.flatMap(s => s.bars.map((bar, i) => ({ bar, tps: s.ticksPerStep[i], bpm: s.bpm[i] })))
  const dens = bars.map(({ bar, tps, bpm }) => { const n = Object.values(bar).find(v => typeof v === 'string').length; let c = 0; for (const [k, v] of Object.entries(bar)) if (!k.startsWith('_')) c += [...v].filter(x => x !== '.').length; for (const m of Object.values(bar._sub ?? {})) for (const l of Object.values(m)) c += l.length; return c / (n * tps * 5 / bpm) })
  let best = 0, bi = 0; for (let i = 0; i + 4 <= bars.length; i++) { const s = dens.slice(i, i + 4).reduce((a, x) => a + x, 0); if (s > best) { best = s; bi = i } }
  const exp = []; let t = 0
  for (const { bar, tps, bpm } of bars.slice(bi, bi + 4)) {
    if (bar._tempo) { exp.length = 0; break } // skip bars with mid-bar tempo changes (exact map needed)
    const stepSec = tps * 5 / bpm, n = Object.values(bar).find(v => typeof v === 'string').length
    for (const [k, v] of Object.entries(bar)) if (!k.startsWith('_') && A[k]) [...v].forEach((c, st) => { if (c !== '.') exp.push({ v: A[k], t: t + st * stepSec }) })
    for (const [k, m] of Object.entries(bar._sub ?? {})) for (const [st, l] of Object.entries(m)) for (const [f] of l) if (A[k]) exp.push({ v: A[k], t: t + (+st + fr(f)) * stepSec })
    t += n * stepSec
  }
  if (!exp.length) { out.push(`${id}: skipped (tempo change)`); continue }
  const sec = d.sections.findIndex((s, i) => d.sections.slice(0, i + 1).reduce((a, x) => a + x.bars.length, 0) > bi)
  const tr = await p.evaluate(async ({ id, bi, dur, fl }) => { await window.__pulseLoadSong(id); const e = window.__pulseEngine; e.setFeel(fl); e.jumpSong(bi); e.trace = []; await e.start(); await new Promise(r => setTimeout(r, dur)); e.stop(); return e.trace.map(x => ({ v: x.voice, t: x.t })) }, { id, bi, dur: t * 1000 + 500, fl: FL })
  if (!tr.length) { out.push(`${id}: no hits`); continue }
  const t0 = tr[0].t - Math.min(...exp.map(x => x.t))
  const got = tr.map(x => ({ v: x.v, t: x.t - t0 })).filter(x => x.t < t - 1e-4)
  // match each expected onset to the nearest scheduled one of that voice
  const pairs = exp.map(e => { let m = null, md = 9; for (const g of got) if (g.v === e.v && Math.abs(g.t - e.t) < md) { md = Math.abs(g.t - e.t); m = g } return { e: e.t, g: m ? m.t : NaN, v: e.v } }).filter(x => !isNaN(x.g))
  const gapErr = list => { list.sort((a, b) => a.e - b.e); let worst = 0, bad = 0, rev = 0, n = 0; for (let i = 1; i < list.length; i++) { const de = list[i].e - list[i - 1].e; if (de <= 1e-6 || de > 0.13) continue; n++; const dg = list[i].g - list[i - 1].g; const err = Math.abs(dg - de); worst = Math.max(worst, err); if (err > 0.003) bad++; if (dg <= 0) rev++ } return { n, worst: +(worst * 1000).toFixed(2), bad, rev } }
  const byV = {}; for (const x of pairs) (byV[x.v] ??= []).push(x)
  const same = Object.values(byV).map(gapErr).reduce((a, x) => ({ n: a.n + x.n, worst: Math.max(a.worst, x.worst), bad: a.bad + x.bad, rev: a.rev + x.rev }), { n: 0, worst: 0, bad: 0, rev: 0 })
  const uniq = []; for (const x of pairs.sort((a, b) => a.e - b.e)) if (!uniq.length || x.e - uniq.at(-1).e > 1e-6) uniq.push(x)
  const all = gapErr(uniq)
  out.push(`${id.padEnd(15)} bars ${bi + 1}-${bi + 4}  same-drum gaps ${same.n} worst ${same.worst} ms >3ms ${same.bad} reordered ${same.rev} | all-drum gaps ${all.n} worst ${all.worst} ms >3ms ${all.bad} reordered ${all.rev}`)
  console.log(out.at(-1))
}
await b.close()
