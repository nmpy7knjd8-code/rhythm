import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto((process.env.URL || 'https://nmpy7knjd8-code.github.io/rhythm/') + '?v=' + Date.now() + '#/library', { waitUntil: 'networkidle' })
const r = await p.locator('input[aria-label="Request a song"]').evaluate(el => { const cs = getComputedStyle(el); const c = document.createElement('canvas').getContext('2d'); c.font = `11.5px ${cs.fontFamily}`
  return { text: el.placeholder, textW: Math.round(c.measureText(el.placeholder).width), boxW: Math.round(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) } })
console.log(JSON.stringify(r), r.textW <= r.boxW ? 'FITS' : 'TOO LONG')
await p.locator('input[aria-label="Request a song"]').screenshot({ path: '/workspace/screenshots/v13-request.png' }); await b.close()
