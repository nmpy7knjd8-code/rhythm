// 390 px: queue 3 songs from song cards, skip with Next, auto-advance at song end, remove from Up next.
import { chromium, devices } from 'playwright'
const U = process.argv[2] || 'https://nmpy7knjd8-code.github.io/rhythm/'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const c = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }); const p = await c.newPage()
p.on('pageerror', e => console.log('ERR', e.message))
await p.goto(U, { waitUntil: 'networkidle' }); await p.waitForTimeout(800)
const cur = () => p.evaluate(() => document.querySelector('.fixed.bottom-0 .text-\\[14px\\]')?.textContent)
const nextBtn = p.locator('button[aria-label^="Next song"]')
console.log('next disabled when empty:', await nextBtn.isDisabled())
const names = ['Back in Black', 'Billie Jean', 'Schism', 'Rosanna']
for (const n of names) await p.locator(`button[aria-label="Add ${n} to queue"]`).first().click()
console.log('queued label:', await nextBtn.getAttribute('aria-label'))
await p.screenshot({ path: '/tmp/q-dock.png' })
await nextBtn.click(); await p.waitForTimeout(1500)
console.log('after Next →', await cur(), '| playing', await p.evaluate(() => window.__pulseEngine.playing), '| kit', await p.evaluate(() => window.__pulseEngine.kit.name), '|', await nextBtn.getAttribute('aria-label'))
await nextBtn.click(); await p.waitForTimeout(1500)
console.log('after Next →', await cur(), '| kit', await p.evaluate(() => window.__pulseEngine.kit.name), '| sound', JSON.stringify(await p.evaluate(() => window.__pulseEngine.sound)))
// auto-advance: jump near the end of the current song
await p.evaluate(() => { const e = window.__pulseEngine; e.jumpSong(e.song.bars.length - 1) }); await p.waitForTimeout(9000)
console.log('auto-advance →', await cur(), '| kit', await p.evaluate(() => window.__pulseEngine.kit.name), '| playing', await p.evaluate(() => window.__pulseEngine.playing), '|', await nextBtn.getAttribute('aria-label'))
// Up next view + remove
await p.locator('button[aria-label="Add Kashmir to queue"]').first().click(); await p.locator('button[aria-label="Add Africa to queue"]').first().click()
await p.click('button[aria-label="Browse rhythms"]'); await p.waitForTimeout(700); await p.click('button[aria-expanded]'); await p.waitForTimeout(300)
const items = await p.$$eval('li:has(button[aria-label^="Remove "])', e => e.map(x => x.textContent))
console.log('up next:', items); await p.screenshot({ path: '/tmp/q-sheet.png' })
await p.locator('button[aria-label^="Remove Kashmir"]').click(); await p.waitForTimeout(300)
console.log('after remove:', await p.$$eval('li:has(button[aria-label^="Remove "])', e => e.map(x => x.textContent)))
const sizes = await p.$$eval('button[aria-label^="Next song"], button[aria-label^="Add "], button[aria-label^="Remove "]', e => e.slice(0, 3).map(x => { const r = x.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] }))
console.log('touch targets', JSON.stringify(sizes), 'overflow', await p.evaluate(() => document.documentElement.scrollWidth))
await b.close()
