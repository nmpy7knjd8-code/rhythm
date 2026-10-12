import { chromium } from 'playwright'
const URL = process.env.URL || 'https://nmpy7knjd8-code.github.io/rhythm/'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await p.goto(URL + '?v=' + Date.now() + '#/library', { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
console.log('intro:', (await p.locator('main p').first().innerText()).slice(0, 45), '| bubbles nav height:', await p.locator('nav[aria-label=Artists]').evaluate(e => e.offsetHeight))
await p.screenshot({ path: '/workspace/screenshots/v12-library.png' })
await p.locator('[aria-label="Browse rhythms"]').click(); await p.waitForTimeout(400); await p.getByRole('button', { name: 'Sound' }).click(); await p.waitForTimeout(300)
console.log('sliders on Sound tab:', (await p.locator('[role=dialog] input[type=range]').evaluateAll(es => es.map(e => e.getAttribute('aria-label')))).join(', '))
for (const id of ['dilla', 'ukg', 'rock-8ths', 'house']) {
  const d = await p.evaluate(async id => { const e = window.__pulseEngine; e.stop(); window.__pulseLoadPattern?.(id); return !!window.__pulseLoadPattern }, id)
  if (!d) { console.log('no pattern loader hook'); break }
  const r = await p.evaluate(async () => { const e = window.__pulseEngine; e.trace = []; await e.start(); await new Promise(r => setTimeout(r, 1800)); e.stop(); const t = e.trace.filter(x => x.voice === 'tick').map(x => x.t); return t.slice(1, 9).map((x, i) => Math.round((x - t[i]) * 1000)) })
  console.log(id, 'hat intervals ms:', r.join(' '))
}
await b.close()
