import { webkit, chromium, devices } from 'playwright'
const URL = process.env.URL || 'https://nmpy7knjd8-code.github.io/rhythm/'
let engine = webkit; try { const t = await webkit.launch(); await t.close() } catch { engine = chromium; console.log('(webkit unavailable, using chromium with iPhone profile)') }
const b = await engine.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage()
await p.goto(URL + '?v=' + Date.now() + '#/library', { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
const bar = () => p.evaluate(() => { const el = [...document.body.children].find(e => e.querySelector?.('[aria-label="Browse rhythms"]')); const r = el.getBoundingClientRect(); let a = el.parentElement, tr = []; while (a) { const cs = getComputedStyle(a); if (cs.transform !== 'none' || cs.filter !== 'none') tr.push(a.tagName); a = a.parentElement }
  return { bottomGap: Math.round(innerHeight - r.bottom), parent: el.parentElement.tagName, transformedAncestors: tr.join(',') || 'none' } })
console.log('before:', JSON.stringify(await bar()))
await p.getByText('More artists').tap(); await p.locator('nav[aria-label=Artists] button').nth(20).tap(); await p.waitForTimeout(800)
await p.touchscreen.tap(200, 400) // user touch: re-aim must stop
const res = []
for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, i % 2 ? -500 : 900); await p.evaluate(() => window.scrollBy(0, 0)); await p.waitForTimeout(400); res.push((await bar()).bottomGap) }
console.log('bottom gap while scrolling down/up (px, 0 = docked):', res.join(' '))
await b.close()
