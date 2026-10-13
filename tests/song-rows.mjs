import { chromium, devices } from 'playwright'
const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }); const p = await c.newPage()
await p.goto(process.argv[2], { waitUntil: 'networkidle' })
console.log(await p.$$eval('article .mt-4.flex', rs => { const bad = rs.filter(r => r.scrollWidth > r.clientWidth + 1 || [...r.children].some(x => x.getBoundingClientRect().height > 42)); return { rows: rs.length, bad: bad.length } }))
await b.close()
