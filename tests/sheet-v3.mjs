// 390 px: long title clear of the drag handle; Next in the open sheet plays the next queued song.
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto(url + '?v=' + Date.now(), { waitUntil: 'networkidle' })
await p.locator('button[aria-label="Add Kashmir to queue"]').first().click(); await p.locator('button[aria-label="Add Africa to queue"]').first().click()
await p.evaluate(async () => { await window.__pulseLoadSong('shookme', 0) }); await p.waitForTimeout(500); await p.click('button[aria-label="Play"]'); await p.waitForTimeout(800)
await p.click('button[aria-label="Stop"] ~ button.flex-1'); await p.waitForTimeout(900)
const gap = await p.evaluate(() => { const d = [...document.querySelectorAll('[role=dialog]')].find(x => x.getAttribute('aria-hidden') === 'false'); const h = d.querySelector('.rounded-full.bg-white\\/30').getBoundingClientRect(); const t = d.querySelector('.text-\\[14px\\].font-medium').getBoundingClientRect(); return { title: d.querySelector('.text-\\[14px\\].font-medium').textContent, handleBottom: Math.round(h.bottom), titleTop: Math.round(t.top), clear: t.top - h.bottom } })
await p.screenshot({ path: '/workspace/player-v3.png' })
await p.click('[role=dialog][aria-hidden=false] button[aria-label="Play next song"]'); await p.waitForTimeout(2000)
const after = await p.evaluate(() => ({ title: [...document.querySelectorAll('[role=dialog]')].find(x => x.getAttribute('aria-hidden') === 'false')?.querySelector('.text-\\[14px\\].font-medium')?.textContent, next: document.querySelector('button[aria-label^="Next song"]').getAttribute('aria-label') }))
console.log(JSON.stringify({ gap, after }))
await b.close()
