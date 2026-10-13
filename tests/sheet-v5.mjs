import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/', shot = process.argv[3] ?? '/workspace/player-v5.png'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto(url + '?v=' + Date.now(), { waitUntil: 'networkidle' })
await p.click('button[aria-label="Shuffle songs"]'); await p.waitForTimeout(800)
await p.evaluate(async () => { await window.__pulseLoadSong('shookme', 0) }); await p.waitForTimeout(300)
await p.locator('button[aria-label="Play"]').first().click(); await p.waitForTimeout(800)
await p.locator('button.flex-1.min-w-0.text-left').first().click(); await p.waitForTimeout(700)
const d = p.locator('[role=dialog]')
const box = async sel => d.locator(sel).first().boundingBox()
const r = { stop: await box('button[aria-label="Stop"]'), next: await box('button[aria-label^="Next song"]'), close: await box('button[aria-label="Close player"]'), title: await box('.truncate') }
console.log(JSON.stringify(r))
await p.screenshot({ path: shot })
await d.locator('button[aria-label="Stop"]').click(); await p.waitForTimeout(300); console.log('after stop playing=', await p.evaluate(() => window.__pulseEngine.playing))
await d.locator('button[aria-label="Play"]').click(); await p.waitForTimeout(300); console.log('after play playing=', await p.evaluate(() => window.__pulseEngine.playing))
await b.close()
