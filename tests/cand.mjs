import { chromium, devices } from 'playwright'
const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 800 } }); const p = await ctx.newPage()
await p.goto('http://localhost:4173/rhythm/#/library', { waitUntil: 'networkidle' })
const r = await p.locator('textarea[aria-label="Request a song"]').evaluate(el => { const cs = getComputedStyle(el); const inner = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); const c = document.createElement('canvas').getContext('2d')
  return { inner, rows: ['Request a song, added within minutes', 'Request a song (added within minutes)', 'Request a song (added in minutes)', 'Request a song, added in minutes', 'Request a song, live in minutes'].flatMap(t => [13, 14, 15, 16].map(f => { c.font = `${f}px ${cs.fontFamily}`; return `${f}px ${Math.round(c.measureText(t).width)} ${t}` })) } })
console.log(JSON.stringify(r, null, 1)); await b.close()
