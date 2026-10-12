import { chromium, devices } from 'playwright'
const URL = (process.env.URL || 'https://nmpy7knjd8-code.github.io/rhythm/')
const b = await chromium.launch()
for (const w of [320, 375, 390, 430]) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: w, height: 800 } }); const p = await ctx.newPage()
  await p.goto(URL + '?v=' + Date.now() + '#/library', { waitUntil: 'networkidle' })
  const el = p.locator('input[aria-label="Request a song"]')
  const r = await el.evaluate(el => { const cs = getComputedStyle(el), ph = getComputedStyle(el, '::placeholder'); const c = document.createElement('canvas').getContext('2d'); c.font = `${ph.fontSize} ${cs.fontFamily}`
    const inner = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); const tw = c.measureText(el.placeholder).width
    const room = Math.round((el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / parseFloat(cs.lineHeight))
    const small = [...document.querySelectorAll('input:not([type=range]):not([type=checkbox]):not([type=hidden]), textarea, select')].filter(e => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 16).length
    return { text: el.placeholder, inputFont: cs.fontSize, phFont: ph.fontSize, inner: Math.round(inner), textW: Math.round(tw), lines: Math.ceil(tw / inner), linesShown: room, fieldsUnder16px: small } })
  console.log(w + 'px', JSON.stringify(r), r.linesShown >= r.lines ? 'FULL TEXT VISIBLE' : 'CUT OFF')
  await el.screenshot({ path: `/workspace/screenshots/v16-request-${w}.png` }); await ctx.close()
}
await b.close()
