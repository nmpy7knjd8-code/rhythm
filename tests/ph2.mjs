import { chromium } from 'playwright'
const b = await chromium.launch()
for (const w of [320, 375, 390, 430]) {
  const p = await b.newPage({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2 })
  await p.goto((process.env.URL || 'https://nmpy7knjd8-code.github.io/rhythm/') + '?v=' + Date.now() + '#/library', { waitUntil: 'networkidle' })
  const el = p.locator('textarea[aria-label="Request a song"]')
  const r = await el.evaluate(el => { const cs = getComputedStyle(el); const c = document.createElement('canvas').getContext('2d'); c.font = `${cs.fontSize} ${cs.fontFamily}`
    const inner = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); const tw = c.measureText(el.placeholder).width, lines = Math.ceil(tw / inner)
    const room = Math.floor((el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / parseFloat(cs.lineHeight))
    return { font: cs.fontSize, inner: Math.round(inner), text: Math.round(tw), linesNeeded: lines, linesShown: room } })
  console.log(w + 'px', JSON.stringify(r), r.linesShown >= r.linesNeeded ? 'FULL TEXT VISIBLE' : 'CUT OFF')
  await el.screenshot({ path: `/workspace/screenshots/v15-request-${w}.png` }); await p.close()
}
await b.close()
