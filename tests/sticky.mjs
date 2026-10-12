import { chromium, devices } from 'playwright'
const URL = process.env.URL || 'https://nmpy7knjd8-code.github.io/rhythm/'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }); const p = await ctx.newPage()
await p.goto(URL + '?v=' + Date.now() + '#/library', { waitUntil: 'networkidle' })
await p.evaluate(async () => { await window.__pulseLoadSong('vicarious', 0) }); await p.waitForTimeout(300)
await p.locator('[aria-label="Browse rhythms"]').tap(); await p.waitForTimeout(600)
const grid = () => p.evaluate(() => { const sc = document.querySelector('[role=dialog] .overflow-y-auto'); const g = sc.querySelector('.sticky'); return { gridTop: Math.round(g.getBoundingClientRect().top - sc.getBoundingClientRect().top), scrollTop: Math.round(sc.scrollTop) } })
console.log('start:', JSON.stringify(await grid()))
await p.evaluate(() => { const sc = document.querySelector('[role=dialog] .overflow-y-auto'); sc.dispatchEvent(new Event('wheel')); sc.scrollTop = 600 }); await p.waitForTimeout(400)
console.log('after scrolling list down:', JSON.stringify(await grid()))
await p.screenshot({ path: '/workspace/screenshots/v17-sticky-grid.png' })
// auto-follow: jump playback to a late section after the 4 s pause
await p.waitForTimeout(4200)
const r = await p.evaluate(async () => { const e = window.__pulseEngine; e.jumpSong(5); await e.start(); await new Promise(r => setTimeout(r, 300)); e.jumpSong(150, true); await new Promise(r => setTimeout(r, 2500)); e.stop()
  const sc = document.querySelector('[role=dialog] .overflow-y-auto'), act = [...sc.querySelectorAll('ol > li')].find(li => li.querySelector('.text-amber')); const r1 = act.getBoundingClientRect(), b = sc.getBoundingClientRect()
  return { active: act.innerText.split('\n')[0], visible: r1.top >= b.top && r1.bottom <= b.bottom, scrollTop: Math.round(sc.scrollTop) } })
console.log('auto-follow:', JSON.stringify(r))
await b.close()
