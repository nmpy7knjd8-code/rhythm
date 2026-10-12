import { chromium } from 'playwright'
const URL = process.env.URL || 'https://nmpy7knjd8-code.github.io/rhythm/'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage()
await p.goto(URL + '?v=' + Date.now() + '#/library', { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
// 1) polyrhythm: kick 4 quarters, snare n-tuplet over the bar via exact sub-step fractions, at 120 BPM (bar = 2 s)
for (const n of [2, 3, 5, 6, 7]) {
  const r = await p.evaluate(async n => {
    const e = window.__pulseEngine; const sub = {}
    for (let k = 0; k < n; k++) { const num = 16 * k, step = Math.floor(num / n), rem = num - step * n; (sub[step] ??= []).push([`${rem}/${n}`, 0.8]) }
    const bar = { id: 'poly', name: 'poly', steps: 16, stepsPerBeat: 4, ticksPerStep: 3, suggestedBpm: 120, timeSig: '4/4', tracks: { low: 'X...X...X...X...' }, sub: { back: sub } }
    e.stop(); e.setSong([bar, bar]); e.setSongBaseBpm(120); e.setBpm?.(120); e.setFeel(0); e.jumpSong(0); e.trace = []; await e.start(); await new Promise(r => setTimeout(r, 2600)); e.stop(); e.setFeel(1)
    return e.trace }, n)
  console.log([...new Set(r.map(x => x.voice))].join(','), r.length); const k = r.filter(x => x.voice === 'low').map(x => x.t), s = r.filter(x => x.voice === 'back').map(x => x.t)
  const t0 = k[0], err = Math.max(...s.slice(0, n).map((t, i) => Math.abs(t - t0 - i * 2 / n) * 1000), ...k.slice(0, 4).map((t, i) => Math.abs(t - t0 - i * 0.5) * 1000))
  console.log(`${n}:4  snare ${s.slice(0, n).map(t => ((t - t0) * 1000).toFixed(1)).join(' ')} ms | max error ${err.toFixed(3)} ms`)
}
// 2) feel on Rosanna (shuffle tab) and Schism (straight)
const hat = async (id, f, bar) => p.evaluate(async ([id, f, bar]) => { await window.__pulseLoadSong(id, 0); const e = window.__pulseEngine; e.stop(); e.setFeel(f); e.jumpSong(bar); e.trace = []; await e.start(); await new Promise(r => setTimeout(r, 2500)); e.stop(); e.setFeel(1)
  const t = e.trace.filter(x => x.voice === 'tick' || x.voice === 'ride').map(x => x.t); return t.slice(1, 13).map((x, i) => Math.round((x - t[i]) * 1000)) }, [id, f, bar])
console.log('Rosanna hats, feel 100%:', (await hat('rosanna', 1, 13)).join(' '))
console.log('Rosanna hats, feel 0%:  ', (await hat('rosanna', 0, 13)).join(' '))
console.log('Schism hats, feel 100%: ', (await hat('schism', 1, 14)).join(' '))
console.log('Schism hats, feel 0%:   ', (await hat('schism', 0, 14)).join(' '))
await b.close()
