import { chromium } from 'playwright'
const URL = 'https://nmpy7knjd8-code.github.io/rhythm/'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await p.goto(URL + '?v=' + Date.now() + '#/library', { waitUntil: 'networkidle' }); await p.waitForTimeout(600)
const n = await p.locator('nav[aria-label=Artists] button').count(); console.log('artist bubbles:', n)
await p.screenshot({ path: '/workspace/screenshots/v9-artist-bubbles.png' })
await p.locator('nav[aria-label=Artists] button', { hasText: 'Van Halen' }).click(); await p.waitForTimeout(1200)
console.log('scrolled to:', await p.evaluate(() => { const el = document.getElementById('artist-van-halen'); return { top: Math.round(el.getBoundingClientRect().top), scrollY: Math.round(scrollY) } }))
console.log('HFT card:', (await p.locator('#artist-van-halen').innerText()).match(/\d+ BPM/)?.[0])
await p.evaluate(async () => { await window.__pulseLoadSong('hotforteacher', 0); const e = window.__pulseEngine; e.jumpSong(20); await e.start() }); await p.waitForTimeout(1500)
console.log('player BPM while playing:', await p.locator('[aria-label="Current tempo"]').innerText())
// live tempo map: Dance of Eternity
await p.evaluate(async () => { const e = window.__pulseEngine; e.stop(); await window.__pulseLoadSong('danceeternity', 0); e.jumpSong(0); await e.start() }); await p.waitForTimeout(1000)
const seen = new Set(); for (let i = 0; i < 25; i++) { seen.add(await p.locator('[aria-label="Current tempo"]').innerText()); await p.waitForTimeout(1000) }
console.log('Dance of Eternity BPM readings over 25 s:', [...seen].join(', '))
await b.close()
