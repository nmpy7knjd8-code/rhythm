import { chromium, devices } from 'playwright'
const U = process.argv[2] || 'https://nmpy7knjd8-code.github.io/rhythm/'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const c = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }); const p = await c.newPage(); p.on('pageerror', e => console.log('ERR', e.stack.slice(0,1500))); p.on('console', m => m.type()==='error' && console.log('CERR', m.text()))
await p.goto(U + '#/theory', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500)
console.log('overflow', await p.evaluate(() => document.documentElement.scrollWidth))
const n = await p.$$eval('section[id] h3', e => e.length); console.log('examples', n)
let bad = 0
for (let i = +(process.argv[3]||0); i < n; i++) {
  const h = (await p.$$('section[id] h3'))[i]; const name = await h.textContent()
  const btn = await h.evaluateHandle(el => el.nextElementSibling.querySelector('button'))
  await p.evaluate(() => { const e = window.__pulseEngine; if (e) { e.trace = [] } })
  await btn.asElement().scrollIntoViewIfNeeded(); await btn.asElement().click(); await p.waitForTimeout(1600)
  const r = await p.evaluate(() => { const e = window.__pulseEngine; return { playing: !!e?.playing || !!e?.isPlaying?.(), ev: e?.trace?.length ?? -1 } })
  if (!(r.ev > 0)) bad++
  console.log((r.ev > 0 ? 'ok ' : 'BAD'), name, JSON.stringify(r))

}
const songs = await p.$$eval('button[aria-label^="Play "]', e => e.length); console.log('song links', songs)
await p.locator('#meter').scrollIntoViewIfNeeded(); console.log('meter combo', await p.locator('#meter button.text-amber').textContent())
await p.locator('#ghost').scrollIntoViewIfNeeded(); await p.screenshot({ path: '/tmp/theory-ghost.png' })
await p.goto(U + '#/lens'); await p.waitForTimeout(1500); await p.screenshot({ path: '/tmp/lens-list.png' })
console.log(bad ? `${bad} BAD` : 'all examples produced hits'); await b.close()
