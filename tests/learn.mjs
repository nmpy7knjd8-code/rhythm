// Learn it tab at 390px: notation, bar loop, mute/solo, steps, tempo slider, speed trainer.
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
const url = process.argv[2] ?? 'http://localhost:5173/rhythm/'
const dir = process.argv[3] ?? '/tmp/learn-shots'
mkdirSync(dir, { recursive: true })
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const p = await ctx.newPage()
const fail = []
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok' : 'FAIL'} ${name}${extra ? ' · ' + extra : ''}`); if (!ok) fail.push(name) }
await p.goto(url + '?v=' + Date.now(), { waitUntil: 'networkidle' })
await p.evaluate(async () => { await window.__pulseLoadSong('billiejean', 1) })
await p.waitForTimeout(500)
await p.locator('[aria-label="Browse rhythms"]').click()
await p.waitForTimeout(500)
const d = p.locator('[role=dialog]')
await d.getByRole('button', { name: 'Learn it', exact: true }).click()
await d.getByText('Right hand').first().waitFor({ timeout: 8000 })
check('overview', await d.getByText(/one limb at a time/).count() > 0)
const grid = await d.locator('[aria-label="Bar notation with the count under each beat"]').innerText()
check('count under the beats', /\b1\b/.test(grid) && grid.includes('e') && grid.includes('&') && grid.includes('a'))
check('limb rows', grid.includes('R hand') && grid.includes('L hand') && grid.includes('R foot'))
await p.screenshot({ path: `${dir}/learn-grid.png` })

const boxes = await d.locator('button').evaluateAll(els => els.map(el => {
  const r = el.getBoundingClientRect()
  return { name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 28), w: Math.round(r.width), h: Math.round(r.height) }
}).filter(x => x.h > 0))
const small = boxes.filter(x => x.w < 36 || x.h < 36)
check('touch targets ≥ 36', small.length === 0, small.length ? JSON.stringify(small.slice(0, 6)) : `${boxes.length} buttons`)

const bars = d.locator('button[aria-label^="Learn bar"]')
const start = await p.evaluate(() => window.__pulseEngine.songBar)
await bars.nth(0).click(); await bars.nth(2).click(); await p.waitForTimeout(200)
const loop = await p.evaluate(() => window.__pulseEngine.song.loop)
check('bar range loop', JSON.stringify(loop) === JSON.stringify([start, start + 3]), JSON.stringify(loop))

await d.getByRole('button', { name: 'Solo Kick' }).click(); await p.waitForTimeout(80)
let voices = await p.evaluate(() => window.__pulseEngine.practiceVoices ? [...window.__pulseEngine.practiceVoices] : null)
check('solo kick', JSON.stringify(voices) === '["low"]', JSON.stringify(voices))
await d.getByRole('button', { name: 'Reset' }).click()
await d.getByRole('button', { name: 'Hands only' }).click(); await p.waitForTimeout(80)
voices = await p.evaluate(() => [...(window.__pulseEngine.practiceVoices ?? [])])
check('hands only', voices.includes('tick') && voices.includes('back') && !voices.includes('low') && !voices.includes('pedal'), JSON.stringify(voices))
await d.getByRole('button', { name: 'All' }).click(); await p.waitForTimeout(80)
check('all clears the filter', await p.evaluate(() => window.__pulseEngine.practiceVoices) === null)

await d.getByRole('button', { name: 'Steps', exact: true }).click(); await p.waitForTimeout(80)
voices = await p.evaluate(() => [...(window.__pulseEngine.practiceVoices ?? [])])
check('step 1 is the timekeeping', voices.includes('tick') && !voices.includes('low'), JSON.stringify(voices))
check('step label', await d.getByText('Step 1 of').count() > 0)
await d.getByRole('button', { name: 'Next', exact: true }).click(); await p.waitForTimeout(80)
check('step 2', await d.getByText('Step 2 of').count() > 0)

const sl = await d.locator('input[aria-label="Practice tempo"]').boundingBox()
const cdp = await ctx.newCDPSession(p)
const touch = async (x, y, dx, dy, steps = 8) => {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / steps, y: y + dy * i / steps }] }); await p.waitForTimeout(16) }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(250)
}
await touch(sl.x + sl.width * 0.8, sl.y + sl.height / 2, -60, 110)
check('slider drag keeps the sheet open', await d.getAttribute('aria-hidden') === 'false')
await d.getByRole('button', { name: '85%', exact: true }).click(); await p.waitForTimeout(100)
check('85% tempo scale', await p.evaluate(() => Math.round(window.__pulseEngine.songTempoScale * 100)) === 85)

// one-bar loop so the trainer can climb within a few seconds
await d.getByRole('button', { name: 'Clear', exact: true }).click(); await p.waitForTimeout(100)
await bars.nth(0).click(); await bars.nth(0).click(); await p.waitForTimeout(150)
await d.getByRole('button', { name: '2', exact: true }).click()
await d.getByRole('button', { name: 'Speed trainer' }).click()
if (!await p.evaluate(() => window.__pulseEngine.playing)) await d.locator('button[aria-label="Play"]').click()
await p.waitForTimeout(400)
const before = await p.evaluate(() => Math.round(window.__pulseEngine.songTempoScale * 100))
await p.waitForTimeout(11000)
const after = await p.evaluate(() => Math.round(window.__pulseEngine.songTempoScale * 100))
check('speed trainer +5%', after >= before + 5 && after <= 100, `${before} → ${after}`)

await d.getByRole('button', { name: 'Count-in' }).click()
await d.getByRole('button', { name: 'Click', exact: true }).click()
await p.waitForTimeout(80)
check('count-in on', await p.evaluate(() => window.__pulseEngine.countInOn === true))
check('click on', await p.evaluate(() => window.__pulseEngine.metronome === true))
await p.screenshot({ path: `${dir}/learn-tools.png` })
await d.locator('.overflow-y-auto').evaluate(el => { el.scrollTop = el.scrollHeight })
await p.waitForTimeout(250)
await p.screenshot({ path: `${dir}/learn-limbs.png` })

// turn the practice tools back off, then prove an ordinary bar still schedules kick and snare
for (const name of ['Speed trainer', 'Count-in', 'Click', 'Steps']) {
  const btn = d.getByRole('button', { name, exact: true })
  await btn.scrollIntoViewIfNeeded()
  if (await btn.getAttribute('aria-pressed') === 'true') await btn.click()
}
await p.waitForFunction(() => window.__pulseEngine.practiceVoices === null && window.__pulseEngine.countInOn === false && window.__pulseEngine.metronome === false)
const traced = await p.evaluate(async () => {
  const e = window.__pulseEngine
  e.stop(); e.practiceVoices = null; e.practicePattern = null; e.metronome = false; e.countInOn = false
  e.jumpSong(e.songBar); e.trace = []; await e.start()
  await new Promise(r => setTimeout(r, 2000)); e.stop()
  return { voices: [...new Set(e.trace.filter(x => x.src === 'song').map(x => x.voice))].sort(), filter: e.practiceVoices ? [...e.practiceVoices] : null }
})
check('full mix still schedules kick and snare', traced.voices.includes('low') && traced.voices.includes('back') && traced.filter === null, JSON.stringify(traced))
await b.close()
if (fail.length) { console.log('FAILED', fail.join(', ')); process.exit(1) }
console.log('learn tab ok')
