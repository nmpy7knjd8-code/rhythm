// Learn it section pills follow playback at 390px, scrolling only the row, and pause after a manual scroll.
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })).newPage()
const fail = []; const check = (n, ok, x = '') => { console.log(`${ok ? 'ok' : 'FAIL'} ${n}${x ? ' · ' + x : ''}`); if (!ok) fail.push(n) }
await p.goto(url + '?v=' + Date.now(), { waitUntil: 'networkidle' })
await p.evaluate(async () => { await window.__pulseLoadSong('ticks', 1) }); await p.waitForTimeout(400)
await p.locator('[aria-label="Browse rhythms"]').click(); await p.waitForTimeout(400)
const d = p.locator('[role=dialog]')
await d.getByRole('button', { name: 'Learn it', exact: true }).click()
await d.locator('[aria-label="Sections"]').waitFor()
await d.locator('button[aria-label="Play"]').first().click(); await p.waitForTimeout(400)
const state = () => p.evaluate(() => { const row = document.querySelector('[aria-label="Sections"]'), a = row.querySelector('[data-active]'), r = row.getBoundingClientRect(), q = a.getBoundingClientRect()
  return { name: a.textContent, visible: q.left >= r.left - 1 && q.right <= r.right + 1, off: Math.round((q.left + q.right) / 2 - (r.left + r.right) / 2), left: Math.round(row.scrollLeft), edge: row.scrollLeft < 2 || row.scrollLeft >= row.scrollWidth - row.clientWidth - 2, win: scrollY, sheet: Math.round(document.querySelector('[role=dialog] .overflow-y-auto')?.scrollTop ?? 0) } })
const starts = await p.evaluate(async () => { const j = await (await fetch('songs/ticks.json')).json(); let n = 0; return j.sections.map(s => { const a = n; n += s.bars.length; return a }) })
const secs = starts.length
const names = await p.evaluate(async () => (await (await fetch('songs/ticks.json')).json()).sections.map(s => s.name))
const settle = async k => { let s; for (let i = 0; i < 40; i++) { s = await state(); if (s.name === names[k] && s.visible && (Math.abs(s.off) < 40 || s.edge)) { await p.waitForTimeout(400); return await state() } await p.waitForTimeout(200) } return s }
const jump = k => p.evaluate(a => window.__pulseEngine.jumpSong(a, true), starts[k])
check('song has many sections', secs > 6, String(secs))
const s0 = await state()
await jump(8)
const s1 = await settle(8)
check('row follows playback to a late section', s1.name === names[8] && s1.visible && (Math.abs(s1.off) < 40 || s1.edge) && s1.left > 0, JSON.stringify(s1))
check('page and sheet did not jump', s1.win === s0.win && s1.sheet === s0.sheet, `${s0.win}/${s0.sheet} → ${s1.win}/${s1.sheet}`)
// user drags the row back to the start, then playback moves on: leave it alone
// sections change on the next downbeat, so retry until the change lands inside the 2 s window
let s2, t0, held = false
for (let tries = 0; tries < 4 && !held; tries++) {
  const row = await d.locator('[aria-label="Sections"]').boundingBox()
  const cdp = await p.context().newCDPSession(p); const y = row.y + row.height / 2
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 60, y }] })
  for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 60 + 30 * i, y }] }); await p.waitForTimeout(16) }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await p.evaluate(() => { document.querySelector('[aria-label="Sections"]').scrollLeft = 0 })
  t0 = Date.now()
  const k = tries % 2 ? secs - 1 : secs - 3
  await jump(k)
  while ((await state()).name !== names[k] && Date.now() - t0 < 3000) await p.waitForTimeout(50)
  await p.waitForTimeout(300); s2 = await state()
  held = Date.now() - t0 < 1900
  if (!held) await p.waitForTimeout(2200)
}
check('no auto-scroll right after a manual scroll', held && s2.left < 5, JSON.stringify(s2))
await p.waitForTimeout(2200); await jump(5)
const s3 = await settle(5)
check('auto-scroll resumes after 2 s', s3.visible && (Math.abs(s3.off) < 40 || s3.edge) && s3.name === names[5], JSON.stringify(s3))
await p.screenshot({ path: '/tmp/pills.png' })
await b.close()
if (fail.length) { console.log('FAILED', fail.join(', ')); process.exit(1) }
console.log('pills ok')
