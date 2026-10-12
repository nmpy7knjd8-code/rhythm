import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage()
await p.goto((process.env.URL || 'https://nmpy7knjd8-code.github.io/rhythm/') + '#/library', { waitUntil: 'networkidle' })
for (const id of ['dilla', 'ukg', 'boom-bap', 'rock-8ths', 'funk-16', 'house']) {
  const r = await p.evaluate(async id => { const e = window.__pulseEngine; e.stop(); window.__pulseLoadPattern(id); e.trace = []; await e.start(); await new Promise(r => setTimeout(r, 2200)); e.stop()
    return e.trace.map(x => x.t) }, id)
  const t0 = r[0], bpm = await p.evaluate(() => window.__pulseEngine && Math.round(Number(document.querySelector('[aria-label="Current tempo"]')?.textContent) || 0))
  const s16 = 15 / (bpm || 100); const late = [...new Set(r.map(t => Math.round(((t - t0) / s16 % 1) * 100)))].sort((a, b) => a - b)
  console.log(id, `@${bpm} off-grid positions (% of a 16th):`, late.join(','))
}
await b.close()
