// 'Skip to the good part' shows while a song plays and jumps to the song's goodPart bar. 390 px; screenshot of the first song.
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/', ids = (process.argv[3] ?? 'yyz,mobydick,airtonight,lateralus').split(','), shot = process.argv[4] ?? '/workspace/goodpart.png'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto(url + '?v=' + Date.now(), { waitUntil: 'networkidle' })
for (const [n, id] of ids.entries()) {
  const before = await p.getByRole('button', { name: 'Skip to the good part' }).count()
  await p.evaluate(async id => { await window.__pulseLoadSong(id, 0) }, id); await p.waitForTimeout(500); await p.click('button[aria-label="Play"]')
  await p.waitForTimeout(1200)
  const floating = await p.getByRole('button', { name: 'Skip to the good part' }).count()
  await p.click('button[aria-label="Stop"] ~ button.flex-1'); await p.waitForTimeout(700)
  const btn = p.getByRole('button', { name: 'Skip to the good part' }); const shown = await btn.count()
  if (n === 0) await p.screenshot({ path: shot })
  if (shown) await btn.click(); await p.waitForTimeout(3000)
  await p.keyboard.press('Escape'); await p.mouse.click(195, 60); await p.waitForTimeout(600)
  const bar = await p.evaluate(() => window.__pulseEngine.songBar ?? window.__pulseEngine.bar)
  console.log(id.padEnd(11), JSON.stringify({ shownWhileStopped: before, collapsedBar: floating, shownWhilePlaying: shown, barAfterSkip: bar }))
  await p.click('button[aria-label="Stop"]'); await p.waitForTimeout(300)
}
await b.close()
