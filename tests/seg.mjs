import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await p.goto('https://nmpy7knjd8-code.github.io/rhythm/?v=' + Date.now() + '#/library', { waitUntil: 'networkidle' })
for (const song of [false, true]) {
  if (song) { await p.evaluate(async () => { await window.__pulseLoadSong('vicarious', 0) }); await p.waitForTimeout(300) }
  await p.locator('[aria-label="Browse rhythms"]').click(); await p.waitForTimeout(600)
  const r = await p.evaluate(() => { const d = document.querySelector('[role=dialog] > div'), seg = [...d.querySelectorAll('.inline-flex')].find(e => /Now playing/.test(e.textContent)); const a = d.getBoundingClientRect(), s = seg.getBoundingClientRect()
    return { tabs: [...seg.querySelectorAll('button')].map(x => x.textContent).join('/'), left: Math.round(s.left - a.left), right: Math.round(a.right - s.right) } })
  console.log(song ? 'with song:' : 'no song:', JSON.stringify(r))
  await p.screenshot({ path: `/workspace/screenshots/v19-tabs-${song ? 'song' : 'nosong'}.png`, clip: { x: 0, y: 70, width: 390, height: 200 } })
  await p.locator('[aria-label="Close player"]').click(); await p.waitForTimeout(500)
}
await b.close()
