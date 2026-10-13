// Feel slider: drags on a phone without closing the sheet; 0% exact, 100% natural, 200% harder shuffle capped at 4:1.
import { chromium } from 'playwright'
const URL = process.argv[2] ?? 'http://localhost:4173/rhythm/'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const p = await ctx.newPage(); await p.goto(URL + '?v=' + Date.now(), { waitUntil: 'networkidle' })
const cdp = await ctx.newCDPSession(p)
const touch = async (x, y, dx, dy, steps = 10) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / steps, y: y + dy * i / steps }] }); await p.waitForTimeout(16) } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(450) }
const hidden = () => p.locator('[role=dialog]').getAttribute('aria-hidden')
await p.locator('[aria-label="Browse rhythms"]').click(); await p.waitForTimeout(400); await p.getByRole('button', { name: 'Sound', exact: true }).click(); await p.waitForTimeout(300)
const f = p.locator('input[aria-label=Feel]'); await f.scrollIntoViewIfNeeded(); const sl = await f.boundingBox(); const v0 = await f.inputValue()
await touch(sl.x + sl.width * 0.5, sl.y + sl.height / 2, 110, 45)
console.log('feel drag: sheet hidden =', await hidden(), '| value', v0, '->', await f.inputValue(), '|', await p.locator('text=/^Feel/').first().innerText())
// shuffle ratio on a shuffle-tagged song at 0, 1, 2
const ratio = async fl => p.evaluate(async fl => {
  await window.__pulseLoadSong('mobydick'); const e = window.__pulseEngine; e.setFeel(fl)
  const bar = e.song.bars.findIndex(x => x.feel === '8th'); e.jumpSong(bar); e.trace = []; await e.start(); await new Promise(r => setTimeout(r, 2600)); e.stop()
  const p = e.song.bars[bar], tps = p.ticksPerStep, sec = tps * 60 / p.suggestedBpm / 12, t0 = e.trace[0].t
  const beat = 60 / p.suggestedBpm / e.songTempoScale, pos = e.trace.map(x => (x.t - t0) / beat) // in quarter beats (one 8th-note pair)
  const fr = [...new Set(pos.map(x => +(x % 1).toFixed(3)))].sort((a, b) => a - b)
  return fr
}, fl)
for (const fl of [0, 1, 2]) console.log(`feel ${fl * 100}%: onset positions within each beat`, (await ratio(fl)).join(' '))
await p.screenshot({ path: '/workspace/screenshots/feel-slider.png' }); await b.close()
