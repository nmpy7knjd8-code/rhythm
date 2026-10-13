// 390x844: Library top fits 'or shuffle' above the docked mini-player; the player sheet opens with its header visible and Up next collapsed.
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto(url + '?v=' + Date.now(), { waitUntil: 'networkidle' }); await p.waitForTimeout(800)
await p.screenshot({ path: '/workspace/library-tight.png' })
const lay = await p.evaluate(() => { const sh = document.querySelector('button[aria-label="Shuffle songs"]').getBoundingClientRect(); const bar = document.querySelector('button[aria-label="Play"],button[aria-label="Stop"]').closest('.fixed').getBoundingClientRect(); return { shuffleBottom: Math.round(sh.bottom), barTop: Math.round(bar.top), gap: Math.round(bar.top - sh.bottom) } })
await p.click('button[aria-label="Shuffle songs"]'); await p.waitForTimeout(2500)
const res = []
for (let i = 0; i < 2; i++) {
  await p.click('button[aria-label="Stop"] ~ button.flex-1'); await p.waitForTimeout(900)
  if (i === 0) await p.screenshot({ path: '/workspace/player-open.png' })
  res.push(await p.evaluate(() => { const d = [...document.querySelectorAll('[role=dialog]')].find(x => x.getAttribute('aria-hidden') === 'false'); const close = d.querySelector('button[aria-label="Close player"]').getBoundingClientRect(); const un = d.querySelector('button[aria-expanded]'); return { closeTop: Math.round(close.top), upNext: un?.textContent, expanded: un?.getAttribute('aria-expanded') } }))
  if (i === 0) { await p.click('[role=dialog][aria-hidden=false] button[aria-expanded]'); await p.waitForTimeout(300); await p.click('button[aria-label="Close player"]'); await p.waitForTimeout(700) }
}
console.log(JSON.stringify({ lay, sheet: res }))
await b.close()
