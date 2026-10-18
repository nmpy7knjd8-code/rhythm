// Bar-range loop: a 2-bar loop inside a section wraps (>= 2 times), a cross-section range works, clearing restores normal playback.
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/', shot = process.argv[3] ?? '/workspace/loop.png'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto(url + '?v=' + Date.now(), { waitUntil: 'networkidle' })
await p.evaluate(async () => { await window.__pulseLoadSong('backinblack', 0) }); await p.waitForTimeout(300)
await p.locator('button[aria-label="Play"]').first().click(); await p.waitForTimeout(500)
await p.evaluate(() => { const e = window.__pulseEngine; e.setBpm(e.songBaseBpm * 3) })
await p.locator('button[aria-label="Browse rhythms"]').click(); await p.waitForTimeout(600)
const d = p.locator('[role=dialog]')
await d.getByRole('button', { name: 'Loop', exact: true }).click(); await p.waitForTimeout(300)
const watch = async ms => { const seen = []; const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await p.evaluate(() => window.__pulseEngine.songBar); if (seen[seen.length - 1] !== v) seen.push(v); await p.waitForTimeout(60) } return seen }
const sizes = await d.locator('button[aria-label^="Loop bar"]').first().boundingBox()
// 2-bar loop: bars 12-13 (0-based 11-12)
await d.locator('button[aria-label="Loop bar 12"]').click(); await d.locator('button[aria-label="Loop bar 13"]').click()
const chip1 = await d.locator('button[aria-label="Clear loop"]').innerText()
const s1 = await watch(7000); const wraps1 = s1.filter((v, i) => i && v === 11 && s1[i - 1] === 12).length
await p.screenshot({ path: shot })
// cross-section range: find a section boundary and loop across it
const st = await p.evaluate(() => window.__pulseEngine.song.bars.length)
const secs = await d.locator('button[aria-label^="Jump to"]').count()
await d.locator('button[aria-label="Loop bar 20"]').click(); await d.locator('button[aria-label="Loop bar 17"]').click()
const chip2 = await d.locator('button[aria-label="Clear loop"]').innerText()
const s2 = await watch(9000); const in2 = s2.slice(1).every(v => v >= 16 && v <= 19), wraps2 = s2.filter((v, i) => i && v === 16 && s2[i - 1] === 19).length
// clear: playback continues past the range
await d.locator('button[aria-label="Clear loop"]').click()
const s3 = await watch(8000)
console.log(JSON.stringify({ cell: sizes && [Math.round(sizes.width), Math.round(sizes.height)], chip1, loop1: s1, wraps1, chip2, loop2: s2, in2, wraps2, afterClear: s3, songBars: st, secs }))
await b.close()
