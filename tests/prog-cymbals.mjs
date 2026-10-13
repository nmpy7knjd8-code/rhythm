// The three Prog cymbal variants: listed in the Sound tab, load their cymbal samples, play cymbal hits without skips; Tool still gets Big prog kit.
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
const got = new Map(); p.on('response', r => { if (/samples\/(vsco2|acoustic)\//.test(r.url())) got.set(r.url().split('/').slice(-2).join('/').split('?')[0], r.status()) })
const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.goto(url, { waitUntil: 'networkidle' })
let fail = 0
for (const id of ['prog-dark', 'prog-smooth', 'prog-washy']) {
  const r = await p.evaluate(async id => {
    await window.__pulseLoadSong('backinblack', 1); window.__pulseSetKit(id); await new Promise(r => setTimeout(r, 2500))
    const e = window.__pulseEngine; e.trace = []; e.skipped = 0; await e.start(); await new Promise(r => setTimeout(r, 4000)); e.stop()
    const cym = e.trace.filter(x => /crash|ride|china/.test(x.voice)).length
    return { kit: e.kit?.name, hits: e.trace.length, cym, skipped: e.skipped }
  }, id)
  console.log(id, JSON.stringify(r)); if (!r.hits || !r.cym || r.skipped || !/^Prog · /.test(r.kit ?? '')) fail++
}
const v2 = [...got].filter(([k]) => k.startsWith('vsco2/')); console.log('vsco2 files', v2.length, 'bad', v2.filter(([, s]) => s >= 400).length)
if (!v2.length || v2.some(([, s]) => s >= 400)) fail++
await p.reload({ waitUntil: 'networkidle' }) // fresh session: no manual kit choice yet
const tool = await p.evaluate(async () => { await window.__pulseLoadSong('schism', 0); await new Promise(r => setTimeout(r, 800)); return window.__pulseEngine.kit?.name })
console.log('Tool song kit →', tool); if (tool !== 'Big prog kit') fail++
console.log('errors', errs); await b.close(); process.exit(fail + errs.length)
